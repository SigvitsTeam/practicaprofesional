import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ExportJobRecord, ExportJobsApiService } from '../../core/export-jobs-api.service';
import {
  ItsCaptureApiService,
  TerritorialAnalyticsResponse,
} from '../../core/its-capture-api.service';
import { OperationalPeriodService } from '../../core/operational-period';
import { RoleContext } from '../../core/role-context';
import { Exports } from './exports';

describe('Exports request lifecycle', () => {
  let fixture: ComponentFixture<Exports>;
  let element: HTMLElement;
  let analytics: Subject<TerritorialAnalyticsResponse>;
  let download: Subject<Blob>;
  const selectedPeriod = signal({ year: 2026, month: 8 });
  let create: ReturnType<typeof vi.fn>;
  let downloadMonthlyReportXlsx: ReturnType<typeof vi.fn>;
  let prepareMunicipalConsolidation: ReturnType<typeof vi.fn>;
  let downloadMunicipalConsolidationXlsx: ReturnType<typeof vi.fn>;
  let getTerritorialAnalytics: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    selectedPeriod.set({ year: 2026, month: 8 });
    analytics = new Subject<TerritorialAnalyticsResponse>();
    download = new Subject<Blob>();
    create = vi.fn(() => new Subject<ExportJobRecord>());
    downloadMonthlyReportXlsx = vi.fn(() => download);
    prepareMunicipalConsolidation = vi.fn(() =>
      of({ municipality: { id: 'municipality-1', code: '0506', name: 'Puerto Cortés' } }),
    );
    downloadMunicipalConsolidationXlsx = vi.fn(() => of(new Blob(['municipal'])));
    getTerritorialAnalytics = vi.fn(() => analytics);
    await TestBed.configureTestingModule({
      imports: [Exports],
      providers: [
        { provide: AuthService, useValue: { isDemo: () => false, user: () => ({ name: 'QA' }) } },
        { provide: RoleContext, useValue: { activeRoleId: () => 'municipal-coordinator' } },
        { provide: OperationalPeriodService, useValue: { selected: selectedPeriod } },
        { provide: ExportJobsApiService, useValue: { list: () => of([]), create } },
        {
          provide: ItsCaptureApiService,
          useValue: {
            getTerritorialAnalytics,
            downloadMonthlyReportXlsx,
            getMunicipalConsolidationContext: () =>
              of({
                municipalities: [
                  {
                    id: 'municipality-1',
                    code: '0506',
                    name: 'Puerto Cortés',
                    regionId: 'region-1',
                    activeFacilities: 2,
                  },
                ],
              }),
            getCurrentMunicipalConsolidation: () => of(null),
            prepareMunicipalConsolidation,
            downloadMunicipalConsolidationXlsx,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Exports);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function scopedButton() {
    const button = element.querySelector<HTMLButtonElement>('.export-catalog button');
    if (!button) throw new Error('Missing scoped export action');
    return button;
  }

  function resolveTargets() {
    analytics.next({
      rows: [{ id: 'facility-1', code: '001', name: 'Centro autorizado' }],
    } as TerritorialAnalyticsResponse);
    analytics.complete();
    fixture.detectChanges();
  }

  it('shows and downloads the captured month even if the global period changes while loading targets', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:its2');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    scopedButton().click();
    expect(getTerritorialAnalytics).toHaveBeenCalledWith('ESTABLECIMIENTO', 2026, 8);
    selectedPeriod.set({ year: 2026, month: 9 });
    resolveTargets();
    const dialog = element.querySelector<HTMLElement>('.scoped-export-dialog');
    expect(dialog?.textContent).toContain('agosto');
    const generate = dialog?.querySelector<HTMLButtonElement>('footer .primary');
    generate?.click();
    expect(downloadMonthlyReportXlsx).toHaveBeenCalledWith('facility-1', 2026, 8);
    fixture.detectChanges();
    expect(generate?.disabled).toBe(true);
    generate?.click();
    expect(downloadMonthlyReportXlsx).toHaveBeenCalledTimes(1);
    download.next(new Blob(['xlsx']));
    download.complete();
    fixture.detectChanges();
    expect(element.querySelector('.scoped-export-dialog')).toBeNull();
  });

  it('cancels the scoped catalog request when leaving the page', () => {
    scopedButton().click();
    expect(analytics.observed).toBe(true);
    fixture.destroy();
    expect(analytics.observed).toBe(false);
  });

  it('cancels the direct download response subscription when leaving the page', () => {
    scopedButton().click();
    resolveTargets();
    element.querySelector<HTMLButtonElement>('.scoped-export-dialog footer .primary')?.click();
    expect(download.observed).toBe(true);
    fixture.destroy();
    expect(download.observed).toBe(false);
  });

  it('prepares and immediately downloads the municipal consolidation without using the queue', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:municipal');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const buttons = element.querySelectorAll<HTMLButtonElement>('.export-catalog button');
    buttons[1]?.click();
    fixture.detectChanges();
    const dialog = element.querySelector<HTMLElement>('.scoped-export-dialog');
    expect(dialog?.textContent).toContain('agosto');

    dialog?.querySelector<HTMLButtonElement>('footer .primary')?.click();

    expect(prepareMunicipalConsolidation).toHaveBeenCalledWith('municipality-1', 2026, 8);
    expect(downloadMunicipalConsolidationXlsx).toHaveBeenCalledWith('municipality-1', 2026, 8);
    expect(create).not.toHaveBeenCalled();
  });
});
