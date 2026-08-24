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
      'https://project.supabase.co/auth/v1/invite',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'server-only-secret' }),
        body: JSON.stringify({
          email: 'user@example.org',
          redirect_to: 'https://sigvits.example.org',
        }),
      }),
    );
  });

  it('fails closed when the server secret is absent', async () => {
    await expect(
      new SupabaseIdentityInvitationGateway({ ...config, adminSecret: undefined }).invite(
        'user@example.org',
      ),
    ).rejects.toBeInstanceOf(IdentityInvitationError);
  });
});
