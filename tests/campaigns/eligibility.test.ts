// tests/campaigns/eligibility.test.ts — Affiliate Campaign Revenue Layer V1, Phase 3.
// Covers the deterministic eligibility/selection engine: expiry, scheduling, pause,
// category gating, placement gating, the global kill switch, the per-merchant
// allowlist, destination validation, and the "one per merchant" selection rule.
import { isCampaignEligible, selectEligibleCampaigns, parseAllowedMerchants } from '@/lib/campaigns/eligibility';
import { deriveCampaignStatus } from '@/lib/campaigns/types';
import type { AffiliateCampaign } from '@/lib/campaigns/types';

const NOW = new Date('2026-09-02T12:00:00Z');

function makeCampaign(overrides: Partial<AffiliateCampaign> = {}): AffiliateCampaign {
  return {
    id: overrides.id ?? 'c1',
    merchant: 'amazon',
    title_ar: 'عنوان',
    title_en: 'Title',
    cta_ar: 'استعرض العرض',
    cta_en: 'View offer',
    destination_url: 'https://www.amazon.sa/dp/B0EXAMPLE',
    tracking_id: null,
    categories: [],
    placement: 'both',
    enabled: true,
    start_at: '2026-09-01T00:00:00Z',
    end_at: '2026-09-10T00:00:00Z',
    verified_at: null,
    source: 'test',
    disclosure_ar: 'مادة إعلانية • رابط عمولة',
    disclosure_en: 'Advertisement • Commission link',
    is_test: true,
    created_by: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

const ALLOW_BOTH = new Set<'amazon' | 'noon'>(['amazon', 'noon']);
const baseCtx = { now: NOW, placement: 'homepage' as const, category: null, globalEnabled: true, allowedMerchants: ALLOW_BOTH };

describe('deriveCampaignStatus', () => {
  it('is "expired" once now >= end_at', () => {
    const c = makeCampaign({ end_at: '2026-09-01T00:00:00Z' });
    expect(deriveCampaignStatus(c, NOW)).toBe('expired');
  });
  it('is "scheduled" when now < start_at', () => {
    const c = makeCampaign({ start_at: '2026-09-05T00:00:00Z', end_at: '2026-09-10T00:00:00Z' });
    expect(deriveCampaignStatus(c, NOW)).toBe('scheduled');
  });
  it('is "paused" when enabled=false, regardless of the time window', () => {
    const c = makeCampaign({ enabled: false });
    expect(deriveCampaignStatus(c, NOW)).toBe('paused');
  });
  it('is "live" when enabled and inside the window', () => {
    expect(deriveCampaignStatus(makeCampaign(), NOW)).toBe('live');
  });
});

describe('isCampaignEligible — invariant coverage', () => {
  it('1. expired campaign never renders', () => {
    const c = makeCampaign({ end_at: '2026-09-01T00:00:00Z' });
    expect(isCampaignEligible(c, baseCtx)).toBe(false);
  });

  it('2. future (scheduled) campaign never renders', () => {
    const c = makeCampaign({ start_at: '2027-01-01T00:00:00Z', end_at: '2027-02-01T00:00:00Z' });
    expect(isCampaignEligible(c, baseCtx)).toBe(false);
  });

  it('3. paused campaign never renders', () => {
    const c = makeCampaign({ enabled: false });
    expect(isCampaignEligible(c, baseCtx)).toBe(false);
  });

  it('4. wrong category never renders for post-search', () => {
    const c = makeCampaign({ placement: 'post_search', categories: ['laptop'] });
    expect(isCampaignEligible(c, { ...baseCtx, placement: 'post_search', category: 'tv' })).toBe(false);
  });

  it('5. relevant active campaign renders', () => {
    const c = makeCampaign({ placement: 'post_search', categories: ['laptop'] });
    expect(isCampaignEligible(c, { ...baseCtx, placement: 'post_search', category: 'laptop' })).toBe(true);
  });

  it('an ungated campaign (categories: []) matches ANY category context', () => {
    const c = makeCampaign({ placement: 'post_search', categories: [] });
    expect(isCampaignEligible(c, { ...baseCtx, placement: 'post_search', category: 'anything' })).toBe(true);
  });

  it('a gated campaign requires a known category — null category never matches', () => {
    const c = makeCampaign({ placement: 'post_search', categories: ['laptop'] });
    expect(isCampaignEligible(c, { ...baseCtx, placement: 'post_search', category: null })).toBe(false);
  });

  it('placement "both" is eligible on homepage AND post_search', () => {
    const c = makeCampaign({ placement: 'both' });
    expect(isCampaignEligible(c, { ...baseCtx, placement: 'homepage' })).toBe(true);
    expect(isCampaignEligible(c, { ...baseCtx, placement: 'post_search' })).toBe(true);
  });

  it('a homepage-only campaign never renders on post_search, and vice versa', () => {
    const homepageOnly = makeCampaign({ placement: 'homepage' });
    expect(isCampaignEligible(homepageOnly, { ...baseCtx, placement: 'post_search' })).toBe(false);
    const postSearchOnly = makeCampaign({ placement: 'post_search' });
    expect(isCampaignEligible(postSearchOnly, { ...baseCtx, placement: 'homepage' })).toBe(false);
  });

  it('9. invalid Amazon destination is rejected (wrong host for the declared merchant)', () => {
    const c = makeCampaign({ merchant: 'amazon', destination_url: 'https://www.noon.com/saudi-en/some-campaign' });
    expect(isCampaignEligible(c, baseCtx)).toBe(false);
  });

  it('10. invalid Noon destination is rejected (wrong host for the declared merchant)', () => {
    const c = makeCampaign({ merchant: 'noon', destination_url: 'https://www.amazon.sa/dp/B0EXAMPLE' });
    expect(isCampaignEligible(c, baseCtx)).toBe(false);
  });

  it('11. an arbitrary external destination is rejected for either merchant (open-redirect guard)', () => {
    const evilAmazon = makeCampaign({ merchant: 'amazon', destination_url: 'https://evil-phishing-site.example/amazon-deals' });
    const evilNoon = makeCampaign({ merchant: 'noon', destination_url: 'https://evil-phishing-site.example/noon-deals' });
    expect(isCampaignEligible(evilAmazon, baseCtx)).toBe(false);
    expect(isCampaignEligible(evilNoon, baseCtx)).toBe(false);
  });

  it('15. a merchant dropped from the runtime allowlist stays disabled even if everything else is eligible', () => {
    const noonCampaign = makeCampaign({ merchant: 'noon', destination_url: 'https://www.noon.com/saudi-en/campaign' });
    const amazonOnlyAllowed = new Set<'amazon' | 'noon'>(['amazon']);
    expect(isCampaignEligible(noonCampaign, { ...baseCtx, allowedMerchants: amazonOnlyAllowed })).toBe(false);
  });

  it('21. a campaign that WAS live automatically disappears once its end_at passes — no manual action needed', () => {
    const c = makeCampaign({ start_at: '2026-08-01T00:00:00Z', end_at: '2026-09-02T11:59:59Z' });
    expect(isCampaignEligible(c, { ...baseCtx, now: new Date('2026-09-02T11:00:00Z') })).toBe(true);
    expect(isCampaignEligible(c, { ...baseCtx, now: new Date('2026-09-02T12:00:01Z') })).toBe(false);
  });

  it('25. the global kill switch hides every campaign, independent of individual campaign state', () => {
    const c = makeCampaign(); // otherwise perfectly eligible
    expect(isCampaignEligible(c, { ...baseCtx, globalEnabled: false })).toBe(false);
  });
});

describe('selectEligibleCampaigns', () => {
  it('16. returns [] cleanly when there are zero campaigns — homepage/post-search must render nothing broken', () => {
    expect(selectEligibleCampaigns([], baseCtx)).toEqual([]);
  });

  it('returns [] when campaigns exist but none are eligible', () => {
    const expired = makeCampaign({ end_at: '2026-01-01T00:00:00Z' });
    expect(selectEligibleCampaigns([expired], baseCtx)).toEqual([]);
  });

  it('never returns more than ONE campaign per merchant', () => {
    const a1 = makeCampaign({ id: 'a1', merchant: 'amazon', created_at: '2026-08-01T00:00:00Z' });
    const a2 = makeCampaign({ id: 'a2', merchant: 'amazon', created_at: '2026-08-02T00:00:00Z' });
    const n1 = makeCampaign({ id: 'n1', merchant: 'noon', destination_url: 'https://www.noon.com/saudi-en/campaign', created_at: '2026-08-01T00:00:00Z' });
    const result = selectEligibleCampaigns([a1, a2, n1], baseCtx);
    expect(result).toHaveLength(2);
    expect(result.filter((c) => c.merchant === 'amazon')).toHaveLength(1);
    expect(result.filter((c) => c.merchant === 'noon')).toHaveLength(1);
  });

  it('tie-break: a category-gated campaign wins over an ungated one for the same merchant', () => {
    const ungated = makeCampaign({ id: 'ungated', categories: [], created_at: '2026-08-01T00:00:00Z' });
    const gated = makeCampaign({ id: 'gated', categories: ['laptop'], created_at: '2026-08-05T00:00:00Z' });
    const result = selectEligibleCampaigns([ungated, gated], { ...baseCtx, category: 'laptop' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('gated');
  });

  it('tie-break: among equally-specific campaigns, the earlier-created one wins (stable, not random)', () => {
    const first = makeCampaign({ id: 'first', created_at: '2026-08-01T00:00:00Z' });
    const second = makeCampaign({ id: 'second', created_at: '2026-08-05T00:00:00Z' });
    const result = selectEligibleCampaigns([second, first], baseCtx);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('first');
  });

  it('is deterministic across repeated calls with the same input (no randomness, no AI)', () => {
    const a = makeCampaign({ id: 'a' });
    const n = makeCampaign({ id: 'n', merchant: 'noon', destination_url: 'https://www.noon.com/saudi-en/campaign' });
    const r1 = selectEligibleCampaigns([a, n], baseCtx);
    const r2 = selectEligibleCampaigns([a, n], baseCtx);
    expect(r1.map((c) => c.id)).toEqual(r2.map((c) => c.id));
  });
});

describe('parseAllowedMerchants', () => {
  it('defaults to both merchants when unset', () => {
    expect(Array.from(parseAllowedMerchants(undefined)).sort()).toEqual(['amazon', 'noon']);
  });
  it('an explicit empty string disables every merchant', () => {
    expect(parseAllowedMerchants('').size).toBe(0);
  });
  it('parses a single merchant (used to drop Noon while its brand-naming clarification is pending)', () => {
    expect(Array.from(parseAllowedMerchants('amazon'))).toEqual(['amazon']);
  });
  it('ignores unknown tokens (e.g. a future intermediary network) rather than accepting them', () => {
    expect(Array.from(parseAllowedMerchants('amazon,arabclicks,noon'))).toEqual(['amazon', 'noon']);
  });
});
