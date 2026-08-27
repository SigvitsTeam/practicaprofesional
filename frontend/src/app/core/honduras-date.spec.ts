import { formatHondurasDateTime, hondurasDateParts, hondurasTodayIso } from './honduras-date';

describe('Honduras date helpers', () => {
  it('uses the Honduras calendar date at a UTC boundary', () => {
    const instant = new Date('2026-08-27T03:30:00.000Z');

    expect(hondurasDateParts(instant)).toEqual({ year: 2026, month: 8, day: 26 });
    expect(hondurasTodayIso(instant)).toBe('2026-08-26');
  });

  it('formats audit timestamps in Honduras local time', () => {
    expect(formatHondurasDateTime('2026-08-27T03:30:00.000Z')).toContain('26 ago 2026');
  });
});
