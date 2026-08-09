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
import { looksLikeSentenceNotProductQuery } from "@/app/api/search/route";

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
