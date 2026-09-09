import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TileLayer } from 'leaflet';
import type { Report } from '../../core/models';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { InteractiveMap, resolveLeafletApi, tileLoadHasFailed } from './interactive-map';

describe('Leaflet production module interoperability', () => {
  it('unwraps the CommonJS default export emitted by the production bundle', () => {
    const api = { map: vi.fn() } as unknown as typeof import('leaflet');

    expect(resolveLeafletApi({ default: api })).toBe(api);
  });

  it('keeps a direct Leaflet module unchanged', () => {
    const api = { map: vi.fn() } as unknown as typeof import('leaflet');

    expect(resolveLeafletApi(api)).toBe(api);
  });

  it('keeps a completed tile failure visible instead of clearing it on load', () => {
    expect(tileLoadHasFailed(1, 0)).toBe(true);
    expect(tileLoadHasFailed(3, 5)).toBe(true);
    expect(tileLoadHasFailed(2, 5)).toBe(false);
    expect(tileLoadHasFailed(0, 0)).toBe(false);
  });

  it('initializes the real browser bundle with resilient tiles and accessible markers', async () => {
    await TestBed.configureTestingModule({
      imports: [InteractiveMap],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: RuntimeConfigService,
          useValue: {
            maps: {
              tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              attribution: '© OpenStreetMap contributors',
              maxZoom: 18,
              smallCountThreshold: 5,
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(InteractiveMap);
    const report: Report = {
      name: 'CIS Puerto Cortés',
      code: 'QA-01',
      status: 'Aprobado',
      total: 14,
      newCases: 9,
      controls: 5,
      alerts: 0,
      sent: 'Hoy',
      latitude: 15.82,
      longitude: -87.92,
      coordinatesValidated: true,
    };
    const invalidCoordinatesReport: Report = {
      ...report,
      name: 'Ubicación inválida',
      code: 'QA-02',
      latitude: 91,
    };
    const selected = vi.fn();
    fixture.componentInstance.reportSelected.subscribe(selected);
    fixture.componentRef.setInput('reports', [report, invalidCoordinatesReport]);
    fixture.componentRef.setInput('level', 'national');
    fixture.componentRef.setInput('metric', 'total');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('.leaflet-host')?.classList).toContain('leaflet-container');
    });
    expect(host.textContent).not.toContain('No fue posible inicializar el mapa geográfico.');
    expect(host.textContent).toContain('Sin ubicación');
    expect(host.querySelector('.leaflet-host')?.getAttribute('aria-label')).toBe(
      'Mapa interactivo de indicadores ITS',
    );

    const marker = host.querySelector<HTMLElement>('.leaflet-marker-icon');
    expect(marker?.getAttribute('aria-label')).toBe('CIS Puerto Cortés: Casos totales 14');
    marker?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selected).toHaveBeenCalledWith(report);

    const tileLayer = (
      fixture.componentInstance as unknown as {
        tileLayer?: TileLayer;
      }
    ).tileLayer;
    expect(tileLayer).toBeDefined();
    tileLayer?.fire('loading');
    tileLayer?.fire('tileerror');
    tileLayer?.fire('tileerror');
    tileLayer?.fire('tileerror');
    tileLayer?.fire('load');
    fixture.detectChanges();
    expect(host.textContent).toContain('El proveedor cartográfico no respondió.');

    tileLayer?.fire('loading');
    tileLayer?.fire('tileload');
    tileLayer?.fire('load');
    fixture.detectChanges();
    expect(host.textContent).not.toContain('El proveedor cartográfico no respondió.');
    fixture.destroy();
  });
});
