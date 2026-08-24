import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { authConfig } from '../../../config/app.config';
import { IdentityInvitationGateway } from '../application/ports/identity-invitation.gateway';
import { IdentityInvitationError } from '../domain/managed-user';

@Injectable()
export class SupabaseIdentityInvitationGateway extends IdentityInvitationGateway {
  constructor(@Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>) {
    super();
  }

  async invite(email: string): Promise<{ subject: string }> {
    const issuer = this.config.issuer?.replace(/\/$/, '');
    const secret = this.config.adminSecret?.trim();
    if (!issuer || !secret)
      throw new IdentityInvitationError(
        'La API administrativa del proveedor de identidad no está configurada.',
      );
    let response: Response;
    try {
      response = await fetch(`${issuer}/invite`, {
        method: 'POST',
        headers: {
          apikey: secret,
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email,
          ...(this.config.invitationRedirectUrl
            ? { redirect_to: this.config.invitationRedirectUrl }
            : {}),
        }),
        signal: AbortSignal.timeout(this.config.adminTimeoutMs),
      });
    } catch {
      throw new IdentityInvitationError(
        'El proveedor de identidad no respondió dentro del tiempo permitido.',
      );
    }
    if (!response.ok)
      throw new IdentityInvitationError(
        response.status === 422 || response.status === 409
          ? 'La identidad ya existe en el proveedor; vincúlela mediante su identificador externo.'
          : 'El proveedor de identidad rechazó la invitación.',
      );
    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id !== 'string' || !body.id.trim())
      throw new IdentityInvitationError('El proveedor devolvió una identidad inválida.');
    return { subject: body.id };
  }
}
