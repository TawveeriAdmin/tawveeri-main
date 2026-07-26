// tests/providers/salla-zid-adapter.test.ts
import { extractSallaProduct, mapSallaProduct } from "@/lib/providers/sourcing/salla-feed-adapter";

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
