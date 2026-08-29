/**
 * Radar 2.0 Phase 1 — formal KPI fixture tests (architecture doc §F).
 * Pure-function tests against synthetic demand_radar_outcomes-shaped rows —
 * no live database. Pins the exact numerator/denominator behavior the
 * founder specified: expiry is EXCLUDED from Founder Acceptance Precision
 * entirely, never treated as an implicit rejection.
 */
import {
  founderAcceptancePrecision,
  reviewCoverageRate,
  expiryRate,
  type PrecisionInput,
} from '@/lib/growth/demand-radar/kpi';

describe('Founder Acceptance Precision — formal definition (§F)', () => {
  it('numerator = accepted, denominator = accepted + rejected ONLY — expiry excluded from both', () => {
    const rows: PrecisionInput[] = [
      { tier: 'high', founderOutcome: 'accepted' },
      { tier: 'high', founderOutcome: 'accepted' },
      { tier: 'high', founderOutcome: 'accepted' },
      { tier: 'high', founderOutcome: 'rejected' },
      { tier: 'high', founderOutcome: 'expired_no_review' },
      { tier: 'high', founderOutcome: 'expired_no_review' },
      { tier: 'high', founderOutcome: 'expired_no_review' },
      { tier: 'high', founderOutcome: 'expired_no_review' },
      { tier: 'high', founderOutcome: null }, // no verdict yet at all
    ];
    const result = founderAcceptancePrecision(rows, 'high');
    // 3 accepted / (3 accepted + 1 rejected) = 0.75 — the 4 expired rows and
    // the 1 not-yet-reviewed row must NOT appear anywhere in this ratio.
    expect(result.precision).toBeCloseTo(0.75, 5);
    expect(result.accepted).toBe(3);
    expect(result.rejected).toBe(1);
    expect(result.reviewed).toBe(4);
    expect(result.expiredNoReview).toBe(4);
    expect(result.total).toBe(9);
  });

  it('returns null — never a fabricated 0% or 100% — when nothing has been reviewed yet', () => {
    const rows: PrecisionInput[] = [
      { tier: 'high', founderOutcome: 'expired_no_review' },
      { tier: 'high', founderOutcome: null },
    ];
    const result = founderAcceptancePrecision(rows, 'high');
    expect(result.precision).toBeNull();
    expect(result.reviewed).toBe(0);
  });

  it('returns null on a fully empty fixture (no data at all)', () => {
    const result = founderAcceptancePrecision([], 'high');
    expect(result.precision).toBeNull();
    expect(result.total).toBe(0);
  });

  it('is tier-scoped — MEDIUM rows never leak into the HIGH-tier ratio', () => {
    const rows: PrecisionInput[] = [
      { tier: 'high', founderOutcome: 'accepted' },
      { tier: 'medium', founderOutcome: 'rejected' },
      { tier: 'medium', founderOutcome: 'rejected' },
    ];
    const high = founderAcceptancePrecision(rows, 'high');
    expect(high.precision).toBe(1); // 1/1, the medium rejections must not count against it
    const medium = founderAcceptancePrecision(rows, 'medium');
    expect(medium.precision).toBe(0); // 0/2
  });

  it('unscoped (no tier arg) aggregates across all tiers', () => {
    const rows: PrecisionInput[] = [
      { tier: 'high', founderOutcome: 'accepted' },
      { tier: 'medium', founderOutcome: 'rejected' },
    ];
    const all = founderAcceptancePrecision(rows);
    expect(all.precision).toBeCloseTo(0.5, 5);
  });
});

describe('Review Coverage Rate and Expiry Rate — separate diagnostics, never folded into precision', () => {
  const rows: PrecisionInput[] = [
    { tier: 'high', founderOutcome: 'accepted' },
    { tier: 'high', founderOutcome: 'rejected' },
    { tier: 'high', founderOutcome: 'expired_no_review' },
    { tier: 'high', founderOutcome: 'expired_no_review' },
    { tier: 'high', founderOutcome: null },
  ];

  it('review coverage = (accepted+rejected) / total', () => {
    expect(reviewCoverageRate(rows, 'high')).toBeCloseTo(2 / 5, 5);
  });

  it('expiry rate = expired_no_review / total', () => {
    expect(expiryRate(rows, 'high')).toBeCloseTo(2 / 5, 5);
  });

  it('a high expiry rate does not, by itself, change founderAcceptancePrecision', () => {
    const precision = founderAcceptancePrecision(rows, 'high');
    expect(precision.precision).toBe(0.5); // 1 accepted / (1 accepted + 1 rejected) — unaffected by the 2 expired rows
  });

  it('both return null on an empty fixture', () => {
    expect(reviewCoverageRate([], 'high')).toBeNull();
    expect(expiryRate([], 'high')).toBeNull();
  });
});
