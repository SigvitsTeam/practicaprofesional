export const HONDURAS_TIME_ZONE = 'America/Tegucigalpa';

export interface HondurasDateParts {
  year: number;
  month: number;
  day: number;
}

export function hondurasDateParts(value: Date = new Date()): HondurasDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HONDURAS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

export function hondurasTodayIso(value: Date = new Date()): string {
  const { year, month, day } = hondurasDateParts(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatHondurasDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: HONDURAS_TIME_ZONE,
  }).format(typeof value === 'string' ? new Date(value) : value);
}

export function formatHondurasDate(value: string | Date): string {
  const parsed = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: HONDURAS_TIME_ZONE,
  }).format(parsed);
}

export function formatHondurasMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat('es-HN', {
    month: 'long',
    year: 'numeric',
    timeZone: HONDURAS_TIME_ZONE,
  }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
}
