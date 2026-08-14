import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface RuntimeAuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  demoEnabled: boolean;
  demoEmail: string;
  demoPassword: string;
}

export interface RuntimeConfig {
  apiUrl: string;
  auth: RuntimeAuthConfig;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private current: RuntimeConfig = {
    apiUrl: environment.apiUrl,
    auth: { ...environment.auth },
  };

  get apiUrl(): string { return this.current.apiUrl; }
  get auth(): Readonly<RuntimeAuthConfig> { return this.current.auth; }

  async load(): Promise<void> {
    try {
      const response = await fetch('/config/runtime-config.json', { cache: 'no-store' });
      if (!response.ok) return;
      const candidate = await response.json() as Partial<RuntimeConfig>;
      const auth = { ...this.current.auth, ...candidate.auth };
      if (Boolean(auth.supabaseUrl) !== Boolean(auth.supabaseAnonKey))
        throw new Error('Supabase requiere URL y clave pública simultáneamente.');
      this.current = {
        apiUrl: candidate.apiUrl?.trim() || this.current.apiUrl,
        auth: {
          ...auth,
          supabaseUrl: auth.supabaseUrl.trim().replace(/\/$/, ''),
          supabaseAnonKey: auth.supabaseAnonKey.trim(),
          demoEnabled: auth.supabaseUrl ? false : auth.demoEnabled,
        },
      };
    } catch (error) {
      if (typeof ngDevMode !== 'undefined' && ngDevMode)
        console.warn('No se cargó la configuración de runtime; se usarán valores de desarrollo.', error);
    }
  }
}
