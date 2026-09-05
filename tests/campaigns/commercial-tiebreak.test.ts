// tests/campaigns/commercial-tiebreak.test.ts
// Amazon × Noon commercial tie-break policy (founder mission §6/§7/§18) — pure function
// tests, no live Supabase needed (logTiebreakEvent itself is a fire-and-forget DB write,
// tested only via source-contract checks below, same convention as logExposure).
import {
  classifyShopperEquivalence,
  resolveCommercialTiebreak,
  materialPriceDifferenceThresholdSar,
  type MerchantOfferSnapshot,
} from '@/lib/campaigns/commercial-tiebreak';

function offer(merchant: 'amazon' | 'noon', overrides: Partial<MerchantOfferSnapshot> = {}): MerchantOfferSnapshot {
  return { merchant, priceSar: 1699, offerFreshnessHours: 10, inStock: true, expectedCommissionSar: null, ...overrides };
}

describe('classifyShopperEquivalence', () => {
  it('exact same price on both merchants → SHOPPER_EQUIVALENT', () => {
    expect(classifyShopperEquivalence(offer('amazon', { priceSar: 1699 }), offer('noon', { priceSar: 1699 }))).toBe('SHOPPER_EQUIVALENT');
  });

  it('a small (immaterial) price difference → SHOPPER_NEAR_EQUIVALENT, never full equivalence', () => {
    // 5 SAR diff on a ~1700 SAR item — well under max(10, 1%).
    expect(classifyShopperEquivalence(offer('amazon', { priceSar: 1700 }), offer('noon', { priceSar: 1695 }))).toBe('SHOPPER_NEAR_EQUIVALENT');
  });

  it('a large (material) price difference → NOT_EQUIVALENT — the founder\'s own 1649 vs 1699 example', () => {
    expect(classifyShopperEquivalence(offer('amazon', { priceSar: 1649 }), offer('noon', { priceSar: 1699 }))).toBe('NOT_EQUIVALENT');
  });

  it('either offer out of stock → NOT_EQUIVALENT regardless of price', () => {
    expect(classifyShopperEquivalence(offer('amazon', { priceSar: 1699, inStock: false }), offer('noon', { priceSar: 1699 }))).toBe('NOT_EQUIVALENT');
  });

  it('missing price on either side → UNKNOWN, never assumed equal', () => {
    expect(classifyShopperEquivalence(offer('amazon', { priceSar: null }), offer('noon', { priceSar: 1699 }))).toBe('UNKNOWN');
  });

  it('materialPriceDifferenceThresholdSar is max(10 SAR, 1% of the lower price)', () => {
    expect(materialPriceDifferenceThresholdSar(500)).toBe(10); // 1% of 500 = 5, floor is 10
    expect(materialPriceDifferenceThresholdSar(2000)).toBe(20); // 1% of 2000 = 20, above the floor
  });
});

describe('resolveCommercialTiebreak', () => {
  it('genuine tie + known commission difference → AFFILIATE_ONLY_TIEBREAK, picks the higher-commission merchant', () => {
    const amazon = offer('amazon', { priceSar: 1699, expectedCommissionSar: 20 });
    const noon = offer('noon', { priceSar: 1699, expectedCommissionSar: 32 });
    const decision = resolveCommercialTiebreak(amazon, noon);
    expect(decision.equivalence).toBe('SHOPPER_EQUIVALENT');
    expect(decision.selectedMerchant).toBe('noon');
    expect(decision.reasonCode).toBe('AFFILIATE_ONLY_TIEBREAK');
  });

  it('Noon cheaper by a material amount → LOWEST_TOTAL_PRICE picks Noon regardless of commission', () => {
    const amazon = offer('amazon', { priceSar: 1699, expectedCommissionSar: 999 }); // huge commission, must not matter
    const noon = offer('noon', { priceSar: 1599, expectedCommissionSar: 1 });
    const decision = resolveCommercialTiebreak(amazon, noon);
    expect(decision.selectedMerchant).toBe('noon');
    expect(decision.reasonCode).toBe('LOWEST_TOTAL_PRICE');
  });

  it('Amazon cheaper by a material amount → LOWEST_TOTAL_PRICE picks Amazon regardless of commission — the founder\'s own 1649 vs 1699 example', () => {
    const amazon = offer('amazon', { priceSar: 1649, expectedCommissionSar: 1 });
    const noon = offer('noon', { priceSar: 1699, expectedCommissionSar: 999 });
    const decision = resolveCommercialTiebreak(amazon, noon);
    expect(decision.selectedMerchant).toBe('amazon');
    expect(decision.reasonCode).toBe('LOWEST_TOTAL_PRICE');
  });

  it('tie but no commission rate known on either side → UNKNOWN, never a guessed winner', () => {
    const amazon = offer('amazon', { priceSar: 1699, expectedCommissionSar: null });
    const noon = offer('noon', { priceSar: 1699, expectedCommissionSar: null });
    const decision = resolveCommercialTiebreak(amazon, noon);
    expect(decision.selectedMerchant).toBeNull();
    expect(decision.reasonCode).toBe('UNKNOWN');
  });

  it('tie but commission known on only ONE side → UNKNOWN, never assumes the other side is zero', () => {
    const amazon = offer('amazon', { priceSar: 1699, expectedCommissionSar: 20 });
    const noon = offer('noon', { priceSar: 1699, expectedCommissionSar: null });
    const decision = resolveCommercialTiebreak(amazon, noon);
    expect(decision.selectedMerchant).toBeNull();
    expect(decision.reasonCode).toBe('UNKNOWN');
  });

  it('missing price data → INSUFFICIENT_EQUIVALENCE, never a fabricated price winner', () => {
    const amazon = offer('amazon', { priceSar: null });
    const noon = offer('noon', { priceSar: 1699 });
    const decision = resolveCommercialTiebreak(amazon, noon);
    expect(decision.selectedMerchant).toBeNull();
    expect(decision.reasonCode).toBe('INSUFFICIENT_EQUIVALENCE');
  });

  it('an out-of-stock offer never wins on price or commission — availability is checked first', () => {
    const amazon = offer('amazon', { priceSar: 1699, inStock: false, expectedCommissionSar: 999 });
    const noon = offer('noon', { priceSar: 1699, inStock: true, expectedCommissionSar: 1 });
    const decision = resolveCommercialTiebreak(amazon, noon);
    expect(decision.selectedMerchant).toBe('noon');
    expect(decision.reasonCode).toBe('BETTER_AVAILABILITY');
  });

  it('both offers out of stock → no selection, never a coin-flip', () => {
    const amazon = offer('amazon', { inStock: false });
    const noon = offer('noon', { inStock: false });
    const decision = resolveCommercialTiebreak(amazon, noon);
    expect(decision.selectedMerchant).toBeNull();
    expect(decision.reasonCode).toBe('INSUFFICIENT_EQUIVALENCE');
  });
});

