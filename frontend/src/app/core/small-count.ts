export function formatSmallCount(value: number, threshold: number): string {
  if (threshold > 0 && value > 0 && value < threshold) return `<${threshold}`;
  return String(value);
}

export function formatSuppressedCount(
  value: number,
  threshold: number,
  suppressed: boolean,
): string {
  if (suppressed) return threshold > 0 ? `<${threshold}` : 'Protegido';
  return String(value);
}
