import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { signal } from '@angular/core';
import {
  TerritorialApiService,
  TerritorialAuditEventRecord,
  TerritorialAuditPage,
  HealthNetworkRecord,
} from '../../core/territorial-api.service';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
import { RoleContext } from '../../core/role-context';
import { Networks } from './networks';
import { OperationalPeriodService } from '../../core/operational-period';

interface NetworkHarness {
  networks: {
    id: string;
    regionId: string;
    regionName: string;
    code: string;
    name: string;
    municipalities: number;
    reports: string;
    total: number;
    status: string;
    rawStatus: string;
    active: boolean;
    configured: boolean;
    memberIds: string[];
    updatedAt: string;
  }[];
  history: TerritorialAuditEventRecord[];
  historyLoading: boolean;
}

describe('Networks history', () => {
  it('ignores a stale history response after selecting another network', async () => {
    const first = new Subject<TerritorialAuditPage>();
    const second = new Subject<TerritorialAuditPage>();
    const listNetworkAudit = vi.fn((networkId: string) =>
      networkId === 'network-1' ? first : second,
    );
    await TestBed.configureTestingModule({
      imports: [Networks],
      providers: [
        { provide: TerritorialApiService, useValue: { listNetworkAudit } },
        { provide: ItsCaptureApiService, useValue: {} },
      ],
    }).compileComponents();
    TestBed.inject(RoleContext).select('regional-admin');
    const fixture = TestBed.createComponent(Networks);
    const component = fixture.componentInstance;
    const harness = component as unknown as NetworkHarness;
    const base = {
      regionId: 'region-1',
      regionName: 'Cortés',
      municipalities: 0,
      reports: '—',
      total: 0,
      status: 'Activa',
      rawStatus: 'ACTIVO',
      active: true,
      configured: true,
      memberIds: [],
      updatedAt: '2026-08-27T12:00:00.000Z',
    };
    harness.networks = [
      { ...base, id: 'network-1', code: 'R1', name: 'Red uno' },
      { ...base, id: 'network-2', code: 'R2', name: 'Red dos' },
    ];

    component.selectNetwork('network-1');
    component.selectNetwork('network-2');
    first.next({
      items: [
        {
          id: 'old-event',
          action: 'HEALTH_NETWORK_CREATED',
          entity: 'network-1',
          createdAt: '2026-08-27T12:00:00.000Z',
        },
      ],
    });

    expect(harness.history).toEqual([]);
    expect(harness.historyLoading).toBe(true);

    second.next({
      items: [
        {
          id: 'current-event',
          action: 'HEALTH_NETWORK_STATUS_CHANGED',
          entity: 'network-2',
          createdAt: '2026-08-27T13:00:00.000Z',
        },
      ],
    });
    second.complete();

    expect(harness.history.map((event) => event.id)).toEqual(['current-event']);
    expect(harness.historyLoading).toBe(false);
  });
});

