import { formatSmallCount } from './small-count';

describe('formatSmallCount', () => {
  it('suppresses positive counts below the configured threshold', () => {
    expect(formatSmallCount(1, 5)).toBe('<5');
    expect(formatSmallCount(4, 5)).toBe('<5');
    expect(formatSmallCount(5, 5)).toBe('5');
    expect(formatSmallCount(0, 5)).toBe('0');
  });

  it('shows exact values when suppression is disabled', () => {
    expect(formatSmallCount(3, 0)).toBe('3');
  });
});
