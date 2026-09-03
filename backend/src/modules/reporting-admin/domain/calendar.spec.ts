import { annualCalendar, coversMonth, PeriodAdministrationError } from './calendar';

describe('Annual reporting calendar', () => {
  it('creates twelve blocked-month date ranges and OPS Sunday-to-Saturday weeks', () => {
    const calendar = annualCalendar(2026);
    expect(calendar.months).toHaveLength(12);
    expect(calendar.months[1]).toMatchObject({
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-02-28T00:00:00.000Z'),
    });
    const weekOne = calendar.weeks.find((week) => week.year === 2026 && week.weekNumber === 1);
    expect(weekOne).toEqual({
      year: 2026,
      weekNumber: 1,
      startDate: new Date('2026-01-04T00:00:00.000Z'),
      endDate: new Date('2026-01-10T00:00:00.000Z'),
    });
    expect(new Set(calendar.weeks.map((week) => `${week.year}-${week.weekNumber}`)).size).toBe(
      calendar.weeks.length,
    );
    expect(calendar.weeks.every((week) => week.startDate.getUTCDay() === 0)).toBe(true);
    expect(calendar.weeks.every((week) => week.endDate.getUTCDay() === 6)).toBe(true);
  });

  it('uses the correct leap-day boundary', () => {
    expect(annualCalendar(2028).months[1]?.endDate).toEqual(new Date('2028-02-29T00:00:00.000Z'));
  });

  it('detects gaps and inactive epidemiological weeks', () => {
    const { months, weeks } = annualCalendar(2026);
    const january = months[0]!;
    const coverage = weeks.map((week) => ({ ...week, active: week.weekNumber !== 2 }));
    expect(coversMonth(january.startDate, january.endDate, coverage)).toBe(false);
    expect(
      coversMonth(
        january.startDate,
        january.endDate,
        weeks.map((week) => ({ ...week, active: true })),
      ),
    ).toBe(true);
  });

  it('rejects years outside the supported institutional range', () => {
    expect(() => annualCalendar(2019)).toThrow(PeriodAdministrationError);
    expect(() => annualCalendar(2101)).toThrow(PeriodAdministrationError);
  });
});
