import { normalizeReportingPeriods, reportingPeriodKey } from './operational-period';

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
