import { InvalidHealthNetworkError } from './health-network';

/** Civil dates are UTC date-only values. End dates are exclusive (the day removal takes effect). */
export function networkMembershipDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new InvalidHealthNetworkError('La fecha debe tener formato AAAA-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new InvalidHealthNetworkError('La fecha no es válida.');
  return date;
}
