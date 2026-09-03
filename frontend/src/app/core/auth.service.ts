import { Injectable, computed, inject, signal } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthSession {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  remember: boolean;
  provider: 'demo' | 'supabase';
  user: AuthUser;
}

interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string; user_metadata?: { full_name?: string; name?: string } };
}

export interface SignInCredentials {
  email: string;
  password: string;
  remember: boolean;
}
export class AuthenticationError extends Error {}

const SESSION_KEY = 'sigvits-auth-session';
const REFRESH_MARGIN_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly session = signal<AuthSession | null>(this.restoreSession());
  private refreshPromise?: Promise<string | null>;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isDemo = computed(() => this.session()?.provider === 'demo');

  async signIn(credentials: SignInCredentials): Promise<void> {
    const email = credentials.email.trim().toLowerCase();
    const auth = this.runtimeConfig.auth;
    let session: AuthSession;

    if (auth.supabaseUrl && auth.supabaseAnonKey) {
      const data = await this.requestToken('password', { email, password: credentials.password });
      session = this.toSession(data, credentials.remember, email);
    } else if (auth.demoEnabled) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (email !== auth.demoEmail || credentials.password !== auth.demoPassword) {
        throw new AuthenticationError('El correo o la contraseña no son correctos.');
      }
      session = {
        provider: 'demo',
        remember: credentials.remember,
        user: { id: 'demo-municipal-coordinator', email, name: 'Dra. Ana Martínez' },
      };
    } else {
      throw new AuthenticationError('El proveedor de identidad no está configurado.');
    }

    this.persistSession(session);
    this.session.set(session);
  }

  signOut(): void {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    this.session.set(null);
  }

  async getValidAccessToken(): Promise<string | null> {
    const session = this.session();
    if (!session || session.provider === 'demo') return null;
    if (session.accessToken && (session.expiresAt ?? 0) > Date.now() + REFRESH_MARGIN_MS)
      return session.accessToken;
    if (!session.refreshToken) {
      this.signOut();
      return null;
    }
    this.refreshPromise ??= this.refreshAccessToken(session).finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const auth = this.runtimeConfig.auth;
    if (!auth.supabaseUrl || !auth.supabaseAnonKey) {
      throw new AuthenticationError(
        'La recuperación por correo no está configurada en este entorno. Contacta al administrador.',
      );
    }
    const redirect = new URL(window.location.pathname, window.location.origin);
    redirect.searchParams.set('auth', 'recovery');
    const url = new URL(`${auth.supabaseUrl}/auth/v1/recover`);
    url.searchParams.set('redirect_to', redirect.toString());
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        signal: AbortSignal.timeout(10_000),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      throw new AuthenticationError(
        'No pudimos conectar con el servicio de recuperación. Intenta nuevamente.',
      );
    }
    if (response.status === 429)
      throw new AuthenticationError(
        'Se alcanzó el límite de solicitudes de correo. Espera unos minutos antes de volver a intentar.',
      );
    if (!response.ok)
      throw new AuthenticationError('No fue posible iniciar la recuperación. Intenta nuevamente.');
  }

  private async refreshAccessToken(previous: AuthSession): Promise<string | null> {
    try {
      const data = await this.requestToken('refresh_token', {
        refresh_token: previous.refreshToken,
      });
      const refreshed = this.toSession(data, previous.remember, previous.user.email);
      this.persistSession(refreshed);
      this.session.set(refreshed);
      return refreshed.accessToken ?? null;
    } catch {
      this.signOut();
      return null;
    }
  }

  private async requestToken(
    grantType: 'password' | 'refresh_token',
    body: Record<string, unknown>,
  ): Promise<SupabaseTokenResponse> {
    const auth = this.runtimeConfig.auth;
    let response: Response;
    try {
      response = await fetch(`${auth.supabaseUrl}/auth/v1/token?grant_type=${grantType}`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(body),
      });
    } catch {
      throw new AuthenticationError('No pudimos conectar con el servicio de acceso.');
    }
    if (!response.ok) {
      if (response.status === 400 || response.status === 401)
        throw new AuthenticationError('El correo o la contraseña no son correctos.');
      if (response.status === 429)
        throw new AuthenticationError(
          'Demasiados intentos. Espera un momento antes de volver a intentar.',
        );
      throw new AuthenticationError('No fue posible iniciar sesión. Intenta nuevamente.');
    }
    return response.json() as Promise<SupabaseTokenResponse>;
  }

  private authHeaders() {
    return { 'Content-Type': 'application/json', apikey: this.runtimeConfig.auth.supabaseAnonKey };
  }

  private toSession(
    data: SupabaseTokenResponse,
    remember: boolean,
    fallbackEmail: string,
  ): AuthSession {
    const email = data.user.email ?? fallbackEmail;
    return {
      provider: 'supabase',
      remember,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      user: {
        id: data.user.id,
        email,
        name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? email,
      },
    };
  }

  private persistSession(session: AuthSession): void {
    const target = session.remember ? localStorage : sessionStorage;
    const other = session.remember ? sessionStorage : localStorage;
    other.removeItem(SESSION_KEY);
    target.setItem(SESSION_KEY, JSON.stringify(session));
  }

  private restoreSession(): AuthSession | null {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return null;
    const value = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    try {
      const session = JSON.parse(value) as AuthSession;
      if (!session.user?.email || !['demo', 'supabase'].includes(session.provider))
        throw new Error('Invalid session');
      if (session.provider === 'demo' && !this.runtimeConfig.auth.demoEnabled)
        throw new Error('Demo session is disabled');
      return {
        ...session,
        remember: session.remember ?? localStorage.getItem(SESSION_KEY) !== null,
      };
    } catch {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
