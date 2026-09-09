// tests/campaigns/third-merchant-extensibility.test.ts — Merchant Affiliate Campaign
// Engine mission (2026-09-09), §17: "simulate a hypothetical THIRD_MERCHANT. Do not
// deploy it. Verify that onboarding would require only: merchant registry/config, one
// affiliate adapter/config, secure credentials, validation/tests, campaign activation."
//
// In its own file (not tests/campaigns/eligibility.test.ts) specifically so the
// `destination-validation` mock below — needed to simulate "this merchant's host has
// already been approved," the one deliberate onboarding step this suite does NOT try to
// route around — cannot leak into any other test file's real destination-validation
// behavior. Jest isolates the module registry per test file, so this mock is scoped
// exactly here.
jest.mock('@/lib/campaigns/destination-validation', () => {
  const actual = jest.requireActual('@/lib/campaigns/destination-validation');
  return {
    ...actual,
    validateCampaignDestination: (merchant: string, url: string) =>
      merchant === 'thirdmerchant' ? { valid: true } : actual.validateCampaignDestination(merchant, url),
  };
});

import { selectEligibleCampaigns, type EligibilityContext } from '@/lib/campaigns/eligibility';
import type { AffiliateCampaign, CampaignMerchant } from '@/lib/campaigns/types';

const NOW = new Date('2026-09-02T12:00:00Z');
const THIRD_MERCHANT = 'thirdmerchant' as unknown as CampaignMerchant;

function makeCampaign(overrides: Partial<AffiliateCampaign> = {}): AffiliateCampaign {
  return {
    id: overrides.id ?? 'c1',
    merchant: 'amazon',
    title_ar: 'عنوان', title_en: 'Title', cta_ar: 'استعرض العرض', cta_en: 'View offer',
    destination_url: 'https://www.amazon.sa/dp/B0EXAMPLE',
    tracking_id: null, categories: [], placement: 'both', enabled: true,
    start_at: '2026-09-01T00:00:00Z', end_at: '2026-09-10T00:00:00Z',
    verified_at: null, source: 'test',
    disclosure_ar: 'مادة إعلانية • رابط عمولة', disclosure_en: 'Advertisement • Commission link',
    is_test: true, created_by: null, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

const baseCtx: EligibilityContext = {
  now: NOW, placement: 'homepage', category: null, globalEnabled: true,
  allowedMerchants: new Set(['amazon', 'noon', THIRD_MERCHANT]),
};

describe('third-merchant extensibility (mission §17) — NOT deployed, engine behavior only', () => {
  it('MEASURED regression this mission found and fixed: selectEligibleCampaigns used to hard-code its output order to the literal [amazon, noon], silently dropping ANY other merchant regardless of eligibility. Once onboarded (allowlisted + an approved destination host — the one deliberate line simulated here), a third merchant now appears alongside amazon/noon with zero other code change.', () => {
    const a = makeCampaign({ id: 'a1', merchant: 'amazon' });
    const n = makeCampaign({ id: 'n1', merchant: 'noon', destination_url: 'https://www.noon.com/saudi-en/' });
    const third = makeCampaign({ id: 'third-1', merchant: THIRD_MERCHANT, destination_url: 'https://www.thirdmerchant.example/deals' });

    const result = selectEligibleCampaigns([a, n, third], baseCtx);

    expect(result.map((c) => c.merchant).sort()).toEqual(['amazon', 'noon', THIRD_MERCHANT].sort());
    // amazon/noon keep their existing, proven render-order priority — unchanged for the
    // two live merchants; the third is appended, never inserted ahead of or dropped from them.
    expect(result.map((c) => c.merchant).slice(0, 2)).toEqual(['amazon', 'noon']);
  });

  it('a merchant absent from the allowlist is still excluded — the SAME approval gate amazon/noon already respect', () => {
    const third = makeCampaign({ id: 'third-2', merchant: THIRD_MERCHANT, destination_url: 'https://www.thirdmerchant.example/deals' });
    const ctxWithoutThird: EligibilityContext = { ...baseCtx, allowedMerchants: new Set(['amazon', 'noon']) };
    expect(selectEligibleCampaigns([third], ctxWithoutThird)).toEqual([]);
  });
});
