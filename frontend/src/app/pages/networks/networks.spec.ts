import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  TerritorialApiService,
  TerritorialAuditEventRecord,
  TerritorialAuditPage,
} from '../../core/territorial-api.service';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
import { RoleContext } from '../../core/role-context';
import { Networks } from './networks';

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
