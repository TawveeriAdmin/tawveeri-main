// tests/providers/blackbox-riyal-festival.test.ts
// Official campaign evidence + automatic expiry policy (2026-08-06 release pass).
// See docs/BLACKBOX-RETAILER-ONBOARDING.md §15, ADR-219.
import {
  CAMPAIGN_SOURCE,
  CAMPAIGN_FRESHNESS_TTL_HOURS,
  isCampaignEvidenceFresh,
  deriveCampaignEligibility,
} from '@/lib/providers/campaigns/blackbox-riyal-festival';

const NOW = new Date('2026-08-06T20:00:00Z');

describe('CAMPAIGN_SOURCE (preserved official evidence)', () => {
  it('preserves the official X post URL, author, and verbatim text', () => {
    expect(CAMPAIGN_SOURCE.source_url).toBe('https://x.com/blackboxksa/status/2085321446625091743');
    expect(CAMPAIGN_SOURCE.author_handle).toBe('@blackboxksa');
    expect(CAMPAIGN_SOURCE.text_ar).toContain('بـ 1 ريال فقط');
    expect(CAMPAIGN_SOURCE.text_ar).toContain('ثلاجة');
    expect(CAMPAIGN_SOURCE.text_ar).toContain('غسالة صحون');
  });

  it('has no invented valid_until — no reliable end date exists in first-party evidence', () => {
    expect(CAMPAIGN_SOURCE.valid_until).toBeNull();
  });

  it('resolves the campaign link to the specific major-appliance sub-category, not the broad festival', () => {
    expect(CAMPAIGN_SOURCE.campaign_link_resolved).toContain('home-appliances-offers-c-1134');
  });
});

describe('isCampaignEvidenceFresh', () => {
  it('is fresh just inside the TTL window', () => {
    const t = new Date(NOW.getTime() - (CAMPAIGN_FRESHNESS_TTL_HOURS - 1) * 3600_000).toISOString();
    expect(isCampaignEvidenceFresh(t, NOW)).toBe(true);
  });

  it('is stale just past the TTL window', () => {
    const t = new Date(NOW.getTime() - (CAMPAIGN_FRESHNESS_TTL_HOURS + 1) * 3600_000).toISOString();
    expect(isCampaignEvidenceFresh(t, NOW)).toBe(false);
  });

  it('fails closed on missing, null, or unparseable timestamps', () => {
    expect(isCampaignEvidenceFresh(null, NOW)).toBe(false);
    expect(isCampaignEvidenceFresh(undefined, NOW)).toBe(false);
    expect(isCampaignEvidenceFresh('not-a-date', NOW)).toBe(false);
  });

  it('fails closed on a future timestamp (clock skew / corrupt data)', () => {
    const future = new Date(NOW.getTime() + 3600_000).toISOString();
    expect(isCampaignEvidenceFresh(future, NOW)).toBe(false);
  });
});

describe('deriveCampaignEligibility', () => {
  const FRESH = new Date(NOW.getTime() - 3600_000).toISOString();
  const STALE = new Date(NOW.getTime() - (CAMPAIGN_FRESHNESS_TTL_HOURS + 10) * 3600_000).toISOString();

  it('returns Level-2 eligibility evidence for fresh category-membership evidence', () => {
    const r = deriveCampaignEligibility({ campaign_category_id: 1134 }, FRESH, NOW);
    expect(r).not.toBeNull();
    expect(r!.eligible).toBe(true);
    expect(r!.campaign_category_id).toBe(1134);
    expect(r!.official_source_url).toBe(CAMPAIGN_SOURCE.campaign_link_resolved);
  });

  // ── HARD INVARIANT: Level-2 wording never states a specific SAR amount it cannot prove ──
  it('never states a specific SAR amount in Level-2 wording (no exact pair verified)', () => {
    const r = deriveCampaignEligibility({ campaign_category_id: 1134 }, FRESH, NOW);
    expect(r!.message_ar).not.toMatch(/\d+\s*ريال/); // no "N ريال" anywhere
    expect(r!.message_en.toLowerCase()).not.toMatch(/\d+\s*sar/);
  });

  it('returns null without category-membership evidence', () => {
    expect(deriveCampaignEligibility(null, FRESH, NOW)).toBeNull();
    expect(deriveCampaignEligibility({}, FRESH, NOW)).toBeNull();
    expect(deriveCampaignEligibility(undefined, FRESH, NOW)).toBeNull();
  });

  // ── AUTOMATIC EXPIRY: stale re-observation → no manual action needed to hide it ──
  it('fails closed once the evidence is stale (early-deactivation-equivalent)', () => {
    const r = deriveCampaignEligibility({ campaign_category_id: 1134 }, STALE, NOW);
    expect(r).toBeNull();
  });

  it('a product simply omitting campaign_category_id (removed from the campaign on re-scrape) yields no eligibility', () => {
    // This IS the "early retailer removal" case: the next re-observation just won't carry
    // the marker at all — no separate removal-detection logic needed.
    expect(deriveCampaignEligibility(undefined, FRESH, NOW)).toBeNull();
  });
});