// Condition gate — founder mission 2026-09-05, "RENEWED IS NOT NEW". Real regression
// case: HP EliteBook canonical product, Amazon offer literally titled "...(Renewed)",
// Noon offer titled "Renewed - ...", at 991.38 SAR vs 1497 SAR — a price-only comparison
// would have called this a real (NOT_EQUIVALENT) price gap and picked Amazon on
// LOWEST_TOTAL_PRICE, silently treating a used-vs-used (or, in other real cases, a
// new-vs-used) pair as an ordinary price comparison.
describe('classifyShopperEquivalence / resolveCommercialTiebreak — condition gate', () => {
  it('NEW vs NEW at the same price → still SHOPPER_EQUIVALENT (condition gate never blocks a genuine match)', () => {
    const a = offer('amazon', { priceSar: 1699, condition: 'NEW' });
    const b = offer('noon', { priceSar: 1699, condition: 'NEW' });
    expect(classifyShopperEquivalence(a, b)).toBe('SHOPPER_EQUIVALENT');
  });

  it('NEW vs RENEWED at ANY price → NOT_EQUIVALENT, never a price-based winner', () => {
    const a = offer('amazon', { priceSar: 991.38, condition: 'NEW' });
    const b = offer('noon', { priceSar: 1497, condition: 'RENEWED' });
    expect(classifyShopperEquivalence(a, b)).toBe('NOT_EQUIVALENT');
    const decision = resolveCommercialTiebreak(a, b);
    expect(decision.selectedMerchant).toBeNull();
    expect(decision.reasonCode).toBe('CONDITION_MISMATCH');
  });

  it('RENEWED vs RENEWED at the same price → SHOPPER_EQUIVALENT — same condition, real match', () => {
    const a = offer('amazon', { priceSar: 1497, condition: 'RENEWED' });
    const b = offer('noon', { priceSar: 1497, condition: 'RENEWED' });
    expect(classifyShopperEquivalence(a, b)).toBe('SHOPPER_EQUIVALENT');
  });

  it('NEW vs USED → NOT_EQUIVALENT / CONDITION_MISMATCH', () => {
    const a = offer('amazon', { condition: 'NEW' });
    const b = offer('noon', { condition: 'USED' });
    const decision = resolveCommercialTiebreak(a, b);
    expect(decision.reasonCode).toBe('CONDITION_MISMATCH');
    expect(decision.selectedMerchant).toBeNull();
  });

  it('known condition vs UNKNOWN condition → CONDITION_UNKNOWN, never assumed equal', () => {
    const a = offer('amazon', { condition: 'NEW' });
    const b = offer('noon', { condition: 'UNKNOWN' });
    expect(classifyShopperEquivalence(a, b)).toBe('UNKNOWN');
    const decision = resolveCommercialTiebreak(a, b);
    expect(decision.reasonCode).toBe('CONDITION_UNKNOWN');
    expect(decision.selectedMerchant).toBeNull();
  });

  it('UNKNOWN vs UNKNOWN → still CONDITION_UNKNOWN, never promoted to equivalent merely because both are unknown', () => {
    const a = offer('amazon', { condition: 'UNKNOWN' });
    const b = offer('noon', { condition: 'UNKNOWN' });
    expect(classifyShopperEquivalence(a, b)).toBe('UNKNOWN');
    expect(resolveCommercialTiebreak(a, b).reasonCode).toBe('CONDITION_UNKNOWN');
  });

  it('omitted condition on both sides defaults to NEW vs NEW — fully backward compatible with every existing caller', () => {
    const a = offer('amazon', { priceSar: 1699 });
    const b = offer('noon', { priceSar: 1699 });
    expect(classifyShopperEquivalence(a, b)).toBe('SHOPPER_EQUIVALENT');
  });

  it('availability is still checked before condition — an out-of-stock renewed offer does not get a CONDITION_MISMATCH reason', () => {
    const a = offer('amazon', { inStock: false, condition: 'RENEWED' });
    const b = offer('noon', { inStock: true, condition: 'NEW' });
    const decision = resolveCommercialTiebreak(a, b);
    expect(decision.selectedMerchant).toBe('noon');
    expect(decision.reasonCode).toBe('BETTER_AVAILABILITY');
  });
});
