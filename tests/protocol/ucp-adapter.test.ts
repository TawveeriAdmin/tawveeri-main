/**
 * Protocol-neutral UCP adapter — maps a Tawveeri canonical product to a UCP-shaped
 * product. Verifies Merchant Independence (merchant_of_record = retailer), measured
 * exits, comparison flag, DNA passthrough, and that no ranking/revenue leaks in.
 */
import { ucpAdapter, ADAPTERS, type TawveeriProduct } from "../../src/lib/protocol/adapter";

const tp: TawveeriProduct = {
  canonical_id: "c1", identity_key: "gree|split|NO_SERIES|24000|Inverter|cool_only",
  title_ar: "مكيف جري", title_en: "Gree AC", brand: "gree", category: "air_conditioner", image_url: null,
  attributes: { capacity_btu: 24000, technology: "Inverter", cooling_mode: "cool_only" },
  comparison_available: true, confidence: 88,
  offers: [
    { store: "extra", price: 2600, currency: "SAR", availability: "in_stock", measured_exit: "/go/o1" },
    { store: "almanea", price: 2500, currency: "SAR", availability: "in_stock", measured_exit: "/go/o2" },
  ],
};

describe("UCP adapter", () => {
  const u = ucpAdapter.toProduct(tp);
  it("registers under the protocol registry", () => {
    expect(ADAPTERS.ucp).toBe(ucpAdapter);
    expect(ucpAdapter.protocol).toBe("ucp");
  });
  it("maps identity, DNA (attributes), and comparison flag", () => {
    expect(u.id).toBe("c1");
    expect(u.attributes.capacity_btu).toBe(24000);
    expect(u.comparison.available).toBe(true);
    expect(u.comparison.confidence).toBe(88);
  });
  it("Merchant Independence: each offer names the retailer as merchant_of_record", () => {
    expect(u.offers.map((o) => o.merchant_of_record).sort()).toEqual(["almanea", "extra"]);
  });
  it("exits are measured via /go (no raw merchant URLs)", () => {
    expect(u.offers.every((o) => o.exit_url.startsWith("/go/"))).toBe(true);
  });
  it("prices carry SAR currency", () => {
    expect(u.offers.every((o) => o.price.currency === "SAR")).toBe(true);
  });
  it("ranking-blind: emits no affiliate/commission/revenue fields", () => {
    const s = JSON.stringify(u).toLowerCase();
    expect(s).not.toMatch(/affiliate|commission|revenue|tawveeri-21/);
  });
});
