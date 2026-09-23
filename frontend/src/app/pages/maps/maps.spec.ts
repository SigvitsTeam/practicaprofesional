import { PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  ItsCaptureApiService,
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsResponse,
} from '../../core/its-capture-api.service';
import { OperationalPeriodService } from '../../core/operational-period';
import { RoleContext } from '../../core/role-context';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { Maps } from './maps';

describe('Maps hierarchical navigation and privacy', () => {
  let fixture: ComponentFixture<Maps>;
  let element: HTMLElement;
  let getTerritorialAnalytics: ReturnType<typeof vi.fn>;
  let isDemo: ReturnType<typeof vi.fn>;
  let activeRoleId: ReturnType<typeof signal<string>>;

  const regionId = '11111111-1111-4111-8111-111111111111';
  const municipalityId = '22222222-2222-4222-8222-222222222222';

  function response(level: TerritorialAnalyticsLevel): TerritorialAnalyticsResponse {
    const common = {
      status: 'APROBADO_CENTRAL',
      reportVersion: 1,
      newCases: 8,
      controls: 5,
      alerts: 0,
      dataStatus: 'PRELIMINAR',
      dataSource: 'ITS1',
      suppressedMetrics: [],
      complementarySuppressedMetrics: [],
    } as const;
    const rows =
      level === 'REGION'
        ? [
            {
              ...common,
              id: regionId,
              code: '05',
              name: 'Cortés',
              attentions: 12,
            },
          ]
        : level === 'MUNICIPIO'
          ? [
              {
                ...common,
                id: municipalityId,
                code: '0506',
                name: 'Puerto Cortés',
                attentions: 10,
              },
            ]
          : [
              {
                ...common,
                id: '33333333-3333-4333-8333-333333333333',
                code: '85481',
                name: 'CIS Linda Coello',
                attentions: 3,
                newCases: 2,
                controls: 1,
                suppressedMetrics: ['attentions', 'controls'] as const,
                complementarySuppressedMetrics: ['newCases'] as const,
              },
            ];
    return {
      level,
      year: 2026,
      month: 8,
      dataStatus: 'PRELIMINAR',
      dataSource: 'ITS1',
      notice: 'Datos preliminares acumulados automáticamente desde ITS 1.',
      privacy: { smallCountThreshold: 5, suppressedValue: null },
      rows: rows as TerritorialAnalyticsResponse['rows'],
    };
  }

  beforeEach(async () => {
    getTerritorialAnalytics = vi.fn((level: TerritorialAnalyticsLevel) => of(response(level)));
    isDemo = vi.fn(() => false);
    activeRoleId = signal('central-validator');
    await TestBed.configureTestingModule({
      imports: [Maps],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: AuthService, useValue: { isDemo } },
        {
          provide: RoleContext,
          useValue: { activeRoleId },
        },
        {
          provide: OperationalPeriodService,
          useValue: {
            selectedEndKey: signal('2026-08'),
            selected: signal({ year: 2026, month: 8 }),
          },
        },
        {
          provide: RuntimeConfigService,
          useValue: {
            maps: {
              tileUrl: 'https://tiles.example.test/{z}/{x}/{y}.png',
              attribution: 'QA',
              maxZoom: 18,
            },
          },
        },
        { provide: ItsCaptureApiService, useValue: { getTerritorialAnalytics } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Maps);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('sends the selected region and municipality as the parent of each drill-down', async () => {
    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getTerritorialAnalytics).toHaveBeenLastCalledWith('MUNICIPIO', 2026, 8, {
      regionId,
    });
    expect(element.textContent).toContain('Cortés · seleccione un municipio');

    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getTerritorialAnalytics).toHaveBeenLastCalledWith('ESTABLECIMIENTO', 2026, 8, {
      municipalityId,
    });
    expect(element.textContent).toContain('Puerto Cortés · datos agregados');
  });

  it('clears the child parent when navigating back up', async () => {
    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.map-navigation button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getTerritorialAnalytics).toHaveBeenLastCalledWith('MUNICIPIO', 2026, 8, {
      regionId,
    });

    element.querySelector<HTMLButtonElement>('.map-navigation button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getTerritorialAnalytics).toHaveBeenLastCalledWith('REGION', 2026, 8, undefined);
  });

  it('renders exact ITS 2 counts below five in the ranking and total', async () => {
    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('.ranking b')?.textContent?.trim()).toBe('3');
    expect(element.querySelectorAll('.map-kpis strong')[2]?.textContent?.trim()).toBe('3');
    expect(element.textContent).not.toContain('<5');
    expect(element.textContent).not.toContain('Protegido');

    element.querySelector<HTMLSelectElement>('.map-filters select')!.value = 'controls';
    element
      .querySelector<HTMLSelectElement>('.map-filters select')!
      .dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelector('.ranking b')?.textContent?.trim()).toBe('1');
    expect(element.querySelectorAll('.map-kpis strong')[2]?.textContent?.trim()).toBe('1');
  });

  it('identifies the ITS 1 aggregation as preliminary', () => {
    expect(element.textContent).toContain('PRELIMINAR · Fuente ITS 1');
    expect(element.textContent).toContain(
      'Datos preliminares acumulados automáticamente desde ITS 1.',
    );
  });

  it('does not describe officially closed data as preliminary', () => {
    getTerritorialAnalytics.mockImplementation((level: TerritorialAnalyticsLevel) => {
      const result = response(level);
      return of({
        ...result,
        dataStatus: 'OFICIAL' as const,
        notice: 'Datos oficiales del período cerrado.',
        rows: result.rows.map((row) => ({ ...row, dataStatus: 'OFICIAL' as const })),
      });
    });

    fixture.componentInstance.retryLoad();
    fixture.detectChanges();

    expect(element.textContent).toContain('OFICIAL · Fuente ITS 1');
    expect(element.textContent).toContain(
      'Los datos corresponden al período cerrado oficialmente.',
    );
    expect(element.textContent).not.toContain('Los datos preliminares pueden cambiar');
  });

  it.each(['superadmin', 'regional-superadmin'])(
    'does not request or render case information for %s',
    async (roleId) => {
      const callsBeforeRoleChange = getTerritorialAnalytics.mock.calls.length;
      activeRoleId.set(roleId);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(getTerritorialAnalytics).toHaveBeenCalledTimes(callsBeforeRoleChange);
      expect(element.textContent).toContain('ALCANCE ADMINISTRATIVO');
      expect(element.textContent).not.toContain('Casos totales');
    },
  );

  it('does not misrepresent a null response from an older API as zero', async () => {
    getTerritorialAnalytics.mockImplementation((level: TerritorialAnalyticsLevel) => {
      const result = response(level);
      if (level === 'ESTABLECIMIENTO') {
        result.rows[0] = {
          ...result.rows[0],
          attentions: null,
          suppressedMetrics: [],
          complementarySuppressedMetrics: ['attentions'],
        };
      }
      return of(result);
    });

    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('.ranking b')?.textContent?.trim()).toBe('—');
    expect(element.querySelectorAll('.map-kpis strong')[2]?.textContent?.trim()).toBe('—');
  });

  it('does not show Cortés municipalities after selecting another demo region', async () => {
    isDemo.mockReturnValue(true);
    const atlantida = fixture.componentInstance.reports.find((report) =>
      report.name.includes('Atlántida'),
    );
    expect(atlantida).toBeDefined();
    fixture.componentInstance.selectMapEntity(atlantida!);

    expect(fixture.componentInstance.reports).toEqual([]);
    expect(fixture.componentInstance.scopeLabel).toBe('Región Sanitaria de Atlántida');
  });
});
