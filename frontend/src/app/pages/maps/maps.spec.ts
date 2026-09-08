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

  const regionId = '11111111-1111-4111-8111-111111111111';
  const municipalityId = '22222222-2222-4222-8222-222222222222';

  function response(level: TerritorialAnalyticsLevel): TerritorialAnalyticsResponse {
    const common = {
      status: 'APROBADO_CENTRAL',
      reportVersion: 1,
      newCases: 8,
      controls: 5,
      alerts: 0,
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
                attentions: null,
                suppressedMetrics: ['attentions'] as const,
              },
            ];
    return {
      level,
      year: 2026,
      month: 8,
      privacy: { smallCountThreshold: 5, suppressedValue: null },
      rows: rows as TerritorialAnalyticsResponse['rows'],
    };
  }

  beforeEach(async () => {
    getTerritorialAnalytics = vi.fn((level: TerritorialAnalyticsLevel) => of(response(level)));
    isDemo = vi.fn(() => false);
    await TestBed.configureTestingModule({
      imports: [Maps],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: AuthService, useValue: { isDemo } },
        {
          provide: RoleContext,
          useValue: { activeRoleId: signal('central-validator') },
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
              smallCountThreshold: 5,
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

  it('renders a suppressed value and does not present it as zero in the total', async () => {
    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.ranking button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('.ranking b')?.textContent?.trim()).toBe('<5');
    expect(element.querySelectorAll('.map-kpis strong')[2]?.textContent?.trim()).toBe('Protegido');
  });

  it('renders a complementary-suppressed value as protected', async () => {
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

    expect(element.querySelector('.ranking b')?.textContent?.trim()).toBe('Protegido');
    expect(element.querySelectorAll('.map-kpis strong')[2]?.textContent?.trim()).toBe('Protegido');
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
