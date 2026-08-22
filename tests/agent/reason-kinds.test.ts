// tests/agent/reason-kinds.test.ts
// ADR-187 · REDESIGN_BRIEF §8 — two requirements the advisor did not meet:
//   *"Two sentences of reasoning, maximum."*   (it rendered five)
//   *"Distinguish fact from inference from recommendation."*  (all five wore one green tick)
//
// The invariants below are what stop either from silently coming back.
import {
  decide, pickHeadlineReasons, ReasonLedger,
  type CanonicalRow, type ReasonKind, type Recommendation,
} from "../../src/lib/agent/decision-engine";
import { guardAdvisorPayload } from "../../src/lib/agent/answer-guard";

const row = (over: Partial<CanonicalRow> = {}): CanonicalRow => ({
  canonical_id: "c1", tps_identity_key: "k1",
  display_name_ar: "منتج", display_name_en: "Product", brand: "samsung",
  category: null, image_url: null, lowest_price: 3000, store_count: 3,
  has_comparison: true, identity_confidence: 80, attributes: {}, ...over,
});

/** Every category the dispatcher claims to support, with attributes rich enough to score. */
const CATEGORY_FIXTURES: { category: string; attrs: Record<string, unknown>; task?: Record<string, unknown> }[] = [
  { category: "air_conditioner", attrs: { capacity_btu: 30000, technology: "inverter", cooling_mode: "cool_only", ac_type: "split" }, task: { room_size_m2: 40, priorities: ["low_electricity"] } },
  { category: "tv", attrs: { screen_size: 65, resolution: "4k", panel: "oled", refresh_rate: 120 }, task: { priorities: ["gaming", "movies"] } },
  { category: "tablet", attrs: { line: "Galaxy Tab", storage: 256, connectivity: "5g", screen_size: 11 }, task: { priorities: ["productivity"] } },
  { category: "mobile", attrs: { family: "Galaxy S", generation: "S24", variant: "Ultra", storage: 512 }, task: { priorities: ["camera", "latest"] } },
  { category: "laptop", attrs: { family: "LOQ", cpu: "ryzen7", ram: 16, storage: 512, screen: 15, gpu: "rtx3050" }, task: { priorities: ["gaming"] } },
  { category: "refrigerator", attrs: { fridge_type: "french_door", capacity_liters: 550, inverter: true }, task: { priorities: ["low_electricity"], parsed_from_text: "ثلاجة كبيرة للعائلة" } },
  { category: "washing_machine", attrs: { washer_type: "front_load", capacity_kg: 12, has_dryer: true, inverter: true }, task: { priorities: ["quiet"], parsed_from_text: "غسالة كبيرة للعائلة مع نشافة" } },
  { category: "dishwasher", attrs: { appliance_type: "built_in", capacity: 15, inverter: true, third_rack: true }, task: { priorities: ["quiet"], parsed_from_text: "غسالة صحون كبيرة" } },
  { category: "vacuum", attrs: { appliance_type: "stick", capacity: 400, cordless: true, hepa: true } },
  { category: "some_unmapped_category", attrs: {} },
];

const run = (category: string, attrs: Record<string, unknown>, task: Record<string, unknown> = {}): Recommendation[] =>
  decide({ category, ...task } as never, [row({ attributes: attrs })]).recommendations;

describe("every reason declares what kind of claim it is", () => {
  it.each(CATEGORY_FIXTURES)("$category — kinds align 1:1 with reasons", ({ category, attrs, task }) => {
    const [rec] = run(category, attrs, task);
    expect(rec.reason_kinds).toHaveLength(rec.reasons_ar.length);
    expect(rec.reasons_ar.length).toBeGreaterThan(0);
  });

  it.each(CATEGORY_FIXTURES)("$category — no reason is left unclassified", ({ category, attrs, task }) => {
    const valid: ReasonKind[] = ["identity", "fit", "spec", "evidence", "estimate", "caution"];
    const [rec] = run(category, attrs, task);
    for (const k of rec.reason_kinds) expect(valid).toContain(k);
  });

  it("classifies the corroboration sentence as measured evidence, in every category", () => {
    for (const { category, attrs, task } of CATEGORY_FIXTURES) {
      const [rec] = run(category, attrs, task);
      const i = rec.reasons_ar.findIndex((r) => /متاجر|متجر واحد/.test(r));
      expect(rec.reason_kinds[i]).toBe("evidence");
    }
  });

  it("classifies a modelled total cost as an ESTIMATE, never as a measurement", () => {
    // The AC total is unit + a modelled install + modelled annual electricity. Presenting that
    // as a measured fact is precisely what §8 forbids.
    const [rec] = run("air_conditioner", { capacity_btu: 30000, technology: "inverter", cooling_mode: "cool_only", ac_type: "split" }, { room_size_m2: 40 });
    const i = rec.reasons_ar.findIndex((r) => r.includes("التكلفة الإجمالية التقديرية"));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(rec.reason_kinds[i]).toBe("estimate");
  });

  it("classifies an unmet requirement as a caution, not as a neutral spec", () => {
    const [rec] = run("air_conditioner", { capacity_btu: 18000, technology: "fixed", cooling_mode: "cool_only", ac_type: "split" }, { room_size_m2: 60, priorities: ["low_electricity"] });
    const i = rec.reasons_ar.findIndex((r) => r.includes("أقل من المطلوب"));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(rec.reason_kinds[i]).toBe("caution");
  });
});

