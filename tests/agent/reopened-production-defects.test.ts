/**
 * REOPENED MISSION (2026-08-10) — founder's own live iPhone production report, four cases.
 * Pins the ROOT CAUSES found and fixed, not the literal phrases — each block below states the
 * general invariant it protects and includes adversarial paraphrases beyond the founder's own
 * examples, per the founder's explicit instruction not to patch phrases.
 */
import { isMainProductTypeQuery, detectCanonicalCategories } from "@/app/api/search/route";
import { parseShoppingTask, isPriorityDescriptorWord } from "@/lib/agent/task-parser";
import { routeQuery } from "@/lib/agent/route-query";
import { decideLaptop } from "@/lib/agent/decision-engine";
import type { CanonicalRow } from "@/lib/agent/decision-engine";

describe("Case 3 (SEVERE) — primary-product intent must never be satisfied by an accessory", () => {
  it("«لاب توب» (two-token spelling) is recognized as the laptop product type, same as «لابتوب»", () => {
    expect(isMainProductTypeQuery("ابي لاب توب للجامعه")).toBe(true);
    expect(isMainProductTypeQuery("لاب توب رخيص")).toBe(true);
  });

  it("adversarial: «حاسوب محمول» (formal 'portable computer' synonym) also resolves as laptop", () => {
    expect(isMainProductTypeQuery("ابي حاسوب محمول للعمل")).toBe(true);
    expect(parseShoppingTask("ودي حاسوب محمول للجامعة").category).toBe("laptop");
    expect(detectCanonicalCategories("ودي حاسوب محمول للجامعة")).toEqual(["laptop"]);
  });

  it("the shared classifier and the word-Set agree on already-working single-word forms (no regression)", () => {
    expect(isMainProductTypeQuery("لابتوب أسوس")).toBe(true);
    expect(isMainProductTypeQuery("مكيف سبليت")).toBe(true);
    expect(isMainProductTypeQuery("قصة عشوائية بلا منتج")).toBe(false);
  });
});

describe("Case 3 root cause #1b — the TPS/comparison category scoper must also recognize multi-token spellings", () => {
  it("«لاب توب» resolves to laptop via the shared classifier fallback, not the generic 'mobile' default", () => {
    expect(detectCanonicalCategories("ابي لاب توب للجامعه")).toEqual(["laptop"]);
  });
  it("existing single-word forms are unaffected (no regression)", () => {
    expect(detectCanonicalCategories("لابتوب أسوس")).toEqual(["laptop"]);
    expect(detectCanonicalCategories("مكيف سبليت")).toEqual(["air_conditioner"]);
  });
  it("a genuinely unrecognized query still falls back to the documented 'mobile' default (no regression)", () => {
    expect(detectCanonicalCategories("سامسونج")).toEqual(["mobile"]);
  });
});

describe("Case 3 root cause #3 — a query's context/need words must never be REQUIRED in retrieval", () => {
  it("a priority-descriptor word (need/context, not product identity) is recognized as such", () => {
    expect(isPriorityDescriptorWord("جامعه")).toBe(true);
    expect(isPriorityDescriptorWord("جامعة")).toBe(true);
    expect(isPriorityDescriptorWord("رخيص")).toBe(false); // "رخيص" alone is not a listed priority key (only "ارخص"/"اوفر" as the cheapest marker, a different mechanism) — documents the boundary honestly rather than assuming.
    expect(isPriorityDescriptorWord("لابتوب")).toBe(false); // a product-identity word must never be treated as optional-context
  });
});

describe("Case 3 root cause #2 — ة/ه spelling parity in priority keywords (never phrase-specific)", () => {
  it("«جامعة» and the everyday «جامعه» (ه-ending) both resolve the SAME productivity signal", () => {
    const withTa = parseShoppingTask("ابي لابتوب للجامعة");
    const withHa = parseShoppingTask("ابي لابتوب للجامعه");
    expect(withTa.priorities).toEqual(["productivity"]);
    expect(withHa.priorities).toEqual(["productivity"]);
  });

  it("«عائلة»/«عائله» (large family) both resolve the SAME 'large' signal", () => {
    expect(parseShoppingTask("أبي غسالة لعائلة كبيرة").priorities).toContain("large");
    expect(parseShoppingTask("أبي غسالة لعائله كبيره").priorities).toContain("large");
  });

  it("«الجامعه»/«جامعه» route to advisory (a real need signal), not a bare category browse", () => {
    expect(routeQuery("ابي لاب توب للجامعه").mode).toBe("advisory");
  });
});

describe("Case 2 — design is a distinct, scored laptop use-case (not silently dropped like gaming/productivity used to be)", () => {
  it("«للتصميم» resolves a design priority", () => {
    const task = parseShoppingTask("ابي لاب توب للتصميم");
    expect(task.priorities).toContain("design");
  });
  it("adversarial: video editing / graphic design / 3D phrasings all resolve design", () => {
    expect(parseShoppingTask("ابغى لابتوب للمونتاج").priorities).toContain("design");
    expect(parseShoppingTask("I need a laptop for graphic design").priorities).toContain("design");
    expect(parseShoppingTask("laptop for video editing and rendering").priorities).toContain("design");
  });
  it("decideLaptop scores a discrete GPU + high RAM higher for design, same shape as gaming", () => {
    const rows: CanonicalRow[] = [
      { canonical_id: "a", tps_identity_key: "a", display_name_ar: "مع كرت شاشة", display_name_en: null, brand: "x", category: "laptop", image_url: null, lowest_price: 3000, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 16, gpu: "rtx4050" } },
      { canonical_id: "b", tps_identity_key: "b", display_name_ar: "بدون كرت شاشة", display_name_en: null, brand: "x", category: "laptop", image_url: null, lowest_price: 3000, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { ram: 16, gpu: "igpu" } },
    ];
    const recs = decideLaptop({ category: "laptop", priorities: ["design"] }, rows);
    const withGpu = recs.find((r) => r.canonical_id === "a")!;
    const withoutGpu = recs.find((r) => r.canonical_id === "b")!;
    expect(withGpu.suitability_score).toBeGreaterThan(withoutGpu.suitability_score);
  });
});

describe("Case 4/5 — a fresh mission's own results must never be masked by a prior mission's cached content", () => {
  // The exact race (search-client.tsx's mount-time sessionStorage cache restore reading a
  // possibly-not-yet-hydrated `debouncedQuery` instead of the URL's own `q`) is React-effect-
  // timing behavior, not a pure function — verified live in production (see the mission's
  // final report) rather than unit-tested here, matching this repo's existing convention that
  // effect-timing races are proven via live reproduction, not simulated in jsdom.
  it("category-switch state clearing remains intact for the plain synchronous path (no regression)", () => {
    // Structural regression guard: routeQuery must still name the NEW category correctly for
    // a query that follows an unrelated one — the DecisionState-clearing logic in
    // search-client.tsx keys off exactly this comparison.
    const laptop = routeQuery("ابي لابتوب للدراسه");
    const ac = routeQuery("ابي مكيف بسعر رخيص وجودته عاليه");
    expect(laptop.task?.category).toBe("laptop");
    expect(ac.task?.category).toBe("air_conditioner");
    expect(laptop.task?.category).not.toBe(ac.task?.category);
  });
});
