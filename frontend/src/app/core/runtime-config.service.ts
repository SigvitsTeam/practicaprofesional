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
  maps: RuntimeMapConfig;
}

export interface RuntimeMapConfig {
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  smallCountThreshold: number;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private current: RuntimeConfig = {
    apiUrl: environment.apiUrl,
    auth: { ...environment.auth },
    maps: { ...environment.maps },
  };

  get apiUrl(): string {
    return this.current.apiUrl;
  }
  get auth(): Readonly<RuntimeAuthConfig> {
    return this.current.auth;
  }
  get maps(): Readonly<RuntimeMapConfig> {
    return this.current.maps;
  }

  async load(): Promise<void> {
    try {
      const response = await fetch('/config/runtime-config.json', { cache: 'no-store' });
      if (!response.ok) {
        if (environment.production)
          throw new Error(`Configuración no disponible (${response.status}).`);
        return;
      }
      const candidate = (await response.json()) as Partial<RuntimeConfig>;
      const auth = { ...this.current.auth, ...(candidate.auth ?? {}) };
      const maps = { ...this.current.maps, ...(candidate.maps ?? {}) };
      const supabaseUrl = auth.supabaseUrl?.trim().replace(/\/$/, '') ?? '';
      const supabaseAnonKey = auth.supabaseAnonKey?.trim() ?? '';
      if (Boolean(supabaseUrl) !== Boolean(supabaseAnonKey))
        throw new Error('Supabase requiere URL y clave pública simultáneamente.');
      if (environment.production && (!candidate.apiUrl?.trim() || !supabaseUrl))
        throw new Error('La configuración de producción está incompleta.');
      this.current = {
        apiUrl: candidate.apiUrl?.trim() || this.current.apiUrl,
        auth: {
          ...auth,
          supabaseUrl,
          supabaseAnonKey,
          demoEnabled: supabaseUrl ? false : Boolean(auth.demoEnabled),
        },
        maps: {
          tileUrl: maps.tileUrl?.trim() || this.current.maps.tileUrl,
          attribution: maps.attribution?.trim() || this.current.maps.attribution,
          maxZoom:
            Number.isInteger(maps.maxZoom) && maps.maxZoom >= 1 && maps.maxZoom <= 22
              ? maps.maxZoom
              : this.current.maps.maxZoom,
          smallCountThreshold:
            Number.isInteger(maps.smallCountThreshold) &&
            maps.smallCountThreshold >= 0 &&
            maps.smallCountThreshold <= 100
              ? maps.smallCountThreshold
              : this.current.maps.smallCountThreshold,
        },
      };
    } catch (error) {
      if (environment.production) {
        this.current = {
          ...this.current,
          auth: {
            supabaseUrl: '',
            supabaseAnonKey: '',
            demoEnabled: false,
            demoEmail: '',
            demoPassword: '',
          },
        };
      }
      if (typeof ngDevMode !== 'undefined' && ngDevMode)
        console.warn(
          environment.production
            ? 'No se cargó la configuración de runtime; el acceso quedó deshabilitado.'
            : 'No se cargó la configuración de runtime; se usarán valores de desarrollo.',
          error,
        );
    }
  }
}
