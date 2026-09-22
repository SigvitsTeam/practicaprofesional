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
  const periods = signal([
    {
      id: 'period-2026-07',
      year: 2026,
      month: 7,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      status: 'CERRADO' as const,
      key: '2026-07',
      label: 'julio de 2026',
    },
    {
      id: 'period-2026-08',
      year: 2026,
      month: 8,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'ABIERTO' as const,
      key: '2026-08',
      label: 'agosto de 2026',
    },
    {
      id: 'period-2026-09',
      year: 2026,
      month: 9,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      status: 'BLOQUEADO' as const,
      key: '2026-09',
      label: 'septiembre de 2026',
    },
  ]);
  const selectedPeriod = signal(periods()[1]);
  let create: ReturnType<typeof vi.fn>;
  let downloadJob: ReturnType<typeof vi.fn>;
  let downloadMonthlyReportXlsx: ReturnType<typeof vi.fn>;
  let getTerritorialAnalytics: ReturnType<typeof vi.fn>;
  let getEpidemiologicalWeeks: ReturnType<typeof vi.fn>;
  let activeRoleId: ReturnType<typeof signal<string>>;
  let effectiveScope: { level: string; territoryId?: string } | null;
  let demoMode: boolean;

  beforeEach(async () => {
    selectedPeriod.set(periods()[1]);
    analytics = new Subject<TerritorialAnalyticsResponse>();
    download = new Subject<Blob>();
    create = vi.fn(() => new Subject<ExportJobRecord>());
    downloadJob = vi.fn(() => of(new Blob(['xlsx'])));
    downloadMonthlyReportXlsx = vi.fn(() => download);
    getTerritorialAnalytics = vi.fn(() => analytics);
    getEpidemiologicalWeeks = vi.fn(() =>
      of([
        {
          id: 'week-31',
          year: 2026,
          weekNumber: 31,
          startDate: '2026-07-26T00:00:00.000Z',
          endDate: '2026-08-01T00:00:00.000Z',
          active: true,
          label: 'SE 31 · 26 jul–1 ago 2026',
        },
        {
          id: 'week-32',
          year: 2026,
          weekNumber: 32,
          startDate: '2026-08-02T00:00:00.000Z',
          endDate: '2026-08-08T00:00:00.000Z',
          active: true,
          label: 'SE 32 · 2–8 ago 2026',
        },
        {
          id: 'week-33',
          year: 2026,
          weekNumber: 33,
          startDate: '2026-08-09T00:00:00.000Z',
          endDate: '2026-08-15T00:00:00.000Z',
          active: true,
          label: 'SE 33 · 9–15 ago 2026',
        },
      ]),
    );
    activeRoleId = signal('municipal-coordinator');
    effectiveScope = null;
    demoMode = false;
    await TestBed.configureTestingModule({
      imports: [Exports],
      providers: [
        {
          provide: AuthService,
          useValue: { isDemo: () => demoMode, user: () => ({ name: 'QA' }) },
        },
        {
          provide: RoleContext,
          useValue: { activeRoleId, effectiveScope: () => effectiveScope },
        },
        {
          provide: OperationalPeriodService,
          useValue: { selected: selectedPeriod, periods },
        },
        {
          provide: ExportJobsApiService,
          useValue: { list: () => of([]), create, download: downloadJob },
        },
        {
          provide: ItsCaptureApiService,
          useValue: {
            getTerritorialAnalytics,
            downloadMonthlyReportXlsx,
            getEpidemiologicalWeeks,
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

  function exportButton(label: string) {
    const button = [...element.querySelectorAll<HTMLButtonElement>('.export-catalog button')].find(
      (candidate) => candidate.textContent?.includes(label),
    );
    if (!button) throw new Error(`Missing export action: ${label}`);
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
    selectedPeriod.set(periods()[2]);
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

  it('asks for and queues an inclusive monthly range without legacy year/month fields', () => {
    exportButton('Consolidado municipal').click();
    fixture.detectChanges();
    const dialog = element.querySelector<HTMLElement>('.municipal-export-dialog');
    expect(dialog?.textContent).toContain('Consolidado municipal ITS-2');
    expect(dialog?.textContent).toContain('agosto de 2026');

    selectedPeriod.set(periods()[2]);
    fixture.detectChanges();
    expect(dialog?.textContent).toContain('agosto de 2026');

    dialog?.querySelector<HTMLButtonElement>('footer .primary')?.click();

    const request = create.mock.calls[0]?.[0];
    expect(request).toEqual(
      expect.objectContaining({
        reportType: 'MUNICIPAL_CONSOLIDATED',
        format: 'XLSX',
        scopeLevel: 'MUNICIPIO',
        territoryId: 'municipality-1',
        parameters: {
          timeUnit: 'MONTH',
          startPeriod: '2026-08',
          endPeriod: '2026-08',
        },
      }),
    );
    expect(request).not.toHaveProperty('year');
    expect(request).not.toHaveProperty('month');
  });

  it('loads the institutional calendar and queues an inclusive epidemiological-week range', () => {
    exportButton('Consolidado municipal').click();
    fixture.detectChanges();
    const dialog = element.querySelector<HTMLElement>('.municipal-export-dialog')!;
    const weekly = dialog.querySelector<HTMLInputElement>('input[value="EPIDEMIOLOGICAL_WEEK"]')!;
    weekly.click();
    fixture.detectChanges();

    expect(getEpidemiologicalWeeks).toHaveBeenCalledWith(2026, 2026);
    expect(dialog.textContent).toContain('SE 31');
    expect(dialog.textContent).toContain('SE 33');
    dialog.querySelector<HTMLButtonElement>('footer .primary')?.click();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: 'MUNICIPAL_CONSOLIDATED',
        parameters: {
          timeUnit: 'EPIDEMIOLOGICAL_WEEK',
          startPeriod: '2026-W31',
          endPeriod: '2026-W33',
        },
      }),
    );
  });

  it('blocks an incomplete municipal range before calling the API', () => {
    exportButton('Consolidado municipal').click();
    fixture.detectChanges();
    const start = element.querySelector<HTMLSelectElement>(
      '[aria-label="Inicio del rango municipal"]',
    )!;
    start.value = '';
    start.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const generate = element.querySelector<HTMLButtonElement>(
      '.municipal-export-dialog footer .primary',
    )!;
    expect(generate.disabled).toBe(true);
    generate.click();
    expect(create).not.toHaveBeenCalled();
  });

  it('uses the same mandatory range dialog in demo mode before simulating generation', () => {
    demoMode = true;
    exportButton('Consolidado municipal').click();
    fixture.detectChanges();
    const dialog = element.querySelector<HTMLElement>('.municipal-export-dialog');

    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain('0506 · Puerto Cortés');
    dialog?.querySelector<HTMLButtonElement>('footer .primary')?.click();
    fixture.detectChanges();

    expect(create).not.toHaveBeenCalled();
    expect(element.querySelector('.municipal-export-dialog')).toBeNull();
  });

  it.each([
    ['regional-admin', null, 'Consolidados municipales'],
    ['supervisor', { level: 'MUNICIPIO', territoryId: 'municipality-1' }, 'Resumen municipal'],
  ] as const)(
    'routes %s municipal exports through the mandatory range dialog',
    (role, scope, label) => {
      effectiveScope = scope;
      activeRoleId.set(role);
      fixture.detectChanges();
      exportButton(label).click();
      fixture.detectChanges();

      expect(element.querySelector('.municipal-export-dialog')).toBeTruthy();
      expect(getTerritorialAnalytics).not.toHaveBeenCalled();
    },
  );

  it('labels queued municipal jobs with their normalized range parameters', () => {
    const component = fixture.componentInstance as unknown as {
      queue: { jobs: { set: (jobs: ExportJobRecord[]) => void } };
    };
    component.queue.jobs.set([
      {
        id: 'job-range',
        reportType: 'MUNICIPAL_CONSOLIDATED',
        format: 'XLSX',
        scopeLevel: 'MUNICIPIO',
        territoryId: 'municipality-1',
        year: 2026,
        month: 8,
        parameters: {
          timeUnit: 'EPIDEMIOLOGICAL_WEEK',
          startPeriod: '2026-W31',
          endPeriod: '2026-W33',
        },
        status: 'COMPLETADO',
        attempts: 1,
        outputAvailable: true,
        createdAt: '2026-08-31T12:00:00.000Z',
        updatedAt: '2026-08-31T12:01:00.000Z',
      },
    ]);
    fixture.detectChanges();

    expect(element.textContent).toContain('SE 31 de 2026 – SE 33 de 2026');
  });

  it('keeps the requested epidemiological-week range in the downloaded filename', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:municipal');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download;
    });
    const component = fixture.componentInstance as unknown as {
      queue: { jobs: { set: (jobs: ExportJobRecord[]) => void } };
    };
    component.queue.jobs.set([
      {
        id: 'job-week-range',
        reportType: 'MUNICIPAL_CONSOLIDATED',
        format: 'XLSX',
        scopeLevel: 'MUNICIPIO',
        territoryId: 'municipality-1',
        year: 2026,
        month: 1,
        parameters: {
          timeUnit: 'EPIDEMIOLOGICAL_WEEK',
          startPeriod: '2026-W01',
          endPeriod: '2026-W08',
        },
        status: 'COMPLETADO',
        attempts: 1,
        outputAvailable: true,
        createdAt: '2026-02-28T12:00:00.000Z',
        updatedAt: '2026-02-28T12:01:00.000Z',
      },
    ]);
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.download')?.click();

    expect(downloadJob).toHaveBeenCalledWith('job-week-range');
    expect(filename).toBe('SIGVITS-MUNICIPAL_CONSOLIDATED-SE-2026-W01_a_2026-W08.xlsx');
  });

  it('does not infer a role-based scope when a loaded institutional profile has no grant', () => {
    const roleContext = TestBed.inject(RoleContext) as unknown as {
      effectiveScope?: () => null;
      institutionalProfile?: () => object;
    };
    roleContext.effectiveScope = () => null;
    roleContext.institutionalProfile = () => ({ territory: {} });

    const component = fixture.componentInstance as unknown as {
      currentScope: () => { level: string; territoryId?: string } | null;
    };

    expect(component.currentScope()).toBeNull();
  });

  it.each(['superadmin', 'regional-superadmin'])(
    'does not render export controls or jobs for %s',
    (roleId) => {
      activeRoleId.set(roleId);
      fixture.detectChanges();

      expect(element.textContent).toContain('ALCANCE ADMINISTRATIVO');
      expect(element.textContent).not.toContain('Trabajos de exportación recientes');
      expect(element.querySelector('.export-catalog')).toBeNull();
    },
  );
});
