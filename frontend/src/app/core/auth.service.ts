import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface AuthUser { id: string; email: string; name: string; }
interface AuthSession {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  provider: 'demo' | 'supabase';
  user: AuthUser;
}
export interface SignInCredentials { email: string; password: string; remember: boolean; }
export class AuthenticationError extends Error {}
const SESSION_KEY = 'sigvits-auth-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<AuthSession | null>(this.restoreSession());
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isDemo = computed(() => this.session()?.provider === 'demo');

  async signIn(credentials: SignInCredentials): Promise<void> {
    const email = credentials.email.trim().toLowerCase();
    const auth = environment.auth;
    let session: AuthSession;
    if (auth.supabaseUrl && auth.supabaseAnonKey) {
      session = await this.signInWithSupabase(email, credentials.password);
    } else if (auth.demoEnabled) {
      await new Promise(resolve => setTimeout(resolve, 450));
      if (email !== auth.demoEmail || credentials.password !== auth.demoPassword) {
        throw new AuthenticationError('El correo o la contraseña no son correctos.');
      }
      session = { provider: 'demo', user: { id: 'demo-municipal-coordinator', email, name: 'Dra. Ana Martínez' } };
    } else {
      throw new AuthenticationError('El proveedor de identidad no está configurado.');
    }
    this.persistSession(session, credentials.remember);
    this.session.set(session);
  }

  signOut(): void {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    this.session.set(null);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const auth = environment.auth;
    if (!auth.supabaseUrl || !auth.supabaseAnonKey) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return;
    }
    const response = await fetch(`${auth.supabaseUrl}/auth/v1/recover`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: auth.supabaseAnonKey },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (!response.ok) throw new AuthenticationError('No fue posible iniciar la recuperación. Intenta nuevamente.');
  }

  private async signInWithSupabase(email: string, password: string): Promise<AuthSession> {
    const auth = environment.auth;
    let response: Response;
    try {
      response = await fetch(`${auth.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: auth.supabaseAnonKey },
        body: JSON.stringify({ email, password }),
      });
    } catch { throw new AuthenticationError('No pudimos conectar con el servicio de acceso.'); }
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) throw new AuthenticationError('El correo o la contraseña no son correctos.');
      if (response.status === 429) throw new AuthenticationError('Demasiados intentos. Espera un momento antes de volver a intentar.');
      throw new AuthenticationError('No fue posible iniciar sesión. Intenta nuevamente.');
    }
    const data = await response.json() as {
      access_token: string; refresh_token: string; expires_in: number;
      user: { id: string; email?: string; user_metadata?: { full_name?: string; name?: string } };
    };
    return {
      provider: 'supabase', accessToken: data.access_token, refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      user: { id: data.user.id, email: data.user.email ?? email, name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? email },
    };
  }

  private persistSession(session: AuthSession, remember: boolean): void {
    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    other.removeItem(SESSION_KEY);
    target.setItem(SESSION_KEY, JSON.stringify(session));
  }

  private restoreSession(): AuthSession | null {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return null;
    const value = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    try {
      const session = JSON.parse(value) as AuthSession;
      if (!session.user?.email || (session.expiresAt && session.expiresAt <= Date.now())) {
        localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); return null;
      }
      return session;
    } catch { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); return null; }
  }
}
