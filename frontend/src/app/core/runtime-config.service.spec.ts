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
            maps: {
              tileUrl: 'https://maps.example.test/static.png',
              attribution: 'Proveedor que no debe conservarse',
              maxZoom: 4,
              smallCountThreshold: -1,
            },
          }),
      }),
    );
    const service = new RuntimeConfigService();

    await service.load();

    expect(service.maps.maxZoom).toBe(18);
    expect(service.maps.smallCountThreshold).toBe(0);
    expect(service.maps.tileUrl).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(service.maps.attribution).toBe('© OpenStreetMap contributors');
  });

  it('does not combine a custom provider with the OpenStreetMap attribution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            maps: {
              tileUrl: 'https://maps.example.test/{z}/{x}/{y}.png',
            },
          }),
      }),
    );
    const service = new RuntimeConfigService();

    await service.load();

    expect(service.maps.tileUrl).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(service.maps.attribution).toBe('© OpenStreetMap contributors');
  });
});
