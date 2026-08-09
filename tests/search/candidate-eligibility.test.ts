/**
 * CANDIDATE ELIGIBILITY, GENERICALLY (D→E mission, Section 6 — 2026-08-09).
 *
 * AUDITED FINDING: `/api/search`'s relevance/category gate only ever engages when the query
 * contains a recognized product-type noun (`isMainProductTypeQuery`) — for ANY sentence
 * without one, whatever the underlying fuzzy match (Algolia/Supabase) returned was served
 * completely unfiltered. `looksLikeSentenceNotProductQuery` closes that generically: a
 * sentence-shaped query with no product-type noun is not a product search regardless of WHY
 * it reached this endpoint, and gets the same honest-zero treatment `categoryEnforcedZero`
 * already applies to a failed category-scoped match.
 */
import { looksLikeSentenceNotProductQuery, isAccessoryShapedQuery, excludeIneligibleCandidates } from "@/app/api/search/route";

describe("looksLikeSentenceNotProductQuery — the generic candidate-eligibility floor", () => {
  it("THE FOUNDER'S EXACT T2 SENTENCE is sentence-shaped, not a product query", () => {
    expect(looksLikeSentenceNotProductQuery("طيب لو رفعت ميزانيتي إلى 4000 ريال وش بيتغير؟ وهل يستاهل أدفع الزيادة؟")).toBe(true);
  });

  it("a long sentence (6+ words) with no product noun is sentence-shaped", () => {
    expect(looksLikeSentenceNotProductQuery("أبغى شي يخليني أوفر فلوس هالشهر بجد")).toBe(true);
  });

  it("a short question with a question mark is sentence-shaped even under 6 words", () => {
    expect(looksLikeSentenceNotProductQuery("هل يستاهل؟")).toBe(true);
    expect(looksLikeSentenceNotProductQuery("ليش هذا أفضل")).toBe(true);
  });

  it("a real, short product query is NOT sentence-shaped", () => {
    expect(looksLikeSentenceNotProductQuery("ايفون 16 برو")).toBe(false);
    expect(looksLikeSentenceNotProductQuery("مكيف جري 24000")).toBe(false);
    expect(looksLikeSentenceNotProductQuery("لابتوب ديل")).toBe(false);
  });

  it("a short brand+spec fragment (no question marker, under the word-count floor) is NOT sentence-shaped", () => {
    // This function is only ever CALLED when isMainProductTypeQuery already returned false
    // (a real product query with a recognized noun never reaches it) — this pins its own
    // standalone boundary: short + no question marker = product-fragment-shaped, regardless
    // of whether a noun happens to be recognized.
    expect(looksLikeSentenceNotProductQuery("موديل XR500 ابيض")).toBe(false);
  });

  // MEASURED DEFECT (2026-08-10, D→E mission Section 11 refrigerator re-verification): the
  // ORIGINAL comment above ("only ever CALLED when isMainProductTypeQuery already returned
  // false") turned out to be the bug's own root cause, not just this function's calling
  // convention. «ابي ثلاجة كبيرة للعائلة موفرة للكهرباء وميزانيتي 3000 ريال» contains "ثلاجة"
  // (a recognized MAIN_PRODUCT_TYPES noun), so `isMainProductTypeQuery` returned true and the
  // route's OTHER (weaker) relevance-gate branch ran instead — leaving 324 unfiltered
  // refrigerator results on screen instead of the honest zero the mission's own "zero beats
  // wrong" principle calls for. The route-level fix (src/app/api/search/route.ts) now checks
  // this function FIRST, regardless of whether a category noun is also present — this test
  // pins that a category-noun-bearing sentence still classifies as sentence-shaped, which is
  // the precondition the route-level fix depends on.
  it("a sentence-shaped query that ALSO contains a recognized category noun is still sentence-shaped", () => {
    expect(looksLikeSentenceNotProductQuery("ابي ثلاجة كبيرة للعائلة موفرة للكهرباء وميزانيتي 3000 ريال")).toBe(true);
    expect(looksLikeSentenceNotProductQuery("ابي مكيف لغرفة 30 متر هادي وموفر للكهرباء وميزانيتي 2500 ريال")).toBe(true);
  });
});

/**
 * "FILTER ELIGIBILITY FIRST. SORT SECOND. PRICE MAY RANK ELIGIBLE PRODUCTS. PRICE MUST NEVER
 * MAKE AN INELIGIBLE PRODUCT ELIGIBLE." (D→E mission Part B — 2026-08-10, full autonomy
 * mandate, "accessories / irrelevant products must not win".)
 */
describe("isAccessoryShapedQuery — the query-level half of the accessory distinction", () => {
  it("recognizes an explicit accessory search, even when it also names a device", () => {
    expect(isAccessoryShapedQuery("جراب ايفون")).toBe(true);
    expect(isAccessoryShapedQuery("شاحن لابتوب")).toBe(true);
    expect(isAccessoryShapedQuery("iphone case")).toBe(true);
    expect(isAccessoryShapedQuery("كفر جوال متوافق مع ايفون 16")).toBe(true);
  });
  it("a plain device search is NOT accessory-shaped", () => {
    expect(isAccessoryShapedQuery("ايفون 16 برو")).toBe(false);
    expect(isAccessoryShapedQuery("لابتوب ديل")).toBe(false);
    expect(isAccessoryShapedQuery("مكيف جري 24000")).toBe(false);
  });
});

