// tests/providers/shopify-adapter.test.ts
import { mapShopifyProduct } from "@/lib/providers/sourcing/shopify-feed-adapter";

const ORIGIN = "https://shop.example.sa";

describe("mapShopifyProduct", () => {
  it("maps a real-shaped product to a ScrapedProduct", () => {
    const p = {
      title: "Samsung Galaxy S24 256GB",
      handle: "samsung-galaxy-s24-256gb",
      vendor: "Samsung",
      product_type: "Smartphones",
      variants: [{ price: "3499.00", available: true, sku: "SM-S921", barcode: "8806095299013" }],
      images: [{ src: "https://cdn.shopify.com/x.jpg" }],
    };
    const r = mapShopifyProduct(p, ORIGIN) as unknown as Record<string, unknown>;
    expect(r).toMatchObject({
      name_en: "Samsung Galaxy S24 256GB",
      brand: "Samsung",
      sku: "SM-S921",
      current_price: 3499,
      availability: "in_stock",
      product_url: `${ORIGIN}/products/samsung-galaxy-s24-256gb`,
    });
    expect(r.image_urls).toEqual(["https://cdn.shopify.com/x.jpg"]);
  });

  it("captures a checksum-valid GTIN from a variant barcode", () => {
    const r = mapShopifyProduct({ title: "X", handle: "x", variants: [{ price: "10", barcode: "4006381333931" }] }, ORIGIN) as unknown as Record<string, unknown>;
    expect(r.gtin).toBe("4006381333931");
  });

  it("ignores an invalid barcode (never fabricates identity)", () => {
    const r = mapShopifyProduct({ title: "X", handle: "x", variants: [{ price: "10", barcode: "not-a-gtin" }] }, ORIGIN) as unknown as Record<string, unknown>;
    expect(r.gtin).toBeNull();
  });

  it("finds a valid barcode on a non-first variant", () => {
    const r = mapShopifyProduct({ title: "X", handle: "x", variants: [{ price: "10" }, { price: "10", barcode: "4006381333931" }] }, ORIGIN) as unknown as Record<string, unknown>;
    expect(r.gtin).toBe("4006381333931");
  });

  it("marks out_of_stock when no variant is available", () => {
    const r = mapShopifyProduct({ title: "X", handle: "x", variants: [{ price: "10", available: false }] }, ORIGIN) as unknown as Record<string, unknown>;
    expect(r.availability).toBe("out_of_stock");
  });

  it("returns null without a title, price, or handle", () => {
    expect(mapShopifyProduct({ handle: "x", variants: [{ price: "10" }] }, ORIGIN)).toBeNull();
    expect(mapShopifyProduct({ title: "X", variants: [{ price: "10" }] }, ORIGIN)).toBeNull();
    expect(mapShopifyProduct({ title: "X", handle: "x", variants: [{ price: "0" }] }, ORIGIN)).toBeNull();
  });
});
