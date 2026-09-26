// tests/scraping/product-adapter-routing.test.ts — ADR-386.
// A search card's `slug` must be the ROUTABLE slug the search route emitted (`products.slug`,
// a UUID, or a TPS identity slug) — never a title-derived string. Live 404 reproduced
// 2026-09-26: products.slug "samsung-split-ac-18000-bturotary-compressorheat-and-cold"
// (generateSlug strips punctuation) vs the card's re-derived
// "samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold" (punctuation → hyphen).
import { mapGroupedToProductCard } from "../../src/lib/scraping/product-adapter";
import type { GroupedSearchProduct } from "../../src/lib/scraping/search/product-grouper";

const grouped = (over: Partial<GroupedSearchProduct> = {}): GroupedSearchProduct =>
  ({
    name_ar: "Samsung Split AC 18000 BTU Rotary Compressor Heat and Cold",
    name_en: "Samsung Split AC, 18000 BTU,Rotary Compressor,Heat and Cold",
    brand: "samsung",
    model: "",
    sku: null,
    current_price: 1155,
    original_price: null,
    availability: "in_stock",
    product_url: "https://www.extra.com/x",
    image_urls: [],
    specifications: {},
    category: "air_conditioner",
    description_ar: null,
    description_en: null,
    is_free_delivery: false,
    delivery_time_days: null,
    delivery_cost: 0,
    is_deal: false,
    coupon_code: null,
    stores: [
      {
        name_ar: "x", name_en: "x", brand: "samsung", model: "", sku: null, current_price: 1155, original_price: null,
        availability: "in_stock", product_url: "https://www.extra.com/x", image_urls: [], specifications: {},
        category: "air_conditioner", description_ar: null, description_en: null, is_free_delivery: false,
        delivery_time_days: null, delivery_cost: 0, is_deal: false, coupon_code: null, store: "extra", store_name: "اكسترا",
        rating: null, review_count: null,
      },
    ],
    best_price: 1155,
    store_count: 1,
    ...over,
  }) as unknown as GroupedSearchProduct;

describe("mapGroupedToProductCard — routable slug + retailer display names", () => {
  it("prefers the route-supplied product_slug over a title-derived slug (the live Samsung 404)", () => {
    const card = mapGroupedToProductCard(grouped({ product_slug: "samsung-split-ac-18000-bturotary-compressorheat-and-cold" }));
    expect(card.slug).toBe("samsung-split-ac-18000-bturotary-compressorheat-and-cold");
  });

  it("accepts a UUID product_slug unchanged (the product page resolves by id too)", () => {
    const card = mapGroupedToProductCard(grouped({ product_slug: "c938d587-65b2-4474-8a51-507060668aa0" }));
    expect(card.slug).toBe("c938d587-65b2-4474-8a51-507060668aa0");
  });

  it("falls back to the title-derived slug only when the route supplied none", () => {
    const card = mapGroupedToProductCard(grouped());
    expect(card.slug).toBe("samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold");
  });

  it("names approved retailers the search route emits as slugs (najm/alnakheelk) instead of echoing the internal slug", () => {
    const g = grouped();
    g.stores = [
      { ...g.stores[0], store: "alnakheelk", store_name: "alnakheelk" },
      { ...g.stores[0], store: "najm", store_name: "najm", current_price: 1200 },
      { ...g.stores[0], store: "extra", store_name: "extra", current_price: 1300 },
    ];
    const card = mapGroupedToProductCard(g);
    const names = Object.fromEntries(card.product_stores.map((ps) => [ps.stores?.id, ps.stores?.name_ar]));
    expect(names.alnakheelk).toBe("متجر النخيل");
    expect(names.najm).toBe("نجم الأجهزة");
    expect(names.extra).toBe("اكسترا");
  });
});
