// tests/providers/salla-zid-adapter.test.ts
import { extractSallaProduct, mapSallaProduct, mapSallaApiProduct } from "@/lib/providers/sourcing/salla-feed-adapter";

describe("mapSallaApiProduct — Salla storefront API (ADR-108)", () => {
  const base = { name: "آيفون 16 برو ماكس 256", url: "https://salla.sa/jawal-wakthr/x/p742531132", price: 5299, regular_price: 5699, currency: "SAR", image: "https://cdn.salla.sa/x.jpg", brand: { name: "Apple" } };

  it("maps an API product with a real discount", () => {
    const p = mapSallaApiProduct(base) as unknown as Record<string, unknown>;
    expect(p.current_price).toBe(5299);
    expect(p.original_price).toBe(5699);
    expect(p.product_url).toBe("https://salla.sa/jawal-wakthr/x/p742531132");
    expect(p.brand).toBe("Apple");
  });

  it("SAR-gates: rejects a non-SAR price (market scoping)", () => {
    expect(mapSallaApiProduct({ ...base, currency: "AED" })).toBeNull();
  });

  it("captures a valid gtin, ignores an invalid one", () => {
    expect((mapSallaApiProduct({ ...base, gtin: "4006381333931" }) as Record<string, unknown>).gtin).toBe("4006381333931");
    expect((mapSallaApiProduct({ ...base, gtin: "123" }) as Record<string, unknown>).gtin).toBeNull();
  });

  it("marks out_of_stock from is_out_of_stock/status", () => {
    expect((mapSallaApiProduct({ ...base, is_out_of_stock: true }) as Record<string, unknown>).availability).toBe("out_of_stock");
    expect((mapSallaApiProduct({ ...base, status: "out" }) as Record<string, unknown>).availability).toBe("out_of_stock");
  });

  it("rejects a product with no price or url", () => {
    expect(mapSallaApiProduct({ ...base, price: 0 })).toBeNull();
    expect(mapSallaApiProduct({ ...base, url: "" })).toBeNull();
  });

  it("no fabricated original_price when regular ≤ price", () => {
    expect((mapSallaApiProduct({ ...base, regular_price: 5299 }) as Record<string, unknown>).original_price).toBeNull();
  });
});

describe("extractSallaProduct — @type casing (Salla vs Zid)", () => {
  const page = (type: string) =>
    `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": type, name: "مكيف شباك 18000 وحدة",
      offers: { "@type": "Offer", price: "1299", priceCurrency: "SAR", availability: "https://schema.org/InStock" },
    })}</script></head><body></body></html>`;

  it("matches Salla's capitalized @type:Product", () => {
    expect(extractSallaProduct(page("Product"))?.name).toBe("مكيف شباك 18000 وحدة");
  });

  it("matches Zid's lowercase @type:product (the bug that parsed 0 from every Zid store)", () => {
    expect(extractSallaProduct(page("product"))?.name).toBe("مكيف شباك 18000 وحدة");
  });

  it("returns null when there is no product node", () => {
    expect(extractSallaProduct(`<html><body>no ld+json</body></html>`)).toBeNull();
  });
});

describe("mapSallaProduct — Zid product", () => {
  it("maps a lowercase-type Zid product with SAR price to a ScrapedProduct", () => {
    const ld = extractSallaProduct(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "product", name: "هومر مكيف شباك 18000 وحدة", sku: "MP2201",
        offers: { price: "1299", priceCurrency: "SAR", availability: "InStock" },
        image: "https://media.zid.store/x.jpg", brand: "هومر",
      })}</script>`
    )!;
    const p = mapSallaProduct(ld, "https://amnkwm.zid.store/products/homer-ac", "amnkwm") as unknown as Record<string, unknown>;
    expect(p.current_price).toBe(1299);
    expect(p.name_ar).toContain("مكيف شباك");
    expect(p.product_url).toBe("https://amnkwm.zid.store/products/homer-ac");
  });

  it("rejects a non-SAR Zid product (market scoping)", () => {
    const ld = extractSallaProduct(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "product", name: "x", offers: { price: "10", priceCurrency: "KWD" },
      })}</script>`
    )!;
    expect(mapSallaProduct(ld, "https://x.zid.store/products/x", "x")).toBeNull();
  });
});
