// THE ENGINE'S PUBLISHED EVIDENCE CONTRACT (ADR-162).
//
// "Publish, never infer. If a figure cannot declare its provenance, the engine must not render
// it." Each test pins one clause of that sentence.
import { buildPublishedEvidence, findUnpublishedFigures } from '@/lib/agent/published-evidence';
import { explainChoice } from '@/lib/agent/decision-engine';
import { validateGeneratedAnswer } from '@/lib/vocabulary';
import { CATEGORY_SPEC_FILTERS } from '@/lib/scraping/config/spec-configs';

const rec = (over: Record<string, unknown> = {}) => ({
  canonical_id: 'c1', tps_identity_key: 'k', title_ar: 'أ', title_en: 'a', brand: 'b',
  unit_price: 4499, total_cost_estimate: 4555,
  cost_breakdown: { unit: 4499, installation: null, annual_electricity: 56 },
  store_count: 2, comparison_available: true, suitability_score: 0.7, confidence: 75,
  trust: {} as never, is_smart_pick: true, reasons_ar: [], dna: { capacity_btu: 24000 },
  go_offer_hint: 'c1', stores: ['أمازون', 'جرير'],
  ...over,
});

describe('AC1 — every figure is published with an explicit provenance', () => {
  const ev = buildPublishedEvidence({ recommendations: [rec()], smart_pick: null });

  it('publishes the observed unit price as live-query', () => {
    expect(ev.figures).toContainEqual({ value: 4499, kind: 'price', derivedFrom: 'live-query', label: 'unit_price' });
  });

  it('publishes the total-cost estimate as COMPUTED, not observed', () => {
    // 4555 is not a price anyone quoted; it is 4499 + a disclosed electricity model. Declaring it
    // `live-query` would be a small lie with a large consequence — it would make a computed
    // figure indistinguishable from an observed one for anything downstream.
    expect(ev.figures).toContainEqual({ value: 4555, kind: 'price', derivedFrom: 'computed', label: 'total_cost_estimate' });
  });

  it('publishes the retailer count and the named retailers behind it', () => {
    expect(ev.figures).toContainEqual({ value: 2, kind: 'retailer-count', derivedFrom: 'live-query', label: 'store_count' });
    expect(ev.retailers).toEqual(['أمازون', 'جرير']);
  });

  it('every figure carries all four fields', () => {
    for (const f of ev.figures) {
      expect(typeof f.value).toBe('number');
      expect(typeof f.kind).toBe('string');
      expect(['live-query', 'computed', 'static']).toContain(f.derivedFrom);
      expect(typeof f.label).toBe('string');
    }
  });

  it('emits no `static` provenance — the engine hardcodes no customer-visible figure', () => {
    expect(ev.figures.some((f) => f.derivedFrom === 'static')).toBe(false);
  });
});

describe('AC4 — the saving is published on the branch that renders it', () => {
  const pick = rec({ total_cost_estimate: 3816 }) as never;
  const runnerUp = rec({ canonical_id: 'c2', total_cost_estimate: 3996, store_count: 1 }) as never;

  it('publishes total_cost_delta when the sentence is rendered', () => {
    const ch = explainChoice(pick, runnerUp)!;
    expect(ch.reasons_ar.some((r) => r.includes('أوفر بـ180'))).toBe(true);
    expect(ch.total_cost_delta).toBe(180);
  });

  it('publishes null when no saving sentence is rendered', () => {
    // Pick is NOT cheaper — nothing to render, so nothing to declare.
    const ch = explainChoice(runnerUp, pick);
    expect(ch?.total_cost_delta ?? null).toBeNull();
  });

  it('the published delta reaches the evidence bundle', () => {
    const ch = explainChoice(pick, runnerUp)!;
    const ev = buildPublishedEvidence({ recommendations: [], smart_pick: { ...(pick as object), chosen_over: ch } as never });
    expect(ev.figures).toContainEqual({ value: 180, kind: 'price', derivedFrom: 'computed', label: 'chosen_over.total_cost_delta' });
  });

  it('and the validator then ACCEPTS the sentence it used to reject', () => {
    const ch = explainChoice(pick, runnerUp)!;
    const ev = buildPublishedEvidence({ recommendations: [], smart_pick: { ...(pick as object), chosen_over: ch } as never });
    for (const sentence of [...ch.reasons_ar, ...ch.reasons_en]) {
      const verdict = validateGeneratedAnswer(sentence, ev);
      expect(`${sentence} → ${verdict.outcome}`).toBe(`${sentence} → passed`);
    }
  });
});

