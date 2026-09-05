// tests/campaigns/shadow-commerce.test.ts — Noon Internal Commerce Expansion
// (2026-09-05, §2/§3/§7). Pure-function coverage; DB-backed logShadowEvent()/
// runShadowEvaluationForProductView() are exercised indirectly (same convention as
// getTawveeriObserved — see revenue-proof-queries.test.ts's header comment).
import {
  evaluateShadowOpportunity,
  classifyProductTruthState,
  classifyFreshnessState,
  type ShadowEvaluationInput,
} from '@/lib/campaigns/shadow-commerce';
import type { MerchantExactProductEvidence } from '@/lib/campaigns/amazon-evidence';
import { PICK_FRESHNESS_MAX_HOURS } from '@/lib/intelligence/evidence-engine';

const NO_OFFER: MerchantExactProductEvidence = { productUrl: null, priceSar: null, offerFreshnessHours: null, inStock: false, distinctStoreCount: 0 };

function offer(overrides: Partial<MerchantExactProductEvidence>): MerchantExactProductEvidence {
  return { productUrl: 'https://example.com/p', priceSar: 100, offerFreshnessHours: 10, inStock: true, distinctStoreCount: 2, ...overrides };
}

function input(overrides: Partial<ShadowEvaluationInput>): ShadowEvaluationInput {
  return {
    productId: 'p1',
    category: 'tv',
    canonicalProductId: 'cp1',
    isActive: true,
    identityConfidence: 90,
    amazon: NO_OFFER,
    noon: NO_OFFER,
    acquisitionCampaign: null,
    sessionId: 's1',
    isTest: false,
    ...overrides,
  };
}

describe('classifyProductTruthState', () => {
  it('is INACTIVE when the product is not active, regardless of confidence', () => {
    expect(classifyProductTruthState(false, 95)).toBe('INACTIVE');
    expect(classifyProductTruthState(false, null)).toBe('INACTIVE');
  });
  it('is ACTIVE when active with confidence >= 70', () => {
    expect(classifyProductTruthState(true, 70)).toBe('ACTIVE');
    expect(classifyProductTruthState(true, 100)).toBe('ACTIVE');
  });
  it('is ACTIVE_LOW_CONFIDENCE when active with confidence < 70 or unknown — never assumes high confidence', () => {
    expect(classifyProductTruthState(true, 69)).toBe('ACTIVE_LOW_CONFIDENCE');
    expect(classifyProductTruthState(true, null)).toBe('ACTIVE_LOW_CONFIDENCE');
  });
});

describe('classifyFreshnessState', () => {
  it('is UNKNOWN when neither merchant has any offer', () => {
    expect(classifyFreshnessState(NO_OFFER, NO_OFFER)).toBe('UNKNOWN');
  });
  it('is FRESH when every existing offer is within the shared PICK_FRESHNESS_MAX_HOURS bar', () => {
    expect(classifyFreshnessState(offer({ offerFreshnessHours: PICK_FRESHNESS_MAX_HOURS }), NO_OFFER)).toBe('FRESH');
    expect(classifyFreshnessState(offer({ offerFreshnessHours: 1 }), offer({ offerFreshnessHours: 2 }))).toBe('FRESH');
  });
  it('is STALE when any existing offer exceeds the bar, even if the other is fresh', () => {
    expect(classifyFreshnessState(offer({ offerFreshnessHours: PICK_FRESHNESS_MAX_HOURS + 1 }), offer({ offerFreshnessHours: 1 }))).toBe('STALE');
  });
  it('ignores a merchant with no offer at all rather than treating its null hours as stale', () => {
    expect(classifyFreshnessState(offer({ offerFreshnessHours: 1 }), NO_OFFER)).toBe('FRESH');
  });
});

describe('evaluateShadowOpportunity', () => {
  it('returns null when neither merchant has any real offer — nothing to learn', () => {
    expect(evaluateShadowOpportunity(input({ amazon: NO_OFFER, noon: NO_OFFER }))).toBeNull();
  });

  it('logs a NOON_ONLY_OPPORTUNITY-shaped result when only Noon has an offer', () => {
    const result = evaluateShadowOpportunity(input({ amazon: NO_OFFER, noon: offer({ priceSar: 500 }) }));
    expect(result).not.toBeNull();
    expect(result!.amazonProductUrl).toBeNull();
    expect(result!.noonProductUrl).toBe('https://example.com/p');
    // BETTER_AVAILABILITY: an out-of-stock/missing Amazon offer never beats a real Noon one.
    expect(result!.hypotheticalSelectedMerchant).toBe('noon');
  });

  it('reuses commercial-tiebreak.ts exactly — a real, material price gap picks the cheaper merchant, never a coin flip', () => {
    const result = evaluateShadowOpportunity(input({
      amazon: offer({ priceSar: 1649 }),
      noon: offer({ priceSar: 1699 }),
    }));
    expect(result!.hypotheticalSelectedMerchant).toBe('amazon');
    expect(result!.selectionReason).toBe('LOWEST_TOTAL_PRICE');
  });

  it('classifies traffic source from the acquisition cookie shape, defaulting to organic_direct with none', () => {
    const organic = evaluateShadowOpportunity(input({ amazon: offer({}), acquisitionCampaign: null }));
    expect(organic!.trafficSourceClass).toBe('organic_direct');

    const paid = evaluateShadowOpportunity(input({ amazon: offer({}), acquisitionCampaign: { utm_source: 'google', utm_medium: 'cpc' } }));
    expect(paid!.trafficSourceClass).toBe('google_paid_search');
  });

  it('commercial_evidence_state is honestly UNKNOWN — no report has ever been imported for either merchant', () => {
    const result = evaluateShadowOpportunity(input({ amazon: offer({}), noon: offer({}) }));
    expect(result!.commercialEvidenceState).toBe('UNKNOWN');
  });

  it('product_truth_state and freshness_state are derived via the shared classifiers, not re-invented inline', () => {
    const result = evaluateShadowOpportunity(input({ amazon: offer({}), isActive: true, identityConfidence: 40 }));
    expect(result!.productTruthState).toBe('ACTIVE_LOW_CONFIDENCE');
    expect(result!.freshnessState).toBe('FRESH');
  });
});