describe("the card leads with one to three sentences (B3, Decision Card v1) — cautions never dropped", () => {
  it.each(CATEGORY_FIXTURES)("$category — typically no more than three", ({ category, attrs, task }) => {
    const [rec] = run(category, attrs, task);
    // A soft target, not a hard cap — see the next describe block for the case where
    // multiple cautions legitimately push the count past three.
    expect(rec.headline_reasons.length).toBeLessThanOrEqual(3);
  });

  it("never leads with a sentence the card already states elsewhere", () => {
    // `identity` is the card title; `evidence` is the TrustSummary badge. Repeating either is
    // the scattering the founder called «كثير ومشتته».
    for (const { category, attrs, task } of CATEGORY_FIXTURES) {
      const [rec] = run(category, attrs, task);
      for (const i of rec.headline_reasons) {
        expect(["identity", "evidence"]).not.toContain(rec.reason_kinds[i]);
      }
    }
  });

  it("leads with a caution ahead of anything positive", () => {
    const kinds: ReasonKind[] = ["identity", "spec", "fit", "caution", "evidence"];
    expect(pickHeadlineReasons(kinds)[0]).toBe(3); // the caution
  });

  it("falls back through fit → spec → estimate when there is no caution", () => {
    expect(pickHeadlineReasons(["identity", "spec", "fit", "evidence"])).toEqual([2, 1]);
    expect(pickHeadlineReasons(["identity", "spec", "evidence"])).toEqual([1]);
    expect(pickHeadlineReasons(["identity", "evidence"])).toEqual([]);
    expect(pickHeadlineReasons(["estimate", "evidence"])).toEqual([0]);
  });

  it("B3: never drops a caution to stay under three — honesty outranks the target length", () => {
    // Two constraint mismatches (both cautions) plus a fit reason: all three MUST show, even
    // though that is not "3 or fewer" in the strictest sense — dropping either caution would
    // silently hide an unmet request, exactly what B3 forbids.
    const kinds: ReasonKind[] = ["caution", "fit", "caution", "spec"];
    const result = pickHeadlineReasons(kinds);
    expect(result).toContain(0); // first caution
    expect(result).toContain(2); // second caution
    expect(result).toContain(1); // the one fit reason
  });

  it("B3: includes at least one fit reason when one exists, even alongside a caution", () => {
    const kinds: ReasonKind[] = ["caution", "spec", "fit"];
    const result = pickHeadlineReasons(kinds);
    expect(result).toContain(2); // the fit reason must not be crowded out by caution+spec
  });

  it("B3: never pads past what genuinely exists", () => {
    expect(pickHeadlineReasons(["fit"])).toEqual([0]);
    expect(pickHeadlineReasons([])).toEqual([]);
  });

  it("returns indices that actually address the reasons array", () => {
    for (const { category, attrs, task } of CATEGORY_FIXTURES) {
      const [rec] = run(category, attrs, task);
      for (const i of rec.headline_reasons) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(rec.reasons_ar.length);
        expect(typeof rec.reasons_ar[i]).toBe("string");
      }
      expect(new Set(rec.headline_reasons).size).toBe(rec.headline_reasons.length); // no repeats
    }
  });
});

describe("the ledger cannot record a reason without a kind", () => {
  it("keeps both arrays in step through add and lead", () => {
    const L = new ReasonLedger();
    L.fit("a"); L.evidence("b"); L.identity("head"); L.caution("c");
    expect(L.texts).toEqual(["head", "a", "b", "c"]);
    expect(L.kinds).toEqual(["identity", "fit", "evidence", "caution"]);
    expect(L.texts).toHaveLength(L.kinds.length);
  });
});

describe("withholding a sentence renumbers the ones after it", () => {
  // ADR-187: `reason_kinds` and `headline_reasons` are INDEX-ALIGNED with `reasons_ar`, and
  // `guardAdvisorPayload` removes entries from that array. Without a remap the card would render
  // a survivor under a withheld sentence's kind — silently, and only the day the guard first
  // fires. This is the test for the day it fires.
  it("remaps kinds and headline indices when the guard drops a reason", () => {
    const payload = {
      recommendations: [{
        // The middle sentence claims a saving nothing observed — the guard withholds it.
        reasons_ar: ["مناسب لغرفتك", "وفّرنا لك 900 ريال في متجر زوربلكس", "متوفر في 3 متاجر"],
        reason_kinds: ["fit", "estimate", "evidence"],
        headline_reasons: [0, 1],
      }],
    };
    const { payload: out, withheld } = guardAdvisorPayload(
      payload,
      { figures: [], retailers: [] },
      { query: "q", surface: "test", timestamp: new Date(0).toISOString() },
    );
    const rec = out.recommendations[0];
    expect(withheld.length).toBeGreaterThan(0);
    expect(rec.reasons_ar).toHaveLength(rec.reason_kinds.length);
    // Every surviving sentence still carries ITS OWN kind, not its predecessor's.
    rec.reasons_ar.forEach((text, i) => {
      const expected = text === "مناسب لغرفتك" ? "fit" : "evidence";
      expect(rec.reason_kinds[i]).toBe(expected);
    });
    // Every headline index still addresses a real, surviving sentence.
    for (const i of rec.headline_reasons) {
      expect(typeof rec.reasons_ar[i]).toBe("string");
    }
  });

  it("leaves the aligned fields untouched when nothing is withheld", () => {
    const payload = {
      recommendations: [{
        reasons_ar: ["مناسب لغرفتك", "متوفر في 3 متاجر"],
        reason_kinds: ["fit", "evidence"],
        headline_reasons: [0],
      }],
    };
    const { payload: out, withheld } = guardAdvisorPayload(
      payload,
      { figures: [{ value: 3, kind: "retailer-count", derivedFrom: "live-query" }], retailers: [] },
      { query: "q", surface: "test", timestamp: new Date(0).toISOString() },
    );
    expect(withheld).toHaveLength(0);
    expect(out.recommendations[0].reason_kinds).toEqual(["fit", "evidence"]);
    expect(out.recommendations[0].headline_reasons).toEqual([0]);
  });
});
