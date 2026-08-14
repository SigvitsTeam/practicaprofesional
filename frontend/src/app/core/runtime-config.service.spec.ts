import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeConfigService } from './runtime-config.service';

describe('RuntimeConfigService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads a public Supabase configuration and disables demo mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        apiUrl: 'https://api.sigvits.hn/api',
        auth: {
          supabaseUrl: 'https://project.supabase.co/',
          supabaseAnonKey: 'public-key',
          demoEnabled: true,
        },
      }),
    }));
    const service = new RuntimeConfigService();

    await service.load();

    expect(service.apiUrl).toBe('https://api.sigvits.hn/api');
    expect(service.auth.supabaseUrl).toBe('https://project.supabase.co');
    expect(service.auth.demoEnabled).toBe(false);
  });
});
