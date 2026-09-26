// tests/compare/availability-three-states.test.ts — ADR-389 §6.
// Three distinct states, everywhere: in stock at last observation / out of stock at last
// observation / not stated. "Not stated" is neither a stock-out nor a confirmation; it may
// take part in the price comparison (the shared rule excludes only explicit out_of_stock).
import { availabilityLabelFor } from '@/lib/compare/observed-label';
import { exclusionReasonFor } from '@/lib/compare/offer-eligibility';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe('availabilityLabelFor — three states', () => {
  it('in stock, fresh → «متوفر»; stale → «متوفر بحسب آخر رصد»', () => {
    expect(availabilityLabelFor('in_stock', false, true)).toEqual({ text: 'متوفر', tone: 'ok' });
    expect(availabilityLabelFor('in_stock', true, true)).toEqual({ text: 'متوفر بحسب آخر رصد', tone: 'muted' });
  });
  it('out of stock → «غير متوفر عند آخر رصد»', () => {
    expect(availabilityLabelFor('out_of_stock', false, true)?.text).toBe('غير متوفر عند آخر رصد');
    expect(availabilityLabelFor('out_of_stock', false, true)?.tone).toBe('bad');
  });
  it('not stated (null/undefined/unknown string) → «التوفر غير مذكور عند آخر رصد», never «متوفر»', () => {
    for (const v of [null, undefined, '', 'unknown']) {
      const l = availabilityLabelFor(v as string | null | undefined, false, true);
      expect(l?.text).toBe('التوفر غير مذكور عند آخر رصد');
      expect(l?.tone).toBe('muted');
    }
    expect(availabilityLabelFor(null, false, false)?.text).toBe('Availability not stated at last observation');
  });
});

describe('eligibility — not stated ≠ out of stock', () => {
  it('a fresh offer with no availability statement is eligible; an explicit stock-out is not', () => {
    expect(exclusionReasonFor({ price: 3669, availability: null, observed_at: daysAgo(2) }, NOW)).toBeNull();
    expect(exclusionReasonFor({ price: 3669, availability: 'out_of_stock', observed_at: daysAgo(2) }, NOW)).toBe('out_of_stock');
  });
  it('a stale offer with no availability statement is excluded for staleness, not stock', () => {
    expect(exclusionReasonFor({ price: 2949, availability: null, observed_at: daysAgo(12) }, NOW)).toBe('stale');
  });
});
