import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ExportJobsApiService } from '../../core/export-jobs-api.service';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
import { OperationalPeriodService } from '../../core/operational-period';
import { RoleContext } from '../../core/role-context';
import { Consolidated } from './consolidated';

describe('Consolidated preliminary ITS 1 summary', () => {
  let fixture: ComponentFixture<Consolidated>;
  let element: HTMLElement;
  let createExport: ReturnType<typeof vi.fn>;
  let getTerritorialAnalytics: ReturnType<typeof vi.fn>;
  let closeNationalConsolidation: ReturnType<typeof vi.fn>;
  let reopenNationalConsolidation: ReturnType<typeof vi.fn>;
  let activeRoleId: ReturnType<typeof signal<string>>;

  beforeEach(async () => {
    createExport = vi.fn(() =>
      of({
        id: 'job-1',
        reportType: 'MUNICIPAL_CONSOLIDATED',
        format: 'XLSX',
        scopeLevel: 'MUNICIPIO',
        territoryId: 'municipality-1',
        year: 2026,
        month: 8,
        status: 'PENDIENTE',
        attempts: 0,
        outputAvailable: false,
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
      }),
    );
    activeRoleId = signal('municipal-coordinator');
    getTerritorialAnalytics = vi.fn(() =>
      of({
        level: 'ESTABLECIMIENTO',
        year: 2026,
        month: 8,
        municipalityId: 'municipality-1',
        dataStatus: 'PRELIMINAR',
        dataSource: 'ITS1',
        notice: 'Datos preliminares pendientes de depuración y aprobación.',
        privacy: { smallCountThreshold: 5, suppressedValue: null },
        rows: [
          {
            id: 'facility-1',
            code: '85481',
            name: 'CIS Linda Coello',
            status: 'BORRADOR',
            dataStatus: 'PRELIMINAR',
            dataSource: 'ITS1',
            attentions: 14,
            newCases: 9,
            controls: 5,
            alerts: 0,
            suppressedMetrics: [],
            complementarySuppressedMetrics: [],
          },
        ],
      }),
    );
    closeNationalConsolidation = vi.fn(() => of({ id: 'national-1' }));
    reopenNationalConsolidation = vi.fn(() => of({ id: 'national-1' }));
    await TestBed.configureTestingModule({
      imports: [Consolidated],
      providers: [
        { provide: AuthService, useValue: { isDemo: () => false } },
        {
          provide: RoleContext,
          useValue: { activeRoleId },
        },
        {
          provide: OperationalPeriodService,
          useValue: {
            selectedEndKey: signal('2026-08'),
            selected: signal({ year: 2026, month: 8, label: 'Agosto 2026' }),
          },
        },
        { provide: ExportJobsApiService, useValue: { create: createExport } },
        {
          provide: ItsCaptureApiService,
          useValue: {
            getMunicipalConsolidationContext: () =>
              of({
                municipalities: [
                  {
                    id: 'municipality-1',
                    code: '0506',
                    name: 'Puerto Cortés',
                    regionId: 'region-1',
                    activeFacilities: 1,
                  },
                ],
              }),
            getMunicipalIts2Inbox: () => of([]),
            getCurrentMunicipalConsolidation: () => of(null),
            getTerritorialAnalytics,
            closeNationalConsolidation,
            reopenNationalConsolidation,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Consolidated);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows ITS 1 totals even when no formal consolidation exists', () => {
    expect(element.textContent).toContain('PRELIMINAR · FUENTE ITS 1');
    expect(element.textContent).toContain(
      'Datos preliminares pendientes de depuración y aprobación.',
    );
    expect(element.querySelector('.summary-card > strong')?.textContent?.trim()).toBe('14');
    expect(element.textContent).toContain('Preparar consolidado municipal');
  });

  it('queues the preliminary workbook without requiring a formal consolidation', () => {
    const navigation = vi.fn();
    fixture.componentInstance.navigate.subscribe(navigation);
    element.querySelector<HTMLButtonElement>('.download-actions button')?.click();

    expect(createExport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: 'MUNICIPAL_CONSOLIDATED',
        format: 'XLSX',
        scopeLevel: 'MUNICIPIO',
        territoryId: 'municipality-1',
        year: 2026,
        month: 8,
      }),
    );
    expect(navigation).toHaveBeenCalledWith('Reportes y exportaciones');
  });

  it.each(['superadmin', 'regional-superadmin'])(
    'does not load or render clinical consolidation data for %s',
    async (roleId) => {
      const callsBeforeRoleChange = getTerritorialAnalytics.mock.calls.length;
      activeRoleId.set(roleId);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(getTerritorialAnalytics).toHaveBeenCalledTimes(callsBeforeRoleChange);
      expect(element.textContent).toContain('ALCANCE ADMINISTRATIVO');
      expect(element.querySelector('.summary-card')).toBeNull();
    },
  );

  it('reloads analytics after closing and reopening the national period', () => {
    const component = fixture.componentInstance as unknown as {
      nationalConsolidation: { set: (value: unknown) => void };
    };
    const reload = vi
      .spyOn(fixture.componentInstance, 'reload')
      .mockImplementation(() => undefined);
    component.nationalConsolidation.set({ id: 'national-1' });

    fixture.componentInstance.closeNational('Cierre oficial verificado');
    expect(closeNationalConsolidation).toHaveBeenCalledWith(
      'national-1',
      'Cierre oficial verificado',
    );
    expect(reload).toHaveBeenCalledTimes(1);

    component.nationalConsolidation.set({ id: 'national-1' });
    fixture.componentInstance.reopenNational('Corrección institucional requerida');
    expect(reopenNationalConsolidation).toHaveBeenCalledWith(
      'national-1',
      'Corrección institucional requerida',
    );
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
