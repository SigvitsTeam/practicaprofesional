import { TestBed } from '@angular/core/testing';
import { EmailAccessService } from './email-access.service';
import { RuntimeConfigService } from './runtime-config.service';

const user = {
  id: 'qa-user',
  email: 'qa@example.invalid',
  email_confirmed_at: '2026-09-03T00:00:00Z',
};
const password = 'frase larga de QA únicamente';
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const link = (type = 'recovery') =>
  window.history.replaceState(
    null,
    '',
    `/?auth=${type}#access_token=qa-only-token&refresh_token=qa-only-refresh&token_type=bearer&expires_in=3600&type=${type}`,
  );

describe('EmailAccessService', () => {
  let request: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    localStorage.removeItem('sigvits-auth-session');
    sessionStorage.removeItem('sigvits-auth-session');
    request = vi.fn().mockResolvedValue(reply(user));
    vi.stubGlobal('fetch', request);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RuntimeConfigService,
          useValue: {
            auth: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'qa-public-key' },
          },
        },
      ],
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('does nothing on a normal login page', () => {
    expect(TestBed.inject(EmailAccessService).active()).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it.each(['invite', 'recovery'])(
    'validates the %s token with Supabase without persisting a session',
    async (kind) => {
      link(kind);
      const service = TestBed.inject(EmailAccessService);
      expect(window.location.hash).toBe('');
      expect(window.location.search).toBe('');
      await flush();
      expect(service.status()).toBe('ready');
      expect(service.email()).toBe(user.email);
      expect(request).toHaveBeenCalledWith(
        'https://project.supabase.co/auth/v1/user',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Bearer qa-only-token' }),
          referrerPolicy: 'no-referrer',
        }),
      );
      expect(localStorage.getItem('sigvits-auth-session')).toBeNull();
      expect(sessionStorage.getItem('sigvits-auth-session')).toBeNull();
    },
  );

  it('verifies a token hash before retrieving the user', async () => {
    window.history.replaceState(null, '', '/?token_hash=0123456789abcdef&type=invite');
    request
      .mockReset()
      .mockResolvedValueOnce(reply({ access_token: 'qa-only-token', expires_in: 3600 }))
      .mockResolvedValueOnce(reply(user));
    const service = TestBed.inject(EmailAccessService);
    await flush();
    expect(service.status()).toBe('ready');
    expect(request.mock.calls[0][0]).toBe('https://project.supabase.co/auth/v1/verify');
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
      type: 'invite',
      token_hash: '0123456789abcdef',
    });
  });

  it.each([null, {}, { ...user, email_confirmed_at: null }])(
    'rejects incomplete or unverified identity responses',
    async (data) => {
      link();
      request.mockResolvedValue(reply(data));
      const service = TestBed.inject(EmailAccessService);
      await flush();
      expect(service.status()).toBe('error');
      expect(await service.setPassword(password, password)).toBe(false);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a revoked token', async () => {
    link();
    request.mockResolvedValue(reply({ code: 'bad_jwt' }, 401));
    const service = TestBed.inject(EmailAccessService);
    await flush();
    expect(service.status()).toBe('error');
  });

  it('updates the password only with the validated email token, then revokes that session', async () => {
    link();
    request
      .mockReset()
      .mockResolvedValueOnce(reply(user))
      .mockResolvedValueOnce(reply(user))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = TestBed.inject(EmailAccessService);
    await flush();
    expect(await service.setPassword(password, password)).toBe(true);
    expect(request.mock.calls[1][0]).toBe('https://project.supabase.co/auth/v1/user');
    expect(request.mock.calls[1][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ password }),
      headers: { Authorization: 'Bearer qa-only-token' },
    });
    expect(request.mock.calls[2][0]).toBe('https://project.supabase.co/auth/v1/logout?scope=local');
    expect(service.status()).toBe('complete');
    expect(await service.setPassword(password, password)).toBe(false);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('does not submit mismatched passwords', async () => {
    link();
    const service = TestBed.inject(EmailAccessService);
    await flush();
    expect(await service.setPassword(password, 'otra contraseña')).toBe(false);
    expect(service.error()).toContain('no coinciden');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('prevents concurrent password updates while the first request is pending', async () => {
    link();
    const service = TestBed.inject(EmailAccessService);
    await flush();
    let resolve!: (value: Response) => void;
    request.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const pending = service.setPassword(password, password);
    expect(service.status()).toBe('saving');
    expect(await service.setPassword(password, password)).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);
    resolve(reply(user));
    expect(await pending).toBe(true);
    expect(service.status()).toBe('complete');
  });

  it.each([
    ['same_password', 'diferente'],
    ['weak_password', 'política de seguridad'],
  ])('handles %s without exposing raw provider messages', async (code, expected) => {
    link();
    request
      .mockReset()
      .mockResolvedValueOnce(reply(user))
      .mockResolvedValueOnce(reply({ code, message: 'private-provider-message' }, 422));
    const service = TestBed.inject(EmailAccessService);
    await flush();
    expect(await service.setPassword(password, password)).toBe(false);
    expect(service.status()).toBe('ready');
    expect(service.error()).toContain(expected);
    expect(service.error()).not.toContain('private-provider-message');
  });

  it('fails closed if the token expires before the update', async () => {
    link();
    const service = TestBed.inject(EmailAccessService);
    await flush();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_600_001);
    expect(await service.setPassword(password, password)).toBe(false);
    expect(service.status()).toBe('error');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('ignores a pending validation after returning to login', async () => {
    let resolve!: (value: Response) => void;
    request.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    link();
    const service = TestBed.inject(EmailAccessService);
    service.close();
    resolve(reply(user));
    await flush();
    expect(service.active()).toBe(false);
    expect(service.email()).toBe('');
    expect(await service.setPassword(password, password)).toBe(false);
  });
});
