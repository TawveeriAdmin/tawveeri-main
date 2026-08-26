/**
 * isoWeekStart boundary tests (founder decision 2026-08-26: 24h hard-delete
 * expiry keeps only a weekly count, keyed by ISO week Monday-UTC start).
 */
import { isoWeekStart } from '@/lib/growth/demand-radar/weekly-stats';

describe('isoWeekStart', () => {
  it('a Monday maps to itself', () => {
    expect(isoWeekStart(new Date('2026-08-24T10:00:00Z'))).toBe('2026-08-24'); // Monday
  });
  it('a Sunday maps to the Monday that started its week', () => {
    expect(isoWeekStart(new Date('2026-08-30T23:59:00Z'))).toBe('2026-08-24'); // Sunday
  });
  it('a Saturday maps to the same-week Monday', () => {
    expect(isoWeekStart(new Date('2026-08-29T05:00:00Z'))).toBe('2026-08-24'); // Saturday
  });
  it('crosses a month boundary correctly', () => {
    expect(isoWeekStart(new Date('2026-09-01T00:00:00Z'))).toBe('2026-08-31'); // Tuesday -> Monday Aug 31
  });
  it('is stable across times of day on the same date', () => {
    const a = isoWeekStart(new Date('2026-08-26T00:00:01Z'));
    const b = isoWeekStart(new Date('2026-08-26T23:59:59Z'));
    expect(a).toBe(b);
  });
});
