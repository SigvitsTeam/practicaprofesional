import { IdentityInvitationError } from '../domain/managed-user';
import { SupabaseIdentityInvitationGateway } from './supabase-identity-invitation.gateway';

const config = {
  issuer: 'https://project.supabase.co/auth/v1',
  audience: 'authenticated',
  jwksUrl: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
  clockToleranceSeconds: 5,
  jwksTimeoutMs: 5_000,
  adminSecret: 'server-only-secret',
  invitationRedirectUrl: 'https://sigvits.example.org',
  adminTimeoutMs: 5_000,
};

describe('SupabaseIdentityInvitationGateway', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the server secret only in headers and returns the immutable subject', async () => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'provider-user-123' }), { status: 200 }),
      );
    await expect(
      new SupabaseIdentityInvitationGateway(config).invite('user@example.org'),
    ).resolves.toEqual({
      subject: 'provider-user-123',
    });
    expect(request).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/invite?redirect_to=https%3A%2F%2Fsigvits.example.org',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'server-only-secret' }),
        body: JSON.stringify({
          email: 'user@example.org',
        }),
      }),
    );
  });

  it('fails closed when the server secret is absent', async () => {
    const request = jest.spyOn(global, 'fetch');
    await expect(
      new SupabaseIdentityInvitationGateway({ ...config, adminSecret: undefined }).invite(
        'user@example.org',
      ),
    ).rejects.toBeInstanceOf(IdentityInvitationError);
    expect(request).not.toHaveBeenCalled();
  });

  it('does not send mail without an explicit return URL', async () => {
    const request = jest.spyOn(global, 'fetch');
    await expect(
      new SupabaseIdentityInvitationGateway({ ...config, invitationRedirectUrl: undefined }).invite(
        'qa@example.org',
      ),
    ).rejects.toThrow('AUTH_INVITATION_REDIRECT_URL');
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    [422, 'email_address_not_authorized', 'SMTP propio'],
    [429, 'over_email_send_rate_limit', 'límite de correos'],
    [422, 'email_exists', 'ya existe'],
    [422, 'user_already_exists', 'ya existe'],
    [422, 'email_address_invalid', 'formato o dominio'],
    [403, 'not_admin', 'AUTH_ADMIN_SECRET'],
    [500, 'unexpected_failure', 'registros de Auth'],
  ])(
    'maps provider status %s / %s without exposing its response',
    async (status, code, expected) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ code, message: 'private-provider-detail' }), { status }),
        );
      await expect(
        new SupabaseIdentityInvitationGateway(config).invite('qa@example.org'),
      ).rejects.toThrow(expected);
    },
  );

  it('does not misclassify every 422 as an existing identity', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 422 }));
    await expect(
      new SupabaseIdentityInvitationGateway(config).invite('qa@example.org'),
    ).rejects.toThrow('configuración SMTP');
  });

  it.each(['null', '{}', '{"id":42}', 'not-json'])(
    'handles malformed successful responses (%s)',
    async (body) => {
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
      await expect(
        new SupabaseIdentityInvitationGateway(config).invite('qa@example.org'),
      ).rejects.toThrow('identidad inválida');
    },
  );

  it('handles a network timeout without claiming that mail was sent', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
    await expect(
      new SupabaseIdentityInvitationGateway(config).invite('qa@example.org'),
    ).rejects.toThrow('tiempo permitido');
  });
});