describe("excludeIneligibleCandidates — MEASURED LIVE (production, 2026-08-10): 'لابتوب' sorted lowest-price-first", () => {
  // Reproduces the exact production evidence: real laptop prices from the same search
  // (ideapad 3 2299, elitebook 999, latitude 1799 …) alongside the four measured junk items
  // that ranked above every one of them. None of the junk titles match `hasAccessoryHint`'s
  // keyword list (verified separately) — the price-floor stage is what must catch these.
  const junk = [
    { name_ar: "لابتوب pingcool PC18", name_en: null, best_price: 4 },
    { name_ar: "لابتوب baseus SUZC-0G", name_en: null, best_price: 21 },
    { name_ar: "لابتوب لينوفو GX41K08218", name_en: null, best_price: 75 },
    { name_ar: "تجميعة السماعة الداخلية للكمبيوتر المحمول، مصممة للابتوب المدمج والمتين", name_en: null, best_price: 101 },
  ];
  // A representative SPREAD, not just a few cheap entries clustered together — with only a
  // handful of items the fixture's OWN median would sit far below the real 497-item
  // population's (~2,000-3,000+ SAR, per the live page actually observed), under-testing
  // the price floor exactly where it matters. These are the real prices captured on the
  // same live page as the junk above.
  const real = [
    { name_ar: "لابتوب اتش بي elitebook، i5-8، 8GB رام، 256GB", name_en: null, best_price: 999 },
    { name_ar: "لابتوب ديل latitude، i5-8، 8GB رام، 256GB، 14\"", name_en: null, best_price: 669 },
    { name_ar: "لابتوب أيسر aspire، core3، 8GB رام، 256GB، 15.6\"", name_en: null, best_price: 1799 },
    { name_ar: "لابتوب لينوفو ideapad 3، i5-13، 8GB رام، 512GB، 15.6\"", name_en: null, best_price: 2299 },
    { name_ar: "لابتوب اتش بي، core5، 16GB رام، 512GB، 16\"", name_en: null, best_price: 3299 },
    { name_ar: "لابتوب إم إس آي cyborg، i5-13، 16GB رام، 512GB، 15.6\" RTX4050", name_en: null, best_price: 3549 },
    { name_ar: "لابتوب اتش بي، core7، 16GB رام، 1TB، 14\"", name_en: null, best_price: 3999 },
  ];

  it("excludes every measured junk item while keeping every genuine laptop", () => {
    const result = excludeIneligibleCandidates([...junk, ...real]);
    const survivingNames = result.map((r) => r.name_ar);
    for (const j of junk) expect(survivingNames).not.toContain(j.name_ar);
    for (const r of real) expect(survivingNames).toContain(r.name_ar);
  });

  it("excludes a keyword-flagged accessory (the ORIGINAL soft-penalty case) too, not just the price-floor case", () => {
    const cable = { name_ar: "كيبل شحن ايفون", name_en: null, best_price: 49 };
    const result = excludeIneligibleCandidates([cable, ...real]);
    expect(result.map((r) => r.name_ar)).not.toContain(cable.name_ar);
  });

  it("never wipes the page: if EVERY candidate is accessory-hinted, keeps them rather than returning zero", () => {
    const allAccessories = [
      { name_ar: "كيبل شحن ايفون", name_en: null, best_price: 49 },
      { name_ar: "شاحن ايفون سريع", name_en: null, best_price: 39 },
    ];
    expect(excludeIneligibleCandidates(allAccessories)).toHaveLength(2);
  });

  it("does not apply the price floor with too few candidates to compute a meaningful median (fewer than 4)", () => {
    const tiny = [
      { name_ar: "لابتوب pingcool PC18", name_en: null, best_price: 4 },
      { name_ar: "لابتوب ديل latitude، i5-8، 8GB رام، 256GB، 14\"", name_en: null, best_price: 669 },
    ];
    // Below the 4-item floor this function itself documents — both survive untouched rather
    // than a median computed from too small a sample to be a real statistical signal.
    expect(excludeIneligibleCandidates(tiny)).toHaveLength(2);
  });

  it("leaves a genuinely cheap but real clearance-priced device untouched (well above 15% of median)", () => {
    const clearance = { name_ar: "لابتوب اتش بي elitebook، i5-4، 4GB رام، 500GB، 12.5\"", name_en: null, best_price: 475 };
    // median of [475, 669, 999, 1799, 2299, 3299, 3549, 3999] (8 items) = the 5th sorted
    // value = 2299 → floor = 344.85; 475 clears it easily.
    const result = excludeIneligibleCandidates([clearance, ...real]);
    expect(result.map((r) => r.name_ar)).toContain(clearance.name_ar);
  });
});
