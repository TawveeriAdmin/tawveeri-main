/**
 * ZERO-STATE "CLOSEST OPTIONS" — pure selection (ADR-270, Decision Card v1 follow-up,
 * 2026-08-22). "Tawveeri never shows an empty result": when a stated/inferred budget zeroed
 * retrieval, this names the 1-3 cheapest still-relevant candidates and why each missed.
 */
import { selectClosestOptions } from "@/app/api/search/route";
import type { GroupedSearchProduct } from "@/lib/scraping/search/product-grouper";

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

describe("selectClosestOptions — zero-state fallback selection", () => {
  it("picks only candidates over the effective budget, sorted cheapest-first", () => {
    const candidates = [
      product({ name_ar: "أ", best_price: 4000 }),
      product({ name_ar: "ب", best_price: 3600 }),
      product({ name_ar: "ج", best_price: 3400 }), // within budget — must be excluded
    ];
    const result = selectClosestOptions(candidates, 3500, []);
    expect(result.map((r) => r.name_ar)).toEqual(["ب", "أ"]); // 3600 before 4000, 3400 excluded
  });

  it("caps at 3 and never pads past what exists", () => {
    const many = Array.from({ length: 5 }, (_, i) => product({ name_ar: `p${i}`, best_price: 4000 + i * 100 }));
    expect(selectClosestOptions(many, 3500, [])).toHaveLength(3);
    expect(selectClosestOptions([product({ best_price: 4000 })], 3500, [])).toHaveLength(1);
    expect(selectClosestOptions([], 3500, [])).toEqual([]);
  });

  it("states the exact overage in the miss reason — no fabricated evidence", () => {
    const [r] = selectClosestOptions([product({ best_price: 3899 })], 3500, []);
    expect(r.miss_reason_ar).toBe("أعلى من ميزانيتك بـ 399 ريال");
    expect(r.miss_reason_en).toBe("399 SAR above your budget");
  });

  it("only surfaces candidates matching every relevance group — never an unrelated 'closest'", () => {
    const candidates = [
      product({ name_ar: "جوال ايفون 128 قيقا", best_price: 4000 }),
      product({ name_ar: "لابتوب ديل", best_price: 3600 }), // cheaper, but not a phone
    ];
    const relevanceGroups = [["جوال", "ايفون"]];
    const result = selectClosestOptions(candidates, 3500, relevanceGroups);
    expect(result).toHaveLength(1);
    expect(result[0].name_ar).toBe("جوال ايفون 128 قيقا");
  });

  it("names the store behind the winning price", () => {
    const p = product({ best_price: 3900, store_name: "جرير" });
    const [r] = selectClosestOptions([p], 3500, []);
    expect(r.store_name).toBe("جرير");
  });
});
