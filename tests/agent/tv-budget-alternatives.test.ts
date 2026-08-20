// Regression coverage for the "خيارات أخرى مناسبة" defect (2026-08-20): a live search for
// «أبي تليفزيون ب 250ريال» showed Samsung TVs at 59,999 / 27,699 / 6,499 SAR under "other
// suitable options" beside Waffar's own honest "nothing fits under 250 SAR" note. Root cause:
// `applyBudgetGate` (decision-engine.ts) intentionally keeps suitability-ranked over-budget
// candidates visible when nothing satisfies budget — a considered, cross-category tradeoff
// (see tests/agent/decision-engine.test.ts) left untouched by founder direction. This fix is
// scoped to `tv` only, inside the route (never decision-engine.ts): `filterOverBudgetTvAlternatives`
// keeps the top pick (already honestly annotated by `budget_note`) but drops every OTHER
// over-budget item from the list, so wildly irrelevant "alternatives" cannot surface.
import { filterOverBudgetTvAlternatives } from '@/app/api/v1/agent/decide/route';
import type { Recommendation } from '@/lib/agent/decision-engine';

function rec(canonical_id: string, unit_price: number | null): Recommendation {
  return {
    canonical_id, tps_identity_key: `k-${canonical_id}`,
    title_ar: canonical_id, title_en: canonical_id, brand: 'samsung',
    unit_price,
    total_cost_estimate: unit_price, cost_breakdown: { unit: unit_price, installation: null, annual_electricity: null },
    store_count: 1, comparison_available: false,
    suitability_score: 0.8, confidence: 60,
    trust: { tier: 'medium', score: 60, cited: [] } as unknown as Recommendation['trust'],
    is_smart_pick: false, reasons_ar: [], reason_kinds: [], headline_reasons: [],
    dna: {}, go_offer_hint: canonical_id,
  };
}

describe('filterOverBudgetTvAlternatives', () => {
  it('keeps only the top pick and drops far-over-budget "alternatives" when nothing fits (production defect)', () => {
    const recs = [
      rec('google-tv-50', 1200),   // smart pick — over budget, but honestly annotated by budget_note
      rec('samsung-59999', 59999),
      rec('samsung-27699', 27699),
      rec('samsung-6499', 6499),
    ];
    const out = filterOverBudgetTvAlternatives('tv', 250, recs);
    expect(out.map((r) => r.canonical_id)).toEqual(['google-tv-50']);
  });

  it('keeps in-budget alternatives alongside the top pick', () => {
    const recs = [
      rec('best-fit-over', 900),
      rec('cheap-in-budget', 220),
      rec('also-way-over', 15000),
    ];
    const out = filterOverBudgetTvAlternatives('tv', 250, recs);
    expect(out.map((r) => r.canonical_id)).toEqual(['best-fit-over', 'cheap-in-budget']);
  });

  it('never touches non-tv categories (scope is TV-only, founder direction 2026-08-20)', () => {
    const recs = [rec('ac-1', 900), rec('ac-2', 6000), rec('ac-3', 5000)];
    const out = filterOverBudgetTvAlternatives('air_conditioner', 100, recs);
    expect(out).toEqual(recs);
  });

  it('is a no-op when no budget was stated', () => {
    const recs = [rec('tv-1', 900), rec('tv-2', 6000)];
    expect(filterOverBudgetTvAlternatives('tv', null, recs)).toEqual(recs);
    expect(filterOverBudgetTvAlternatives('tv', 0, recs)).toEqual(recs);
  });

  it('never drops an unpriced item — unknown price is never treated as over budget', () => {
    const recs = [rec('tv-1', 900), rec('tv-unpriced', null)];
    const out = filterOverBudgetTvAlternatives('tv', 250, recs);
    expect(out.map((r) => r.canonical_id)).toEqual(['tv-1', 'tv-unpriced']);
  });
});

/**
 * SAME-DAY FOLLOW-UP (2026-08-20): the fix above shipped and was live-verified, but the
 * EXACT reported symptom still reproduced — «تلفزيون سامسونج QA85QN70FAUXSA» kept showing
 * under "خيارات أخرى مناسبة" because `unit_price` was null (`tps_product_projection.lowest_price`
 * unpopulated for these rows — a separate, undiagnosed data gap), so the filter above correctly
 * had nothing to compare and let it through ("unknown beats incorrect"). But the card's OWN
 * `discount_intel` text visibly read «السعر مستقر عند ~6499...» — a real, evidenced price the
 * customer reads as the item's price. `filterOverBudgetTvAlternatives` now accepts a `priceOf`
 * resolver (`api/v1/agent/decide/route.ts` calls it a second time, post-enrichment, with
 * `unit_price ?? discount_intel.current_price`) so a "suitable option" is judged on the price
 * it ACTUALLY shows, whichever field that price came from.
 */
describe('filterOverBudgetTvAlternatives — effective-price resolver (discount_intel fallback)', () => {
  const withDiscount = (canonical_id: string, unit_price: number | null, current_price: number | null) => ({
    ...rec(canonical_id, unit_price),
    discount_intel: current_price == null ? null : {
      verdict: 'inflated_reference' as const, real_saving_pct: 0, advertised_saving_pct: null,
      text: { ar: `السعر مستقر عند ~${current_price}`, en: `Price steady at ~${current_price}` },
      current_price,
    },
  });
  const effectivePrice = (r: { unit_price: number | null; discount_intel?: { current_price: number | null } | null }) =>
    r.unit_price ?? r.discount_intel?.current_price ?? null;

  it('drops an alternative whose unit_price is null but discount_intel discloses a real over-budget price (production defect)', () => {
    const recs = [
      withDiscount('google-tv-50', null, null),          // smart pick — no confirmable price at all
      withDiscount('samsung-qa85qn70', null, 6499),       // unit_price null, discount_intel says ~6499
      withDiscount('samsung-qa85qn990', null, 27699),     // unit_price null, discount_intel says ~27699
    ];
    const out = filterOverBudgetTvAlternatives('tv', 250, recs, effectivePrice);
    expect(out.map((r) => r.canonical_id)).toEqual(['google-tv-50']);
  });

  it('keeps an alternative whose discount_intel price is within budget', () => {
    const recs = [
      withDiscount('smart-pick', 900, null),
      withDiscount('cheap-via-discount-intel', null, 220),
      withDiscount('expensive-via-discount-intel', null, 6499),
    ];
    const out = filterOverBudgetTvAlternatives('tv', 250, recs, effectivePrice);
    expect(out.map((r) => r.canonical_id)).toEqual(['smart-pick', 'cheap-via-discount-intel']);
  });

  it('prefers unit_price over discount_intel.current_price when both are present', () => {
    const recs = [
      withDiscount('smart-pick', 900, null),
      withDiscount('unit-price-wins', 200, 9999), // unit_price (verified) says in-budget; discount_intel is ignored
    ];
    const out = filterOverBudgetTvAlternatives('tv', 250, recs, effectivePrice);
    expect(out.map((r) => r.canonical_id)).toEqual(['smart-pick', 'unit-price-wins']);
  });

  it('defaults to unit_price only when no resolver is passed (pre-enrichment call site, backward compatible)', () => {
    const recs = [rec('tv-1', 900), rec('tv-2', 6499)];
    const out = filterOverBudgetTvAlternatives('tv', 250, recs);
    expect(out.map((r) => r.canonical_id)).toEqual(['tv-1']);
  });
});