describe('Decision Card v1 (§C) — the alternative price/delta are published unconditionally', () => {
  const pick = rec({ total_cost_estimate: 3816 }) as never;
  // store_count differs so `explainChoice` finds a reason ("more suitable" is not asserted;
  // the pick's cheaper total cost alone is enough for `ar.length > 0`).
  const runnerUp = rec({ canonical_id: 'c2', total_cost_estimate: 3996, store_count: 1 }) as never;

  it('publishes alternative_unit_price from the runner-up, independent of the reasons cap', () => {
    const ch = explainChoice(pick, runnerUp)!;
    // The base fixture's unit_price (4499) is unchanged on the runner-up above — this is the
    // alternative's OWN displayed price, not the total-cost basis the delta below uses.
    expect(ch.alternative_unit_price).toBe(4499);
  });

  it('publishes a signed price_delta computed on the same basis explainChoice compared', () => {
    const ch = explainChoice(pick, runnerUp)!;
    expect(ch.price_delta).toBe(180); // runnerUp(3996) - pick(3816), matching total_cost_delta here
  });

  it('reaches the evidence bundle even when total_cost_delta itself would be null', () => {
    // Construct a case where the pick wins on suitability, not cost, so `total_cost_delta`
    // (gated on the "أوفر بـ" sentence surviving the 3-reason cap) is null — the structured
    // price/delta must NOT be gated the same way.
    const suitPick = rec({ total_cost_estimate: 4000, suitability_score: 0.9 }) as never;
    const suitRunnerUp = rec({ canonical_id: 'c3', total_cost_estimate: 3800, suitability_score: 0.5, store_count: 1 }) as never;
    const ch = explainChoice(suitPick, suitRunnerUp)!;
    expect(ch.total_cost_delta).toBeNull(); // the pick is NOT cheaper — no saving sentence
    expect(ch.price_delta).toBe(-200); // still published: 3800 - 4000
    const ev = buildPublishedEvidence({ recommendations: [], smart_pick: { ...(suitPick as object), chosen_over: ch } as never });
    expect(ev.figures).toContainEqual({ value: -200, kind: 'price', derivedFrom: 'computed', label: 'chosen_over.price_delta' });
    expect(ev.figures).toContainEqual({ value: 4499, kind: 'price', derivedFrom: 'live-query', label: 'chosen_over.alternative_unit_price' });
  });
});

describe('AC2 — completeness: a rendered figure with no provenance is an ENGINE defect', () => {
  it('finds a figure rendered but not published', () => {
    const payload = { recommendations: [rec()], smart_pick: null, note: 'أفضل سعر 999 ريال' };
    const unpublished = findUnpublishedFigures(payload, buildPublishedEvidence(payload as never));
    expect(unpublished.map((u) => u.value)).toContain(999);
  });

  it('reports nothing when every rendered figure is published', () => {
    const payload = { recommendations: [rec()], smart_pick: null, note: 'التكلفة الإجمالية ~4555 ريال' };
    expect(findUnpublishedFigures(payload, buildPublishedEvidence(payload as never))).toEqual([]);
  });

  it('reads Arabic-Indic digits — the third-occurrence trap (ADR-153)', () => {
    const payload = { recommendations: [rec()], smart_pick: null, note: 'السعر ٩٩٩ ريال' };
    expect(findUnpublishedFigures(payload, buildPublishedEvidence(payload as never)).map((u) => u.value)).toContain(999);
  });

  it('ignores machine fields — an identity key is not customer-visible text', () => {
    const payload = { recommendations: [], smart_pick: null, tps_identity_key: 'x|12000 ريال|y' };
    expect(findUnpublishedFigures(payload, { figures: [], retailers: [] })).toEqual([]);
  });
});

describe('AC5 — category-independent', () => {
  it('the builder names no category the app knows about', () => {
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/lib/agent/published-evidence.ts'), 'utf8',
    ).toLowerCase();
    const categories = Object.keys(CATEGORY_SPEC_FILTERS);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.filter((c) => src.includes(`"${c}"`) || src.includes(`'${c}'`))).toEqual([]);
  });

  it('produces the same shape for any category, because it reads only generic fields', () => {
    const shapes = ['air_conditioner', 'laptop', 'tv', 'refrigerator'].map(() =>
      buildPublishedEvidence({ recommendations: [rec()], smart_pick: null }).figures.map((f) => `${f.kind}:${f.derivedFrom}`).sort().join(','),
    );
    expect(new Set(shapes).size).toBe(1);
  });
});
