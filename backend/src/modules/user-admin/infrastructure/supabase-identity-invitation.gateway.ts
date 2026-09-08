import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { authConfig } from '../../../config/app.config';
import { IdentityInvitationGateway } from '../application/ports/identity-invitation.gateway';
import { IdentityInvitationError, type IdentityInvitationStatus } from '../domain/managed-user';

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

  async getStatus(subject: string): Promise<IdentityInvitationStatus> {
    const issuer = this.config.issuer?.replace(/\/$/, '');
    const secret = this.config.adminSecret?.trim();
    if (!issuer || !secret)
      throw new IdentityInvitationError(
        'La verificación de invitaciones no está configurada: revise AUTH_ISSUER y AUTH_ADMIN_SECRET en el backend.',
      );
    if (!subject || subject.length > 255 || /[\s/]/.test(subject))
      throw new IdentityInvitationError('La identidad vinculada no es válida para consultar.');

    let response: Response;
    try {
      response = await fetch(`${issuer}/admin/users/${encodeURIComponent(subject)}`, {
        method: 'GET',
        headers: {
          apikey: secret,
          authorization: `Bearer ${secret}`,
          'x-supabase-api-version': '2024-01-01',
        },
        signal: AbortSignal.timeout(this.config.adminTimeoutMs),
      });
    } catch {
      throw new IdentityInvitationError(
        'El proveedor de identidad no respondió dentro del tiempo permitido.',
      );
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new IdentityInvitationError(
        response.status === 404
          ? 'El proveedor no encontró la identidad vinculada. Revise la vinculación antes de reenviar.'
          : response.status === 401 || response.status === 403
            ? 'Supabase rechazó la autorización administrativa. Revise AUTH_ADMIN_SECRET en el backend.'
            : response.status === 429
              ? 'Se alcanzó el límite de consultas de Supabase. Espere antes de reintentar.'
              : 'No se pudo verificar la invitación en el proveedor de identidad.',
      );
    }
    if (!body || typeof body !== 'object' || !('id' in body) || body.id !== subject)
      throw new IdentityInvitationError('El proveedor devolvió una identidad inválida.');

    const emailConfirmedAt = this.timestamp(body, 'email_confirmed_at');
    return {
      status: emailConfirmedAt ? 'EMAIL_CONFIRMED' : 'PENDING',
      sentAt: this.timestamp(body, 'confirmation_sent_at') ?? this.timestamp(body, 'invited_at'),
      emailConfirmedAt,
      lastAccessAt: this.timestamp(body, 'last_sign_in_at'),
    };
  }

  private timestamp(body: object, key: string): Date | null {
    const record = body as Record<string, unknown>;
    if (!(key in record) || record[key] === null) return null;
    const value = record[key];
    if (typeof value !== 'string')
      throw new IdentityInvitationError('El proveedor devolvió un estado de identidad inválido.');
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime()))
      throw new IdentityInvitationError('El proveedor devolvió un estado de identidad inválido.');
    return timestamp;
  }
}
