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
        'El envío de invitaciones no está configurado: revise AUTH_ISSUER y AUTH_ADMIN_SECRET en el backend.',
      );
    if (!this.config.invitationRedirectUrl)
      throw new IdentityInvitationError(
        'Configure AUTH_INVITATION_REDIRECT_URL en el backend y autorice esa URL en Supabase.',
      );
    const url = new URL(`${issuer}/invite`);
    url.searchParams.set('redirect_to', this.config.invitationRedirectUrl);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          apikey: secret,
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
          'x-supabase-api-version': '2024-01-01',
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(this.config.adminTimeoutMs),
      });
    } catch {
      throw new IdentityInvitationError(
        'El proveedor de identidad no respondió dentro del tiempo permitido.',
      );
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code = body && typeof body === 'object' && 'code' in body ? body.code : undefined;
      const messages: Record<string, string> = {
        email_address_not_authorized:
          'Supabase no autoriza el envío a este correo. Configure SMTP propio; el servicio predeterminado solo permite destinatarios del equipo del proyecto.',
        over_email_send_rate_limit:
          'Se alcanzó el límite de correos de Supabase. Espere antes de reintentar y revise los límites de SMTP.',
        email_exists:
          'La identidad ya existe en Supabase; vincúlela mediante su identificador externo. Si olvidó su contraseña, utilice la recuperación desde el acceso.',
        user_already_exists:
          'La identidad ya existe en Supabase; vincúlela mediante su identificador externo.',
        email_address_invalid: 'Supabase rechazó el formato o dominio del correo indicado.',
      };
      throw new IdentityInvitationError(
        (typeof code === 'string' ? messages[code] : undefined) ??
          (response.status === 429
            ? 'Se alcanzó el límite de solicitudes. Espere antes de volver a enviar la invitación.'
            : response.status === 401 || response.status === 403
              ? 'Supabase rechazó la autorización administrativa. Revise AUTH_ADMIN_SECRET en el backend.'
              : 'No se pudo enviar la invitación. Revise los registros de Auth y la configuración SMTP en Supabase.'),
      );
    }
    if (
      !body ||
      typeof body !== 'object' ||
      !('id' in body) ||
      typeof body.id !== 'string' ||
      !body.id.trim()
    )
      throw new IdentityInvitationError('El proveedor devolvió una identidad inválida.');
    return { subject: body.id };
  }
}
