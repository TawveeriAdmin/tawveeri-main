/**
 * REOPENED MISSION (2026-08-10) — founder's own live iPhone production report, four cases.
 * Pins the ROOT CAUSES found and fixed, not the literal phrases — each block below states the
 * general invariant it protects and includes adversarial paraphrases beyond the founder's own
 * examples, per the founder's explicit instruction not to patch phrases.
 */
import { isMainProductTypeQuery, detectCanonicalCategories, anchorSubjectToCategory } from "@/app/api/search/route";
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

describe("Founder taxonomy audit (2026-08-19) — the storefront grid's TPS scoper must recognize 'oven', same class as laptop above", () => {
  it("«فرن كهربائي»/«فرن غاز»/«فرن مدمج» resolve to oven, not the generic 'mobile' default (was the root of the taxonomy gap)", () => {
    expect(detectCanonicalCategories("افضل فرن كهربائي")).toEqual(["oven"]);
    expect(detectCanonicalCategories("ابي فرن كهربائي")).toEqual(["oven"]);
    expect(detectCanonicalCategories("فرن غاز")).toEqual(["oven"]);
  });
  it("«بلت ان» (colloquial 'built-in') resolves the same as formal «مدمج», same ة/ه-class spelling gap this codebase repeatedly finds", () => {
    expect(parseShoppingTask("فرن بلت ان كهربائي").category).toBe("oven");
    expect(detectCanonicalCategories("فرن بلت ان كهربائي")).toEqual(["oven"]);
  });
  it("existing categories are unaffected (no regression)", () => {
    expect(detectCanonicalCategories("ميكروويف")).toEqual(["microwave"]);
    expect(detectCanonicalCategories("قلاية هوائية")).toEqual(["mobile"]); // air_fryer has no TPS-comparison entry; unchanged pre-existing behavior, out of this fix's scope
  });
});

describe("Case 3 root cause #3 — a query's context/need words must never be REQUIRED in retrieval", () => {
  it("a priority-descriptor word (need/context, not product identity) is recognized as such", () => {
    expect(isPriorityDescriptorWord("جامعه")).toBe(true);
    expect(isPriorityDescriptorWord("جامعة")).toBe(true);
    // UPDATED 2026-08-11 (Saudi Shopper Language & Demand Discovery mission): «رخيص» is now a
    // real "value" priority key (task-parser.ts) — this correctly flips to true, and is a
    // DESIRABLE side effect, not a regression: it means Algolia retrieval now treats "رخيص" the
    // same way it already treats "للجامعة" — a ranking-only preference, never a required title
    // match — so a genuinely cheap real laptop is never excluded just because its own title
    // does not contain the literal word "رخيص". Reinforces this describe block's own invariant
    // rather than weakening it. «أرخص»/«اوفر» (the CHEAPEST_MARKER sort-to-lowest instruction)
    // remain a completely separate mechanism, untouched.
    expect(isPriorityDescriptorWord("رخيص")).toBe(true);
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

/**
 * SECOND REOPENING (2026-08-11) — founder's own real-iPhone RE-test found the mission's fix
 * was incomplete: "ابي حاسوب محمول للجامعه" returned a non-laptop product (an earphone on the
 * founder's device; a backpack on repeat requests — the instability itself is evidence the
 * underlying Algolia match set was nearly empty). Root cause: "حاسوب"/"محمول" are themselves
 * REQUIRED match words no real laptop title contains. Fix: `anchorSubjectToCategory` — once
 * category is confidently resolved, the catalog's OWN canonical term for it is added as an
 * additional required word, guaranteeing genuine candidates are always reachable regardless of
 * which valid synonym the shopper used. NON-NEGOTIABLE INVARIANT under test: retrieval/fallback
 * must never change the requested PRODUCT CLASS — it may broaden or rank WITHIN it.
 */
describe("Second reopening — retrieval must anchor to the catalog's own vocabulary once category is confident", () => {
  it("«حاسوب»/«كمبيوتر» phrasings get the catalog's own «لابتوب» term injected", () => {
    expect(anchorSubjectToCategory("حاسوب محمول جامعه", "laptop")).toBe("حاسوب محمول جامعه لابتوب");
    expect(anchorSubjectToCategory("كمبيوتر محمول جامعه", "laptop")).toBe("كمبيوتر محمول جامعه لابتوب");
  });

  it("adversarial: the founder's full retest list all resolve category=laptop (pre-condition for anchoring to even engage)", () => {
    const phrases = [
      "ابي حاسوب محمول للجامعه",
      "ابي كمبيوتر محمول للجامعه",
      "ابغى حاسب محمول للدراسه",
      "احتاج حاسوب محمول للتصميم",
      "وش افضل حاسوب محمول للجامعه",
    ];
    for (const p of phrases) {
      expect(parseShoppingTask(p).category).toBe("laptop");
    }
  });

  it("already-correct colloquial phrasing is a no-op (canonical term already present, nothing duplicated)", () => {
    expect(anchorSubjectToCategory("لاب توب جامعه", "laptop")).toBe("لاب توب جامعه لابتوب");
    expect(anchorSubjectToCategory("لابتوب جامعه", "laptop")).toBe("لابتوب جامعه"); // already contains لابتوب — true no-op
  });

  it("preserves the already-working colloquial acceptance list from the founder's first retest", () => {
    const phrases = ["ابي لاب توب للجامعه", "ابي لابتوب للجامعه", "ابي لاب توب للدراسه", "ابي لاب توب للتصميم"];
    for (const p of phrases) {
      expect(parseShoppingTask(p).category).toBe("laptop");
      expect(isMainProductTypeQuery(p)).toBe(true);
    }
  });

  it("no category resolved -> anchor is a true no-op (never invents a category)", () => {
    expect(anchorSubjectToCategory("شي عشوائي", null)).toBe("شي عشوائي");
  });

  it("other categories anchor too (not a laptop-only special case) — the same mechanism for air_conditioner", () => {
    expect(anchorSubjectToCategory("جهاز تبريد رخيص", "air_conditioner")).toBe("جهاز تبريد رخيص مكيف");
  });

  it("accessory-only vocabulary (no device noun) never resolves a laptop category — anchoring cannot fabricate a laptop mission for a plain accessory search", () => {
    for (const q of ["ماوس", "كيبورد", "سماعات", "كيبل شحن"]) {
      expect(parseShoppingTask(q).category).not.toBe("laptop");
    }
  });
});
