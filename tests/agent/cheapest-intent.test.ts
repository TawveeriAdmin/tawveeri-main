// P1 · CHEAPEST as a real, eligibility-respecting intent (ONE BRAIN mandate, 2026-08-10).
//
// MEASURED GAP (founder's own audit, same session): "أرخص لابتوب" as a standalone first
// message behaved identically to "لابتوب" in BOTH the search path and the decision path —
// "أرخص" sat only in `route.ts`'s STOPWORDS (pure noise-stripping) and
// `counterfactual.ts`'s follow-up-only marker (gated behind an active DecisionState). A bare
// cheapest request on the FIRST turn was silently dropped everywhere.
//
// The governing rule (founder's own words): "PRICE MAY RANK ELIGIBLE CANDIDATES. PRICE MUST
// NEVER MAKE AN INELIGIBLE CANDIDATE ELIGIBLE." Every test below either proves the marker is
// recognized, or proves eligibility survives it.
import { parseShoppingTask, CHEAPEST_MARKER } from '@/lib/agent/task-parser';
import { decide, type CanonicalRow } from '@/lib/agent/decision-engine';
import { routeQuery } from '@/lib/agent/route-query';
import { parseCounterfactualDelta } from '@/lib/agent/counterfactual';

describe('CHEAPEST_MARKER — the single shared detector every path reads', () => {
  it('recognizes every founder-named phrasing', () => {
    const positives = [
      'ارخص لابتوب', 'أرخص لابتوب', 'أرخص آيفون', 'ورني الأرخص', 'طيب أرخص؟', 'فيه أرخص؟',
      'أبي الأقل سعر', 'الأرخص عندكم وش؟', 'وش أرخص واحد مناسب؟',
      'show me the cheapest', 'anything cheaper?', 'cheapest eligible option',
    ];
    for (const q of positives) expect(CHEAPEST_MARKER.test(q.toLowerCase())).toBe(true);
  });

  it('does NOT fire on bare "رخيص" (affordable) — a quality preference, not a sort instruction', () => {
    expect(CHEAPEST_MARKER.test('ابي لابتوب رخيص وكويس')).toBe(false);
  });
});

describe('parseShoppingTask — wants_cheapest', () => {
  it('sets wants_cheapest for "أرخص لابتوب"', () => {
    const task = parseShoppingTask('أرخص لابتوب');
    expect(task.category).toBe('laptop');
    expect(task.wants_cheapest).toBe(true);
  });

  it('leaves wants_cheapest undefined for a bare category browse', () => {
    const task = parseShoppingTask('لابتوب');
    expect(task.wants_cheapest).toBeUndefined();
  });
});

describe('routeQuery — a bare "أرخص X" now reaches advisory instead of falling through as a plain browse', () => {
  it('"أرخص لابتوب" routes to advisory (previously: retrieval, "category only — a browse")', () => {
    const route = routeQuery('أرخص لابتوب');
    expect(route.mode).toBe('advisory');
    expect(route.reason).toContain('cheapest');
  });

  it('a bare category with no cheapest marker and no other need signal still routes to retrieval (no regression)', () => {
    const route = routeQuery('لابتوب');
    expect(route.mode).toBe('retrieval');
  });
});

describe('counterfactual.ts — reuses the shared marker, gains "أقل سعر" phrasing for follow-ups', () => {
  it('"أبي الأقل سعر" is now recognized as a cheapest delta (previously missed by the old inline regex)', () => {
    expect(parseCounterfactualDelta('أبي الأقل سعر')).toEqual({ kind: 'cheapest' });
  });

  it('a numbered target still wins over "أرخص" appearing in the same sentence (no regression)', () => {
    expect(parseCounterfactualDelta('لو رفعت ميزانيتي إلى 4000 عشان يكون أرخص لاحقًا')).toEqual({ kind: 'absolute', value: 4000 });
  });
});

