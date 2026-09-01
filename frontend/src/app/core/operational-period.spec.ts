import { normalizeReportingPeriods, reportingPeriodKey } from './operational-period';
import { OperationalPeriodService } from './operational-period';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import {
  ItsCaptureApiService,
  type MonthlyReportingPeriodResponse,
} from './its-capture-api.service';

describe('operational period helpers', () => {
  it('normalizes and orders monthly periods chronologically', () => {
    const periods = normalizeReportingPeriods([
      {
        id: '2',
        year: 2026,
        month: 8,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'ABIERTO',
      },
      {
        id: '1',
        year: 2026,
        month: 7,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        status: 'CERRADO',
      },
    ]);

    expect(periods.map((period) => period.key)).toEqual(['2026-07', '2026-08']);
    expect(periods[1]?.label).toContain('agosto');
  });

  it('uses stable sortable keys', () => {
    expect(reportingPeriodKey(2026, 2)).toBe('2026-02');
  });
});

describe('OperationalPeriodService', () => {
  const catalog: MonthlyReportingPeriodResponse[] = [
    {
      id: 'jul',
      year: 2026,
      month: 7,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      status: 'CERRADO',
    },
    {
      id: 'aug',
      year: 2026,
      month: 8,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'ABIERTO',
    },
    {
      id: 'sep',
      year: 2026,
      month: 9,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      status: 'ABIERTO',
    },
  ];
  const getMonthlyReportingPeriods = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    getMonthlyReportingPeriods.mockReturnValue(of(catalog));
    TestBed.configureTestingModule({
      providers: [{ provide: ItsCaptureApiService, useValue: { getMonthlyReportingPeriods } }],
    });
  });
  afterEach(() => vi.useRealTimers());

  it('selects the current open period instead of a future open period', async () => {
    const service = TestBed.inject(OperationalPeriodService);
    await firstValueFrom(service.load());
    expect(service.selected()?.key).toBe('2026-08');
  });

  it('keeps valid ranges and ignores keys outside the institutional catalog', async () => {
    const service = TestBed.inject(OperationalPeriodService);
    await firstValueFrom(service.load());
    service.selectEnd('2026-07');
    expect(service.selectedStartKey()).toBe('2026-07');
    service.selectEnd('2099-12');
    expect(service.selected()?.key).toBe('2026-07');
    service.selectStart('2026-09');
    expect(service.selected()?.key).toBe('2026-09');
  });

  it('fails closed when the database has no valid monthly periods', async () => {
    getMonthlyReportingPeriods.mockReturnValue(of([]));
    const service = TestBed.inject(OperationalPeriodService);
    await expect(firstValueFrom(service.load())).rejects.toThrow('No existen períodos');
    expect(service.selected()).toBeUndefined();
  });

  it('limits a stalled catalog request to ten seconds', async () => {
    const { NEVER } = await import('rxjs');
    getMonthlyReportingPeriods.mockReturnValue(NEVER);
    const result = firstValueFrom(TestBed.inject(OperationalPeriodService).load());
    const rejection = expect(result).rejects.toThrow('Timeout');
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
  });
});
