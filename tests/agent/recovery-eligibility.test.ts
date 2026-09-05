// Truth Hardening Final Closure mission (2026-09-05), ADR-292. Pure eligibility gate: no
// provider call, no DB write — see recovery-eligibility.ts's own doc comment.
import { assessRecoveryEligibility, buildRecoveryDedupKey } from '@/lib/agent/recovery-eligibility';

describe('assessRecoveryEligibility — Part 4 recovery eligibility contract (ADR-292)', () => {
  it('ELIGIBLE: real, category resolved, exact brand+model named, genuine zero', () => {
    const r = assessRecoveryEligibility({
      rawQuery: 'Galaxy S27 Ultra 512GB', resolvedCategory: 'mobile', categoryEnforcedZero: true, count: 0, isTest: false,
    });
    expect(r.eligible).toBe(true);
    expect(r.dedupKey).toBe('mobile::galaxy s27 ultra 512gb');
  });

  it('NOT ELIGIBLE: test/internal provenance can never create a real recovery job (Part 19)', () => {
    const r = assessRecoveryEligibility({
      rawQuery: 'iphone 17 pro max', resolvedCategory: 'mobile', categoryEnforcedZero: true, count: 0, isTest: true,
    });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('test_provenance_excluded');
  });

  it('NOT ELIGIBLE: not actually a zero result', () => {
    const r = assessRecoveryEligibility({
      rawQuery: 'iphone 17 pro max', resolvedCategory: 'mobile', categoryEnforcedZero: false, count: 5, isTest: false,
    });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('not_a_zero_result');
  });

  it('NOT ELIGIBLE: fuzzy category-only browse, no exact model — never triggers expensive recovery (Part 4)', () => {
    const r = assessRecoveryEligibility({
      rawQuery: 'ابي جوال صغير ورخيص', resolvedCategory: 'mobile', categoryEnforcedZero: true, count: 0, isTest: false,
    });
    expect(r.eligible).toBe(false);
  });

  it('NOT ELIGIBLE: category never resolved at all (PARSER_FAILURE, not CATALOG_MISSING)', () => {
    const r = assessRecoveryEligibility({
      rawQuery: 'شي غريب مالي خبر عنه', resolvedCategory: null, categoryEnforcedZero: false, count: 0, isTest: false,
    });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('zero_reason_parser_failure');
  });

  it('dedup key is stable across case/whitespace variants of the same query (Part 8 idempotency)', () => {
    const a = buildRecoveryDedupKey('mobile', 'Galaxy S27 Ultra 512GB');
    const b = buildRecoveryDedupKey('mobile', '  galaxy   s27 ultra 512gb  ');
    expect(a).toBe(b);
  });

  it('dedup key differs by category — the same model text in two categories is two distinct requests', () => {
    const a = buildRecoveryDedupKey('mobile', 'X1 Pro');
    const b = buildRecoveryDedupKey('laptop', 'X1 Pro');
    expect(a).not.toBe(b);
  });
});
