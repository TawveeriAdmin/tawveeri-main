// tests/campaigns/category-resolution-delivery-fix.test.ts
// Amazon Campaign V1 delivery-gap fix — end-to-end proof, without touching production or the
// real campaign row: a plain query (no manual category-filter click) now produces the SAME
// effective category the real tablet campaign (categories:['tablet'], placement:'post_search')
// requires to become eligible. Ties together task-parser -> canonical-category ->
// resolveEffectiveCategory -> eligibility.ts, exactly as the fixed request path does.
import { parseShoppingTask } from '@/lib/agent/task-parser';
import { toStorefrontCategory } from '@/lib/search/canonical-category';
import { resolveEffectiveCategory } from '@/app/[locale]/(public)/search/search-client';
import { isCampaignEligible } from '@/lib/campaigns/eligibility';
import type { AffiliateCampaign } from '@/lib/campaigns/types';

const NOW = new Date('2026-09-04T12:00:00Z');

// Shape mirrors the real, live tablet campaign (production id
// 06a84dd6-4c6b-43bd-9677-ee660173d105) WITHOUT reproducing its tracking_id/destination_url,
// which this fix must not touch — see eligibility.test.ts for the canonical fixture pattern.
function makeTabletCampaign(): AffiliateCampaign {
  return {
    id: 'test-tablet-campaign',
    merchant: 'amazon',
    title_ar: 'عنوان', title_en: 'Title',
    cta_ar: 'استعرض العرض', cta_en: 'View offer',
    destination_url: 'https://www.amazon.sa/s?k=test',
    tracking_id: null,
    categories: ['tablet'],
    placement: 'post_search',
    enabled: true,
    start_at: '2026-09-02T13:36:52.663Z',
    end_at: '2027-03-02T13:29:41.401Z',
    verified_at: null,
    source: 'test',
    disclosure_ar: 'مادة إعلانية • رابط عمولة', disclosure_en: 'Advertisement • Commission link',
    is_test: true,
    created_by: null,
    created_at: '2026-09-02T13:29:42.529Z',
    updated_at: '2026-09-02T13:36:53.756Z',
  };
}

function ctx(category: string | null) {
  return {
    now: NOW, placement: 'post_search' as const, category,
    globalEnabled: true, allowedMerchants: new Set<'amazon' | 'noon'>(['amazon']),
  };
}

describe('category-resolution delivery fix — end-to-end eligibility', () => {
  const campaign = makeTabletCampaign();

  it('BEFORE THE FIX (regression guard): with no query-resolved category, the null category never made the campaign eligible', () => {
    expect(isCampaignEligible(campaign, ctx(null))).toBe(false);
  });

  it('"تابلت هونر" with NO manual category filter now becomes eligible via the resolved category', () => {
    const resolvedCategory = toStorefrontCategory(parseShoppingTask('تابلت هونر').category || null);
    const effectiveCategory = resolveEffectiveCategory('all', resolvedCategory); // 'all' = no manual filter click
    expect(effectiveCategory).toBe('tablet');
    expect(isCampaignEligible(campaign, ctx(effectiveCategory))).toBe(true);
  });

  it('an explicit, DIFFERENT manual category filter still overrides the query-resolved category (and correctly makes the tablet campaign ineligible)', () => {
    const resolvedCategory = toStorefrontCategory(parseShoppingTask('تابلت هونر').category || null); // 'tablet'
    const effectiveCategory = resolveEffectiveCategory('laptop', resolvedCategory); // user explicitly chose laptop
    expect(effectiveCategory).toBe('laptop');
    expect(isCampaignEligible(campaign, ctx(effectiveCategory))).toBe(false);
  });

  it('an ambiguous query with no manual filter stays unknown and the campaign stays ineligible — no fabricated eligibility', () => {
    const resolvedCategory = toStorefrontCategory(parseShoppingTask('شيء غريب').category || null);
    const effectiveCategory = resolveEffectiveCategory('all', resolvedCategory);
    expect(effectiveCategory).toBeNull();
    expect(isCampaignEligible(campaign, ctx(effectiveCategory))).toBe(false);
  });

  it('a smartphone query never accidentally makes the tablet campaign eligible (taxonomy mapping is category-specific, not a catch-all)', () => {
    const resolvedCategory = toStorefrontCategory(parseShoppingTask('جوال').category || null);
    expect(resolvedCategory).toBe('smartphone');
    const effectiveCategory = resolveEffectiveCategory('all', resolvedCategory);
    expect(isCampaignEligible(campaign, ctx(effectiveCategory))).toBe(false);
  });
});
