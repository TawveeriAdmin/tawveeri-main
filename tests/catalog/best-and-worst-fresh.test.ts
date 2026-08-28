// tests/catalog/best-and-worst-fresh.test.ts
// Quality program P0 (2026-08-27, §11/§12 of TAWVEERI_QUALITY_PROGRAM_STATE.md) —
// bestAndWorstFresh backs getProductComparison (mobile product page) and
// getMobileCards (/mobiles catalog cards).
import { bestAndWorstFresh } from "../../src/lib/catalog/getProductComparison";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

describe("bestAndWorstFresh — freshness-gated price claim", () => {
  it("excludes a stale historical cheapest, promoting a fresher and pricier offer", () => {
    const { best, worst } = bestAndWorstFresh([
      { price: 999, observedAt: hoursAgo(300) }, // stale, numerically cheapest
      { price: 1099, observedAt: hoursAgo(10) }, // fresh
    ]);
    expect(best).toBe(1099);
    expect(worst).toBe(1099);
  });

  it("returns null/null (honest-zero) when every offer is stale", () => {
    const { best, worst } = bestAndWorstFresh([
      { price: 999, observedAt: hoursAgo(300) },
      { price: 1099, observedAt: hoursAgo(400) },
    ]);
    expect(best).toBeNull();
    expect(worst).toBeNull();
  });

  it("picks the true min/max among multiple fresh offers", () => {
    const { best, worst } = bestAndWorstFresh([
      { price: 300, observedAt: hoursAgo(5) },
      { price: 200, observedAt: hoursAgo(10) },
      { price: 250, observedAt: hoursAgo(1) },
    ]);
    expect(best).toBe(200);
    expect(worst).toBe(300);
  });

  it("a fresh single offer is both best and worst", () => {
    const { best, worst } = bestAndWorstFresh([{ price: 500, observedAt: hoursAgo(2) }]);
    expect(best).toBe(500);
    expect(worst).toBe(500);
  });

  it("a stale single offer goes honest-zero", () => {
    const { best, worst } = bestAndWorstFresh([{ price: 500, observedAt: hoursAgo(300) }]);
    expect(best).toBeNull();
    expect(worst).toBeNull();
  });

  it("an empty list is honest-zero, not an error", () => {
    expect(bestAndWorstFresh([])).toEqual({ best: null, worst: null });
  });
});
