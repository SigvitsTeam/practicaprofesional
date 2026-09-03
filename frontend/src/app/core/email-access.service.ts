import { Injectable, inject, signal } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';
import {
  readEmailAction,
  passwordProblem,
  type EmailActionKind,
  type EmailActionInput,
} from './email-action';

const INVALID_LINK =
  'El enlace es inválido, ya se utilizó o ha vencido. Solicita un nuevo correo desde el acceso o contacta al administrador.';

/** Email sessions are memory-only and never become an institutional login. */
@Injectable({ providedIn: 'root' })
export class EmailAccessService {
  private readonly config = inject(RuntimeConfigService);
  private token = '';
  private expiresAt = 0;
  private generation = 0;
  readonly active = signal(false);
  readonly action = signal<EmailActionKind>('recovery');
  readonly status = signal<'checking' | 'ready' | 'saving' | 'complete' | 'error'>('checking');
  readonly error = signal('');
  readonly email = signal('');

  constructor() {
    const { input, cleanUrl } = readEmailAction(new URL(window.location.href));
    if (input.kind === 'none') return;
    // Remove secrets before validation/network activity. Never persist link tokens.
    window.history.replaceState(null, '', cleanUrl);
    this.active.set(true);
    this.action.set(input.action);
    void this.prepare(input);
  }

  private async prepare(input: Exclude<EmailActionInput, { kind: 'none' }>): Promise<void> {
    const generation = ++this.generation;
    if (
      input.kind === 'invalid' ||
      !this.config.auth.supabaseUrl ||
      !this.config.auth.supabaseAnonKey
    ) {
      this.fail(INVALID_LINK);
      return;
    }
    try {
      let token: string;
      let expiresIn: number;
      if (input.kind === 'token') {
        const response = await this.request('/verify', {
          method: 'POST',
          body: JSON.stringify({ type: input.action, token_hash: input.tokenHash }),
        });
        const data: unknown = await response.json();
        if (
          !response.ok ||
          !data ||
          typeof data !== 'object' ||
          !('access_token' in data) ||
          typeof data.access_token !== 'string' ||
          !('expires_in' in data) ||
          typeof data.expires_in !== 'number'
        )
          throw new Error(INVALID_LINK);
        token = data.access_token;
        expiresIn = data.expires_in;
      } else {
        token = input.accessToken;
        expiresIn = input.expiresIn;
      }
      const response = await this.request('/user', { method: 'GET' }, token);
      const user: unknown = await response.json();
      if (
        !response.ok ||
        !user ||
        typeof user !== 'object' ||
        !('id' in user) ||
        typeof user.id !== 'string' ||
        !('email' in user) ||
        typeof user.email !== 'string' ||
        !('email_confirmed_at' in user) ||
        !user.email_confirmed_at ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
      )
        throw new Error(INVALID_LINK);
      if (generation !== this.generation) return;
      this.token = token;
      this.expiresAt = Date.now() + Math.min(expiresIn, 3600) * 1000;
      this.email.set(user.email);
      this.status.set('ready');
    } catch {
      if (generation === this.generation) this.fail(INVALID_LINK);
    }
  }

  async setPassword(password: string, confirmation: string): Promise<boolean> {
    if (this.status() !== 'ready') return false;
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      this.error.set(problem);
      return false;
    }
    if (!this.token || Date.now() >= this.expiresAt) {
      this.fail(INVALID_LINK);
      return false;
    }
    const generation = this.generation;
    this.status.set('saving');
    this.error.set('');
    try {
      const response = await this.request(
        '/user',
        { method: 'PUT', body: JSON.stringify({ password }) },
        this.token,
      );
      if (generation !== this.generation) return false;
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        if (generation !== this.generation) return false;
        const code = body && typeof body === 'object' && 'code' in body ? body.code : undefined;
        if (response.status === 401 || response.status === 403) {
          this.fail(INVALID_LINK);
          return false;
        }
        this.error.set(
          code === 'same_password'
            ? 'Elige una contraseña diferente de la anterior.'
            : code === 'weak_password'
              ? 'La contraseña no cumple la política de seguridad de Supabase. Utiliza una más larga y difícil de adivinar.'
              : 'No fue posible guardar la contraseña. Intenta nuevamente o solicita otro enlace.',
        );
        this.status.set('ready');
        return false;
      }
      // Best-effort revocation; never silently log in after a reset.
      await this.request('/logout?scope=local', { method: 'POST' }, this.token).catch(
        () => undefined,
      );
      if (generation !== this.generation) return false;
      this.token = '';
      this.expiresAt = 0;
      this.status.set('complete');
      return true;
    } catch {
      if (generation === this.generation) {
        this.error.set(
          'No se pudo confirmar el cambio. Intenta iniciar sesión con la contraseña nueva; si no funciona, solicita otro enlace.',
        );
        this.status.set('ready');
      }
      return false;
    }
  }

  close(): void {
    this.generation++;
    this.token = '';
    this.expiresAt = 0;
    this.email.set('');
    this.error.set('');
    this.active.set(false);
  }

  private fail(message: string): void {
    this.token = '';
    this.expiresAt = 0;
    this.error.set(message);
    this.status.set('error');
  }

  private request(path: string, init: RequestInit, token?: string): Promise<Response> {
    return fetch(`${this.config.auth.supabaseUrl}/auth/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.config.auth.supabaseAnonKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
  }
}
