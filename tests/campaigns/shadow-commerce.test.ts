// tests/campaigns/shadow-commerce.test.ts — Amazon × Noon internal commerce
// (2026-09-05, §2/§3/§7/§8, "RENEWED IS NOT NEW"). Pure-function coverage; DB-backed
// logShadowEvent()/runShadowEvaluationForProductView()/getMerchantOfferEvidenceForCanonical()
// are exercised indirectly (same convention as getTawveeriObserved — see
// revenue-proof-queries.test.ts's header comment).
import {
  evaluateShadowOpportunity,
  classifyProductTruthState,
  classifyFreshnessState,
  type ShadowEvaluationInput,
  type MerchantOfferEvidence,
} from '@/lib/campaigns/shadow-commerce';
import { PICK_FRESHNESS_MAX_HOURS } from '@/lib/intelligence/evidence-engine';

const NO_OFFER: MerchantOfferEvidence = { title: null, productUrl: null, priceSar: null, offerFreshnessHours: null, inStock: false };

function offer(overrides: Partial<MerchantOfferEvidence>): MerchantOfferEvidence {
  return { title: 'Generic Product 128GB', productUrl: 'https://example.com/p', priceSar: 100, offerFreshnessHours: 10, inStock: true, ...overrides };
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

  it('logs a result when only Noon has an offer, hypothetically selecting it on availability', () => {
    const result = evaluateShadowOpportunity(input({ amazon: NO_OFFER, noon: offer({ priceSar: 500 }) }));
    expect(result).not.toBeNull();
    expect(result!.amazonProductUrl).toBeNull();
    expect(result!.noonProductUrl).toBe('https://example.com/p');
    // BETTER_AVAILABILITY: an out-of-stock/missing Amazon offer never beats a real Noon one.
    expect(result!.hypotheticalSelectedMerchant).toBe('noon');
  });

  it('reuses commercial-tiebreak.ts exactly — a real, material price gap picks the cheaper merchant, never a coin flip (both sides same DETERMINABLE condition, since an undisclosed title is UNKNOWN, not NEW — see the condition-gate safety tests below)', () => {
    const result = evaluateShadowOpportunity(input({
      amazon: offer({ title: 'Renewed - Generic Product 128GB', priceSar: 1649 }),
      noon: offer({ title: 'Renewed - Generic Product 128GB', priceSar: 1699 }),
    }));
    expect(result!.amazonCondition).toBe('RENEWED');
    expect(result!.noonCondition).toBe('RENEWED');
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

  // Condition gate — founder mission 2026-09-05, "RENEWED IS NOT NEW". Real regression
  // case, reproduced verbatim: HP EliteBook canonical product, Amazon titled
  // "...(Renewed)", Noon titled "Renewed - ...", 991.38 SAR vs 1497 SAR.
  describe('condition gate (RENEWED IS NOT NEW)', () => {
    it('the real HP EliteBook regression case: both renewed at different prices → CONDITION-safe (same condition, real price comparison)', () => {
      const result = evaluateShadowOpportunity(input({
        amazon: offer({ title: 'HP Elitebook 840 G8 Laptop... Silver(336G5Ea)(Renewed)', priceSar: 991.38 }),
        noon: offer({ title: 'Renewed -  EliteBook 840 G8 Notebook With 14 Inch Display', priceSar: 1497 }),
      }));
      expect(result!.amazonCondition).toBe('RENEWED');
      expect(result!.noonCondition).toBe('RENEWED');
      expect(result!.hypotheticalSelectedMerchant).toBe('amazon'); // same condition, real price gap — Amazon genuinely cheaper
      expect(result!.selectionReason).toBe('LOWEST_TOTAL_PRICE');
    });

    it('a REAL, determinable condition mismatch (REFURBISHED vs RENEWED) is blocked, never silently compared — real production evidence class, not a hypothetical', () => {
      const result = evaluateShadowOpportunity(input({
        amazon: offer({ title: 'Apple (Refurbished) iPhone 15 Pro Max (256 GB) - Natural Titanium', priceSar: 3450 }),
        noon: offer({ title: 'Renewed - iPhone 15 Pro Max 256GB Natural Titanium', priceSar: 3497 }),
      }));
      expect(result!.amazonCondition).toBe('REFURBISHED');
      expect(result!.noonCondition).toBe('RENEWED');
      expect(result!.hypotheticalSelectedMerchant).toBeNull();
      expect(result!.selectionReason).toBe('CONDITION_MISMATCH');
      expect(result!.shopperEquivalenceState).toBe('NOT_EQUIVALENT');
    });

    it('SAFETY (closure-proof 2026-09-06): the ORIGINAL prior-pass scenario — an undisclosed title next to a RENEWED title — is now CONDITION_UNKNOWN, not CONDITION_MISMATCH, because an undisclosed title can never safely be assumed NEW', () => {
      const result = evaluateShadowOpportunity(input({
        amazon: offer({ title: 'HP EliteBook 840 G8 Laptop 14" Intel i5 8GB 256GB', priceSar: 1450 }), // no condition marker -> UNKNOWN, not NEW
        noon: offer({ title: 'Renewed - EliteBook 840 G8 Notebook 14" Intel i5 8GB 256GB', priceSar: 1497 }),
      }));
      expect(result!.amazonCondition).toBe('UNKNOWN');
      expect(result!.noonCondition).toBe('RENEWED');
      expect(result!.hypotheticalSelectedMerchant).toBeNull();
      expect(result!.selectionReason).toBe('CONDITION_UNKNOWN');
    });

    it('a missing title on one side → CONDITION_UNKNOWN, never assumed NEW or equal', () => {
      const result = evaluateShadowOpportunity(input({
        amazon: offer({ title: null }),
        noon: offer({ title: 'Generic Product 128GB' }),
      }));
      expect(result!.amazonCondition).toBe('UNKNOWN');
      expect(result!.selectionReason).toBe('CONDITION_UNKNOWN');
      expect(result!.hypotheticalSelectedMerchant).toBeNull();
    });
  });

  // Product-type/category guard — ADR-298's TV-speaker case, generalized.
  describe('category/product-type mismatch gate', () => {
    it('a title that looks like an accessory on either side blocks the tie-break entirely, never guesses a winner', () => {
      const result = evaluateShadowOpportunity(input({
        category: 'tv',
        amazon: offer({ title: 'Samsung 65" QLED 4K Smart TV', priceSar: 2999 }),
        noon: offer({ title: 'Ciglow Full Range Smart TV Speaker 2Pcs 8 Ohm 10W Television LCD TV 200HZ-20KH', priceSar: 129.34 }),
      }));
      expect(result!.categoryMismatch).toBe(true);
      expect(result!.hypotheticalSelectedMerchant).toBeNull();
      expect(result!.selectionReason).toBe('CATEGORY_MISMATCH');
      // Category mismatch is checked BEFORE condition/price — never a price-based reason here.
      expect(result!.shopperEquivalenceState).toBe('UNKNOWN');
    });

    it('two genuine main products in the same category are never flagged', () => {
      const result = evaluateShadowOpportunity(input({
        category: 'tv',
        amazon: offer({ title: 'Samsung 65" QLED 4K Smart TV', priceSar: 2999 }),
        noon: offer({ title: 'LG 55" OLED 4K TV', priceSar: 2799 }),
      }));
      expect(result!.categoryMismatch).toBe(false);
      expect(result!.selectionReason).not.toBe('CATEGORY_MISMATCH');
    });
  });
});