describe('Networks monthly view', () => {
  const network: HealthNetworkRecord = {
    id: 'network-1',
    regionId: 'region-1',
    regionName: 'Cortés',
    code: 'R1',
    name: 'Red QA',
    operationalStatus: 'ACTIVO',
    startDate: '2026-08-01',
    active: true,
    updatedAt: '2026-09-04T12:00:00Z',
    scopeLimited: true,
    municipalities: [
      { id: 'municipality-1', code: '0506', name: 'Puerto Cortés', startDate: '2026-08-01' },
    ],
  };
  const selected = signal({ year: 2026, month: 8 });
  const selectedEndKey = signal('2026-08');
  let listNetworks: ReturnType<typeof vi.fn>;
  const catalog = {
    municipalities: [
      {
        id: 'municipality-1',
        regionId: 'region-1',
        officialCode: '0506',
        name: 'Puerto Cortés',
        facilityCount: 12,
      },
    ],
    facilities: [],
  };
  beforeEach(async () => {
    selected.set({ year: 2026, month: 8 });
    selectedEndKey.set('2026-08');
    listNetworks = vi.fn(() => of([network]));
    await TestBed.configureTestingModule({
      imports: [Networks],
      providers: [
        { provide: OperationalPeriodService, useValue: { selected, selectedEndKey } },
        {
          provide: TerritorialApiService,
          useValue: {
            listNetworks,
            listCatalog: () => of(catalog),
            listRegions: () => of([]),
            listNetworkAudit: () => of({ items: [] }),
          },
        },
        {
          provide: ItsCaptureApiService,
          useValue: {
            getTerritorialAnalytics: () =>
              of({
                rows: [
                  {
                    id: 'municipality-1',
                    attentions: 10,
                    newCases: 8,
                    controls: 2,
                    alerts: 0,
                    reportId: 'report-1',
                  },
                ],
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders delayed data without a click and shows the limited municipal scope', async () => {
    const pending = new Subject<HealthNetworkRecord[]>();
    listNetworks.mockReturnValue(pending);
    const fixture = TestBed.createComponent(Networks);
    fixture.detectChanges();
    expect(listNetworks).toHaveBeenCalledExactlyOnceWith('2026-08-31');
    expect(fixture.nativeElement.textContent).toContain('Cargando Redes');
    pending.next([network]);
    pending.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Red QA');
    expect(fixture.nativeElement.textContent).toContain('Vista limitada a sus municipios');
    expect(fixture.nativeElement.textContent).not.toContain('Cargando Redes');
    expect(fixture.nativeElement.textContent).not.toContain('Guardar asociaciones');
    expect(fixture.componentInstance.selectedNetworkReports).toBe(1);
  });

  it('does not replace a new period with an older in-flight response', async () => {
    const old = new Subject<HealthNetworkRecord[]>();
    listNetworks.mockReturnValueOnce(old);
    const fixture = TestBed.createComponent(Networks);
    fixture.detectChanges();
    selected.set({ year: 2026, month: 9 });
    selectedEndKey.set('2026-09');
    await fixture.whenStable();
    expect(listNetworks).toHaveBeenLastCalledWith('2026-09-30');
    old.next([{ ...network, name: 'RESPUESTA OBSOLETA' }]);
    old.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('RESPUESTA OBSOLETA');
    expect(fixture.nativeElement.textContent).toContain('Red QA');
  });

  it('clears the previous month when a reload fails', async () => {
    const fixture = TestBed.createComponent(Networks);
    fixture.detectChanges();
    await fixture.whenStable();
    const pending = new Subject<HealthNetworkRecord[]>();
    listNetworks.mockReturnValue(pending);
    selected.set({ year: 2026, month: 9 });
    selectedEndKey.set('2026-09');
    await fixture.whenStable();
    pending.error(new Error('offline'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Red QA');
    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar');
  });

  it('keeps historical composition separate from the current administrative draft', async () => {
    TestBed.inject(RoleContext).select('regional-superadmin');
    listNetworks.mockImplementation((asOf?: string) =>
      of([{ ...network, scopeLimited: false, municipalities: asOf ? network.municipalities : [] }]),
    );
    const fixture = TestBed.createComponent(Networks);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(listNetworks).toHaveBeenCalledWith('2026-08-31');
    expect(listNetworks).toHaveBeenCalledWith();
    expect(fixture.componentInstance.associatedMunicipalities).toHaveLength(1);
    const harness = fixture.componentInstance as unknown as { draftMembershipIds: string[] };
    expect(harness.draftMembershipIds).toEqual([]);
  });

  it('cancels pending reads when the page is destroyed', () => {
    const pending = new Subject<HealthNetworkRecord[]>();
    listNetworks.mockReturnValue(pending);
    const fixture = TestBed.createComponent(Networks);
    fixture.detectChanges();
    expect(pending.observed).toBe(true);
    fixture.destroy();
    expect(pending.observed).toBe(false);
  });
});
