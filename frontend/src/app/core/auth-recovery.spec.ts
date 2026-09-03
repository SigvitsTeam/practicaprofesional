import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';

describe('Password recovery request', () => {
  let request: ReturnType<typeof vi.fn>;
  const config = {
    auth: {
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'qa-public-key',
      demoEnabled: false,
    },
  };
  beforeEach(() => {
    request = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', request);
    localStorage.removeItem('sigvits-auth-session');
    sessionStorage.removeItem('sigvits-auth-session');
    TestBed.configureTestingModule({
      providers: [{ provide: RuntimeConfigService, useValue: config }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('normalizes plus-addressing without stripping the alias and uses a same-origin redirect', async () => {
    await TestBed.inject(AuthService).requestPasswordReset(' Sigvits+Superadmin@gmail.com ');
    const [target, options] = request.mock.calls[0];
    const url = new URL(target);
    expect(url.origin).toBe(config.auth.supabaseUrl);
    expect(url.pathname).toBe('/auth/v1/recover');
    const redirect = new URL(url.searchParams.get('redirect_to')!);
    expect(redirect.origin).toBe(window.location.origin);
    expect(redirect.searchParams.get('auth')).toBe('recovery');
    expect(JSON.parse(options.body)).toEqual({ email: 'sigvits+superadmin@gmail.com' });
    expect(options.signal).toBeDefined();
  });
  it('reports rate limits without asserting delivery', async () => {
    request.mockResolvedValue(new Response('{}', { status: 429 }));
    await expect(
      TestBed.inject(AuthService).requestPasswordReset('qa@example.invalid'),
    ).rejects.toThrow('límite');
  });
  it('reports network failures', async () => {
    request.mockRejectedValue(new Error('offline'));
    await expect(
      TestBed.inject(AuthService).requestPasswordReset('qa@example.invalid'),
    ).rejects.toThrow('conectar');
  });
  it('does not pretend to send an email when authentication is unconfigured', async () => {
    TestBed.overrideProvider(RuntimeConfigService, {
      useValue: { auth: { supabaseUrl: '', supabaseAnonKey: '' } },
    });
    await expect(
      TestBed.inject(AuthService).requestPasswordReset('qa@example.invalid'),
    ).rejects.toThrow('no está configurada');
    expect(request).not.toHaveBeenCalled();
  });
});