describe('decide() — cheapest gate reorders by price; only a HARD gate (budget) can ever beat it', () => {
  const row = (id: string, price: number, ram: number, storeCount = 2): CanonicalRow => ({
    canonical_id: id, tps_identity_key: id,
    display_name_ar: `لابتوب ${id}`, display_name_en: `Laptop ${id}`,
    brand: 'Dell', category: 'laptop', image_url: null,
    lowest_price: price, store_count: storeCount, has_comparison: storeCount >= 2,
    identity_confidence: 0.9,
    attributes: { ram: ram, cpu: 'i5', screen: 15 },
  });

  // IMPORTANT DISTINCTION (verified against decideLaptop's own scoring, not assumed): in this
  // codebase, "eligibility" that must survive price-sorting means CATEGORY/PRODUCT-TYPE
  // legitimacy — a laptop actually being a laptop, not an accessory or wrong device — and
  // that gate runs UPSTREAM of `decide()`, in `excludeIneligibleCandidates` (route.ts), before
  // any row ever reaches this engine. A soft spec preference like `ram_min` is NOT an
  // eligibility gate anywhere else in this engine either — it is a caution + score penalty,
  // by design, so best-fit mode can still surface a low-RAM laptop with an honest caveat
  // rather than hide it. Cheapest mode is consistent with that: it is honest about price
  // being the ONLY criterion once the eligible (real-laptop) set exists, and it says so.
  it('picks the absolute cheapest candidate in the set, disclosing (not hiding) an unmet soft preference', () => {
    const rows = [row('cheap-low-ram', 999, 4), row('mid', 1999, 16), row('costly', 2999, 16)];
    const result = decide({ category: 'laptop', wants_cheapest: true, ram_min: 8 } as never, rows);
    const pick = result.recommendations.find((r) => r.is_smart_pick)!;
    expect(pick.canonical_id).toBe('cheap-low-ram');
    // Honest disclosure survives the reorder — the caution this pick earned is still present,
    // not silently dropped just because price sorting promoted it to #1.
    expect(pick.reasons_ar.some((t) => t.includes('أقل من المطلوب'))).toBe(true);
  });

  it('is a pure reorder of what the decider already produced — same candidate set, no size change', () => {
    const rows = [row('a', 3000, 16), row('b', 1000, 16), row('c', 2000, 16)];
    const withCheapest = decide({ category: 'laptop', wants_cheapest: true } as never, rows);
    const without = decide({ category: 'laptop' } as never, rows);
    expect(withCheapest.recommendations.map((r) => r.canonical_id).sort()).toEqual(
      without.recommendations.map((r) => r.canonical_id).sort(),
    );
    expect(withCheapest.recommendations.find((r) => r.is_smart_pick)?.canonical_id).toBe('b');
  });

  it('composes with the HARD budget gate: the cheapest WITHIN-BUDGET item wins, not a cheaper over-budget one', () => {
    // Ascending-price sort alone can never violate the budget gate (every within-budget price
    // is <= budget, every over-budget price is > budget) — this proves the composition stays
    // consistent on a realistic case, not a manufactured contradiction.
    const rows = [row('within', 800, 16), row('over', 1500, 16)];
    const result = decide({ category: 'laptop', wants_cheapest: true, budget_total: 1000 } as never, rows);
    expect(result.anyWithinBudget).toBe(true);
    expect(result.recommendations.find((r) => r.is_smart_pick)?.canonical_id).toBe('within');
  });

  it('the cheapest pick states its reason honestly — "cheapest eligible", not a fabricated fit claim', () => {
    const rows = [row('a', 3000, 16), row('b', 1000, 16)];
    const result = decide({ category: 'laptop', wants_cheapest: true } as never, rows);
    const pick = result.recommendations.find((r) => r.is_smart_pick)!;
    expect(pick.reasons_ar[0]).toContain('أرخص خيار مؤهل');
  });

  it('without wants_cheapest, best-fit ordering is unchanged (no regression)', () => {
    const rows = [row('a', 3000, 32), row('b', 1000, 4)]; // "b" is cheap but ram-poor
    const result = decide({ category: 'laptop', ram_min: 16 } as never, rows);
    // best-fit still prefers the higher-RAM option even though it costs more — proves this
    // suite is not accidentally always sorting by price when wants_cheapest is absent.
    expect(result.recommendations.find((r) => r.is_smart_pick)?.canonical_id).toBe('a');
  });
});
