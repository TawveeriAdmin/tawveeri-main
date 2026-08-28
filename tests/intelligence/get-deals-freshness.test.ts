/**
 * QUALITY PROGRAM P1 §19.2 item 3 (2026-08-28): the Deal Engine's "best offer" per
 * product used to be the raw cheapest flagged-deal row with zero freshness check — the
 * storefront-layer twin of the gap §17.1/§19.1/§20 already fixed elsewhere, here for the
 * platform's highest-stakes claim (a "deal" implies urgency; a stale "98% off" is worse
 * than a stale "best price"). selectBestDealOffer mirrors the same isFreshObservation()
 * gate and backward-compatible, never-drops-coverage fallback tiering used throughout
 * this program's storefront-layer fixes.
 */
import { selectBestDealOffer, type OfferCandidate } from "@/lib/intelligence/getDeals";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const offer = (over: Partial<OfferCandidate>): OfferCandidate => ({
  id: over.id ?? "o1",
  price: over.price ?? 100,
  was: over.was ?? 150,
  storeAr: over.storeAr ?? "متجر",
  storeEn: over.storeEn ?? "Store",
  observedAt: over.observedAt ?? null,
});

describe("selectBestDealOffer", () => {
  it("no freshness data at all — falls back to the raw cheapest (unchanged original behavior)", () => {
    const offers = [offer({ id: "a", price: 200 }), offer({ id: "b", price: 100 })];
    expect(selectBestDealOffer(offers).id).toBe("b");
  });

  it("stale cheapest + fresh more-expensive offer — the fresh one wins", () => {
    const offers = [
      offer({ id: "stale-cheap", price: 100, observedAt: hoursAgo(400) }),
      offer({ id: "fresh-pricier", price: 150, observedAt: hoursAgo(2) }),
    ];
    expect(selectBestDealOffer(offers).id).toBe("fresh-pricier");
  });

  it("stale-only offers — falls back to the cheapest of the stale set, never drops the product", () => {
    const offers = [
      offer({ id: "a", price: 200, observedAt: hoursAgo(400) }),
      offer({ id: "b", price: 100, observedAt: hoursAgo(500) }),
    ];
    expect(selectBestDealOffer(offers).id).toBe("b");
  });

  it("multiple fresh offers — cheapest fresh one wins", () => {
    const offers = [
      offer({ id: "a", price: 300, observedAt: hoursAgo(1) }),
      offer({ id: "b", price: 200, observedAt: hoursAgo(2) }),
      offer({ id: "c", price: 250, observedAt: hoursAgo(3) }),
    ];
    expect(selectBestDealOffer(offers).id).toBe("b");
  });

  it("just inside vs just outside the 168h floor", () => {
    const fresh = [offer({ id: "fresh", price: 100, observedAt: hoursAgo(167.9) })];
    const staleTwo = [
      offer({ id: "stale-a", price: 100, observedAt: hoursAgo(168.1) }),
      offer({ id: "stale-b", price: 200, observedAt: hoursAgo(168.1) }),
    ];
    expect(selectBestDealOffer(fresh).id).toBe("fresh");
    expect(selectBestDealOffer(staleTwo).id).toBe("stale-a");
  });

  it("single offer — works with one candidate", () => {
    expect(selectBestDealOffer([offer({ id: "only", price: 100, observedAt: hoursAgo(5) })]).id).toBe("only");
  });

  it("preserves the was/store fields of the winning offer, not a mix of fields from different offers", () => {
    const bTime = hoursAgo(2);
    const offers = [
      offer({ id: "a", price: 300, was: 400, storeAr: "متجر أ", observedAt: hoursAgo(1) }),
      offer({ id: "b", price: 200, was: 250, storeAr: "متجر ب", observedAt: bTime }),
    ];
    const best = selectBestDealOffer(offers);
    expect(best).toEqual({ id: "b", price: 200, was: 250, storeAr: "متجر ب", storeEn: "Store", observedAt: bTime });
  });

  it("never mutates the input array", () => {
    const offers = [
      offer({ id: "a", price: 200, observedAt: hoursAgo(400) }),
      offer({ id: "b", price: 100, observedAt: hoursAgo(1) }),
    ];
    const before = offers.map((o) => o.id);
    selectBestDealOffer(offers);
    expect(offers.map((o) => o.id)).toEqual(before);
  });
});
