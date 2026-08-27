import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeConfigService } from './runtime-config.service';

describe('RuntimeConfigService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads a public Supabase configuration and disables demo mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            apiUrl: 'https://api.sigvits.hn/api',
            auth: {
              supabaseUrl: 'https://project.supabase.co/',
              supabaseAnonKey: 'public-key',
              demoEnabled: true,
            },
            maps: {
              tileUrl: 'https://maps.example.test/{z}/{x}/{y}.png',
              attribution: 'Proveedor de prueba',
              maxZoom: 19,
              smallCountThreshold: 7,
            },
          }),
      }),
    );
    const service = new RuntimeConfigService();

    await service.load();

    expect(service.apiUrl).toBe('https://api.sigvits.hn/api');
    expect(service.auth.supabaseUrl).toBe('https://project.supabase.co');
    expect(service.auth.demoEnabled).toBe(false);
    expect(service.maps.smallCountThreshold).toBe(7);
  });

  it('keeps safe defaults when optional map values are invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            maps: { maxZoom: 99, smallCountThreshold: -1 },
          }),
      }),
    );
    const service = new RuntimeConfigService();

    await service.load();

    expect(service.maps.maxZoom).toBe(18);
    expect(service.maps.smallCountThreshold).toBe(0);
  });
});
