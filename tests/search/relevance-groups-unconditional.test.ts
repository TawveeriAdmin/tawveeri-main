/**
 * QUALITY PROGRAM P1 §14.3 (2026-08-28): `relevanceGroups` used to be computed only when
 * `queryIsMainProduct` was true (a closed product-noun taxonomy) — any query naming no
 * recognized noun ("PlayStation 5", «ابي شي يبرد الغرفة بسرعة») got `relevanceGroups = []`
 * unconditionally, which made `scoreProduct`'s relevance penalty a no-op AND made
 * `bestMatchesQuery`'s `relevanceGroups.length === 0` clause short-circuit to `true` — its
 * one safety check became a no-op exactly when it mattered most. Live-reproduced: "PlayStation
 * 5" ranked a sandwich maker/vacuum/contact grill (matching the bare digit "5" in "5000
 * Series...") on equal footing with genuine PS5 products, with a decisionCard confidently
 * recommending from that unfiltered set. Fixed by computing the SAME word-groups
 * unconditionally for any non-empty query — zero new matching logic, the exact code every
 * `queryIsMainProduct` query already ran. Scoped narrowly: does NOT touch the `gated`/
 * `categoryEnforcedZero` result-list filter, which keeps its own `queryIsMainProduct` gate.
 */
import { scoreProduct } from "@/app/api/search/route";
import type { GroupedSearchProduct } from "@/lib/scraping/search/product-grouper";
import fs from "fs";
import path from "path";

const product = (over: Partial<GroupedSearchProduct> & { best_price: number; store_name?: string }): GroupedSearchProduct => {
  const price = over.best_price;
  const storeName = over.store_name ?? "متجر";
  return {
    name_ar: over.name_ar ?? "منتج", name_en: over.name_en ?? "Product", brand: over.brand ?? "brand",
    model: "", sku: null, current_price: price, original_price: null, availability: "in_stock",
    product_url: "https://example.com/p", image_urls: [], specifications: {}, category: "mobile" as never,
    description_ar: null, description_en: null,
    stores: [{
      name_ar: over.name_ar ?? "منتج", name_en: over.name_en ?? "Product", brand: over.brand ?? "brand",
      model: "", sku: null, current_price: price, original_price: null, availability: "in_stock",
      product_url: "https://example.com/p", image_urls: [], specifications: {}, category: "mobile" as never,
      description_ar: null, description_en: null, store: storeName, store_name: storeName,
    }],
    store_count: 1,
    ...over,
    best_price: price,
  } as GroupedSearchProduct;
};

describe("scoreProduct — relevance dominates once relevanceGroups is non-empty", () => {
  it("PlayStation 5: a genuine match outscores a bare-digit-only match once relevanceGroups is computed", () => {
    // The exact live-reproduced word-group shape for "PlayStation 5" after the fix: two
    // groups, "playstation" and "5" (short numeric tokens still form their own group; the
    // GENERIC filter only drops words that are ENTIRELY generic across every expansion).
    const relevanceGroups = [["playstation"], ["5"]];
    const genuine = product({ name_en: "Sony PlayStation 5 Console", best_price: 1899 });
    const sandwichMaker = product({ name_en: "5000 Series Sandwich Maker 750 W", best_price: 89 });

    const genuineScore = scoreProduct(genuine, 89, 1899, false, relevanceGroups, false);
    const badScore = scoreProduct(sandwichMaker, 89, 1899, false, relevanceGroups, false);

    // The genuine match hits both groups (relevanceScore=300); the sandwich maker only
    // hits "5" (via "5000") and misses "playstation" entirely (relevanceScore=-400).
    expect(genuineScore).toBeGreaterThan(badScore);
    expect(genuineScore - badScore).toBeGreaterThanOrEqual(600);
  });

  it("before the fix (relevanceGroups=[], the old queryIsMainProduct=false behavior), relevance contributed nothing", () => {
    const genuine = product({ name_en: "Sony PlayStation 5 Console", best_price: 1899 });
    const sandwichMaker = product({ name_en: "5000 Series Sandwich Maker 750 W", best_price: 89 });
    // With NO relevance groups (the pre-fix state for a non-taxonomy query), the two
    // products differ only by price/store signals — pinning that the bug's mechanism was
    // real: relevance genuinely contributed zero to the score before this fix.
    const genuineScore = scoreProduct(genuine, 89, 1899, false, [], false);
    const badScore = scoreProduct(sandwichMaker, 89, 1899, false, [], false);
    expect(genuineScore).toBeLessThan(badScore); // cheaper sandwich maker wins on price alone
  });

  it("cooling need query: a product matching only the common word «بسرعة» scores far below one matching the meaningful word too", () => {
    const relevanceGroups = [["يبرد"], ["الغرفة"]];
    const irrelevantButCommonWord = product({ name_ar: "ذاكرة فلاش بسرعة نقل بيانات عالية", best_price: 50 });
    const geniunelyRelevant = product({ name_ar: "مكيف يبرد الغرفة بسرعة", best_price: 1500 });
    expect(scoreProduct(geniunelyRelevant, 50, 1500, false, relevanceGroups, false))
      .toBeGreaterThan(scoreProduct(irrelevantButCommonWord, 50, 1500, false, relevanceGroups, false));
  });
});

describe("route.ts — relevanceGroups is no longer gated on queryIsMainProduct (structural pin)", () => {
  const routeSrc = fs.readFileSync(path.join(process.cwd(), "src", "app", "api", "search", "route.ts"), "utf8");

  it("relevanceGroups is computed from `rawQuery`, not from `queryIsMainProduct`", () => {
    expect(routeSrc).toMatch(/const relevanceGroups: string\[\]\[\] = rawQuery\s*\n\s*\?/);
  });

  it("the result-list filter (gated/categoryEnforcedZero) is UNCHANGED — still its own queryIsMainProduct gate", () => {
    // Regression guard: the fix must not have widened which products are returned, only
    // ranking/decisionCard eligibility (Tier 2 — widening the result-list filter itself —
    // is a separate, larger, not-yet-made decision).
    expect(routeSrc).toMatch(/if \(rawQuery && queryIsMainProduct\) \{/);
    expect(routeSrc).toMatch(/const wordGroups = relevanceGroups;/);
  });
});
