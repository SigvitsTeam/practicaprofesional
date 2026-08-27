export function formatSmallCount(value: number, threshold: number): string {
  if (threshold > 0 && value > 0 && value < threshold) return `<${threshold}`;
  return String(value);
}
