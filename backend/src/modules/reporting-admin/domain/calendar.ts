export const MIN_CALENDAR_YEAR = 2020;
export const MAX_CALENDAR_YEAR = 2100;
const DAY = 86_400_000;

export class PeriodAdministrationError extends Error {}
export class PeriodConflictError extends Error {}
export class PeriodNotFoundError extends Error {}
export class PeriodAccessError extends Error {}

export function validateCalendarYear(year: number): void {
  if (!Number.isInteger(year) || year < MIN_CALENDAR_YEAR || year > MAX_CALENDAR_YEAR)
    throw new PeriodAdministrationError('El año debe estar entre 2020 y 2100.');
}

export interface CalendarWeek {
  year: number;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
}

export interface CalendarMonth {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
}

export interface CalendarCreationResult {
  createdMonths: number;
  createdWeeks: number;
}

export interface PeriodVersion {
  id: string;
  updatedAt: Date;
}

export interface AnnualOpeningResult {
  openedMonths: number;
  alreadyOpenMonths: number;
  closedMonths: number;
}

// OPS: Sunday–Saturday; week 1 contains at least four days of January.
// https://www.paho.org/sites/default/files/2016-cha-calendario-epidemiologico.pdf
function firstWeek(year: number): number {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  return januaryFourth.getTime() - januaryFourth.getUTCDay() * DAY;
}

export function annualCalendar(year: number): { months: CalendarMonth[]; weeks: CalendarWeek[] } {
  validateCalendarYear(year);
  const months = Array.from({ length: 12 }, (_, i) => ({
    year,
    month: i + 1,
    startDate: new Date(Date.UTC(year, i, 1)),
    endDate: new Date(Date.UTC(year, i + 1, 0)),
  }));
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const weeks: CalendarWeek[] = [];
  for (
    let start = firstDay.getTime() - firstDay.getUTCDay() * DAY;
    start <= Date.UTC(year, 11, 31);
    start += 7 * DAY
  ) {
    const weekYear =
      start < firstWeek(year) ? year - 1 : start >= firstWeek(year + 1) ? year + 1 : year;
    weeks.push({
      year: weekYear,
      weekNumber: (start - firstWeek(weekYear)) / (7 * DAY) + 1,
      startDate: new Date(start),
      endDate: new Date(start + 6 * DAY),
    });
  }
  return { months, weeks };
}

export function coversMonth(
  start: Date,
  end: Date,
  weeks: readonly { startDate: Date; endDate: Date; active: boolean }[],
): boolean {
  let cursor = start.getTime();
  for (const week of [...weeks]
    .filter((w) => w.active)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())) {
    if (week.endDate.getTime() < cursor) continue;
    if (week.startDate.getTime() > cursor) return false;
    cursor = week.endDate.getTime() + DAY;
    if (cursor > end.getTime()) return true;
  }
  return false;
}

export interface ManagedPeriod {
  id: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: 'ABIERTO' | 'CERRADO' | 'BLOQUEADO';
  updatedAt: Date;
  calendarReady: boolean;
}

export interface PeriodAudit {
  id: string;
  action: string;
  reason: string | null;
  createdAt: Date;
  actorName: string | null;
}

export interface PeriodChangeContext {
  // Null only for explicitly authorized maintenance, never an impersonated app user.
  actorUserId: string | null;
  reason: string;
  requestId: string;
}
