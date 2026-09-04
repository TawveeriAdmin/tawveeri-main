// tests/campaigns/claim-guard.test.ts
// Small-appliance safety contract (multi-category expansion, Sept 2026): a generic Amazon
// category-discovery card must never claim a price/verification fact Tawveeri cannot back.
import { checkClaimGuard, GENERIC_DISCOVERY_COPY_AR, GENERIC_DISCOVERY_COPY_EN } from '@/lib/campaigns/claim-guard';

describe('checkClaimGuard', () => {
  it('the approved generic discovery copy is compliant with no fresh offer evidence', () => {
    const result = checkClaimGuard([GENERIC_DISCOVERY_COPY_AR, GENERIC_DISCOVERY_COPY_EN], false);
    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects an Arabic best-price claim with no fresh offer evidence', () => {
    const result = checkClaimGuard(['أفضل سعر لقلاية هوائية على Amazon.sa'], false);
    expect(result.compliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('rejects an English cheapest/verified-price claim with no fresh offer evidence', () => {
    expect(checkClaimGuard(['Cheapest air fryer on Amazon.sa'], false).compliant).toBe(false);
    expect(checkClaimGuard(['Verified price on Amazon.sa'], false).compliant).toBe(false);
  });

  it('allows a price claim ONLY when fresh offer evidence is explicitly confirmed', () => {
    const result = checkClaimGuard(['أفضل سعر لقلاية هوائية على Amazon.sa'], true);
    expect(result.compliant).toBe(true);
  });

  it('never assumes evidence exists — defaults to scanning when the caller omits the flag incorrectly as false', () => {
    // Explicit false is the safe default posture for small appliances (stale/absent fresh
    // Amazon offer data) — this is the exact case the multi-category expansion applies to.
    const result = checkClaimGuard(['السعر الحالي 199 ريال'], false);
    expect(result.compliant).toBe(false);
  });

  it('a plain discovery invitation with no price language passes regardless of evidence state', () => {
    expect(checkClaimGuard(['استكشف خيارات إضافية على Amazon.sa'], false).compliant).toBe(true);
    expect(checkClaimGuard(['استكشف خيارات إضافية على Amazon.sa'], true).compliant).toBe(true);
  });
});
