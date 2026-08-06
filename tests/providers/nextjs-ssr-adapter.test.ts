// tests/providers/nextjs-ssr-adapter.test.ts
// Black Box KSA (blackbox.com.sa) onboarding — see docs/BLACKBOX-RETAILER-ONBOARDING.md.
import { mapNextjsSsrProduct } from "@/lib/providers/sourcing/nextjs-ssr-adapter";
import { nextjsSsrAdapter } from "@/lib/providers/sourcing/nextjs-ssr-adapter";
import { getProvider } from "@/lib/providers/registry";
import { isApprovedStoreId, isDisplayableRetailer } from "@/lib/retailers/approved-retailers";

const URL = "https://www.blackbox.com.sa/product/lg-refrigerator-2-door-p-1311111322700002";

/** Real record shape verified live 2026-08-06 (see file header of the adapter). */
function realShapedProduct(overrides: Record<string, unknown> = {}) {
  return {
    sku: "1311111322700002",
    name: ["ثلاجة ال جي، بابين، 18 قدم، 509 لتر"],
    display_price: 3849,
    prices_with_tax: { price: 3849, original_price: 6599 },
    stock: { is_in_stock: true, qty: 4 },
    _media_: { image: [{ image: "https://store.ops.blackbox.com.sa/media/x.webp", position: "1" }] },
    ...overrides,
  };
}

describe("mapNextjsSsrProduct", () => {
  it("maps a real-shaped product to a ScrapedProduct", () => {
    const r = mapNextjsSsrProduct(realShapedProduct(), URL) as unknown as Record<string, unknown>;
    expect(r).toMatchObject({
      sku: "1311111322700002",
      current_price: 3849,
      original_price: 6599,
      availability: "in_stock",
      product_url: URL,
    });
    expect(r.image_urls).toEqual(["https://store.ops.blackbox.com.sa/media/x.webp"]);
  });

  it("marks out_of_stock when stock.is_in_stock is false", () => {
    const r = mapNextjsSsrProduct(realShapedProduct({ stock: { is_in_stock: false, qty: 0 } }), URL) as unknown as Record<string, unknown>;
    expect(r.availability).toBe("out_of_stock");
  });

  it("drops original_price when it is not actually higher (no fabricated discount)", () => {
    const r = mapNextjsSsrProduct(realShapedProduct({ prices_with_tax: { price: 999, original_price: 999 } }), URL) as unknown as Record<string, unknown>;
    expect(r.original_price).toBeNull();
  });

  it("returns null without a sku, name, or positive price", () => {
    expect(mapNextjsSsrProduct(realShapedProduct({ sku: undefined }), URL)).toBeNull();
    expect(mapNextjsSsrProduct(realShapedProduct({ name: [] }), URL)).toBeNull();
    expect(mapNextjsSsrProduct(realShapedProduct({ display_price: 0, prices_with_tax: { price: 0 } }), URL)).toBeNull();
  });

  // ── HARD PRICE-INTEGRITY INVARIANT ──────────────────────────────────────────────────
  // Black Box runs a first-party, structured conditional "1 SAR add-on" cart mechanic
  // (verified live: RiyalOfferDuplicateNotAllowed/RiyalOfferQtyIncreaseNotAllowed i18n
  // strings; an active "مهرجان الريال" campaign category). A conditional add-on value must
  // NEVER become a standalone product's current_price. This adapter's only defense (no
  // bundle schema exists to model the addon separately) is a price floor: DROP the
  // observation outright rather than ever writing a SAR-1-class price as a real product.
  it("drops (never stores) an observation priced at or below the SAR-1 safety floor", () => {
    expect(mapNextjsSsrProduct(realShapedProduct({ display_price: 1, prices_with_tax: { price: 1 } }), URL)).toBeNull();
    expect(mapNextjsSsrProduct(realShapedProduct({ display_price: 5, prices_with_tax: { price: 5 } }), URL)).toBeNull();
  });

  it("accepts a normal low but real accessory price just above the floor", () => {
    const r = mapNextjsSsrProduct(realShapedProduct({ display_price: 6, prices_with_tax: { price: 6 } }), URL) as unknown as Record<string, unknown>;
    expect(r).not.toBeNull();
    expect(r.current_price).toBe(6);
  });

  // ── free_gifts: preserved as evidence, NEVER read as a price ───────────────────────
  it("preserves free_gifts as evidence in specifications without touching current_price", () => {
    const gifts = [
      { product_name: "Chest Freezer", product_name_ar: "فريزر", product_price: "1299", product_special_price: "1", url: "gift-url" },
    ];
    const r = mapNextjsSsrProduct(realShapedProduct({ free_gifts: gifts }), URL) as unknown as Record<string, unknown>;
    expect(r.current_price).toBe(3849); // the QUALIFYING product's own real price — untouched
    const specs = r.specifications as { free_gifts?: unknown[] };
    expect(specs.free_gifts).toHaveLength(1);
    expect((specs.free_gifts![0] as Record<string, unknown>).addon_price).toBe("1");
    // the "1" lives only in specifications.free_gifts[].addon_price — never in a price field
    expect(JSON.stringify({ current_price: r.current_price, original_price: r.original_price })).not.toContain('"1"');
  });

  it("omits specifications.free_gifts entirely when there are none", () => {
    const r = mapNextjsSsrProduct(realShapedProduct(), URL) as unknown as Record<string, unknown>;
    expect((r.specifications as Record<string, unknown>).free_gifts).toBeUndefined();
  });
});

describe("nextjsSsrAdapter.supports", () => {
  it("supports a provider configured with nextjsSsr + sourcing api", () => {
    expect(nextjsSsrAdapter.supports({ slug: "x", storeId: 1, displayName: "x", enabled: true, sourcing: "api", affiliate: null, nextjsSsr: { origin: "https://x.sa" } })).toBe(true);
  });

  it("does not support a provider without nextjsSsr config", () => {
    expect(nextjsSsrAdapter.supports({ slug: "x", storeId: 1, displayName: "x", enabled: true, sourcing: "api", affiliate: null })).toBe(false);
  });
});

describe("blackbox provider registration (2026-08-06 onboarding)", () => {
  it("is registered with the corrected domain (blackbox.com.sa, not blackboxksa.com)", () => {
    const provider = getProvider("blackbox");
    expect(provider).not.toBeNull();
    expect(provider!.nextjsSsr?.origin).toBe("https://blackbox.com.sa");
    expect(JSON.stringify(provider)).not.toContain("blackboxksa.com");
  });

  it("is approved for ingestion but still NOT displayable pending a production audit (F3)", () => {
    expect(isApprovedStoreId(10)).toBe(true);
    expect(isDisplayableRetailer("blackbox")).toBe(false);
  });
});
