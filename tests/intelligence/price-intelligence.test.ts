/**
 * Price Intelligence — deterministic buy-timing verdict. These tests ENFORCE the
 * trust guarantees: no fabricated "record low" on thin data, de-biased daily-
 * cheapest signal, and the boldest claim requiring the most evidence.
 */
import { computePriceVerdict, type PricePoint } from "../../src/lib/intelligence/price-intelligence";

const BASE = Date.UTC(2026, 6, 22, 0, 0, 0); // Wed Jul 22 2026, midnight UTC
const NOW = BASE + 12 * 3600_000;
const DAY = 86_400_000;
// daysAgo: 0 = today (Jul 22); larger = older. hour keeps rows within the same UTC day.
const at = (daysAgo: number, hour = 10) => new Date(BASE - daysAgo * DAY + hour * 3600_000).toISOString();
const pt = (price: number, daysAgo: number, hour = 10, store = "extra"): PricePoint => ({ price, at: at(daysAgo, hour), store });

describe("Precision gate — never fabricate confidence on thin data", () => {
  it("a SINGLE observation returns building_history, NOT a record low (the bug fix)", () => {
    const v = computePriceVerdict([pt(1000, 0)], NOW);
    expect(v.verdict).toBe("building_history");
    expect(v.confident).toBe(false);
    expect(v.isObservedLow).toBe(false); // must NOT claim "lowest price 🔥"
    expect(v.text.ar).toMatch(/نبني سجل/);
    expect(v.text.en).toMatch(/Building price history/);
  });
  it("two days of history is still insufficient (< MIN_DISTINCT_DAYS), even with a big drop", () => {
    const v = computePriceVerdict([pt(1200, 3), pt(900, 0)], NOW);
    expect(v.verdict).toBe("building_history");
    expect(v.confident).toBe(false);
  });
  it("empty history is handled (no crash)", () => {
    const v = computePriceVerdict([], NOW);
    expect(v.verdict).toBe("building_history");
    expect(v.currentBest).toBeNull();
  });
});

describe("Verdicts on genuine history", () => {
  it("great_price: ≥5 days and current at the observed low", () => {
    const v = computePriceVerdict([pt(1200, 5), pt(1150, 4), pt(1100, 3), pt(1050, 2), pt(1000, 1), pt(990, 0)], NOW);
    expect(v.verdict).toBe("great_price");
    expect(v.confident).toBe(true);
    expect(v.isObservedLow).toBe(true);
    expect(v.observedLow).toBe(990);
    expect(v.currentBest).toBe(990);
    expect(v.text.en).toMatch(/Best price/);
  });
  it("good_price: below typical but not enough days to claim 'best ever'", () => {
    const v = computePriceVerdict([pt(1000, 3), pt(1000, 2), pt(1000, 1), pt(900, 0)], NOW);
    expect(v.verdict).toBe("good_price");
    expect(v.pctVsTypical).toBeLessThanOrEqual(-2);
  });
  it("elevated: current meaningfully above typical → wait signal", () => {
    const v = computePriceVerdict([pt(900, 4), pt(900, 3), pt(900, 2), pt(900, 1), pt(1100, 0)], NOW);
    expect(v.verdict).toBe("elevated");
    expect(v.pctVsTypical).toBeGreaterThanOrEqual(2);
    expect(v.text.ar).toMatch(/أعلى من المعتاد/);
  });
  it("typical: current around the median, clearly above the observed low", () => {
    const v = computePriceVerdict([pt(950, 4), pt(1000, 3), pt(1000, 2), pt(1050, 1), pt(1000, 0)], NOW);
    expect(v.verdict).toBe("typical");
    expect(v.isObservedLow).toBe(false);
  });
});

describe("De-biased signal — daily-cheapest, not raw rows", () => {
  it("a frequently-scraped expensive store does NOT skew 'typical' or fake a deal", () => {
    // 4 days; each day: expensive store scraped 10× @2000 + cheap store 1× @1000.
    const pts: PricePoint[] = [];
    for (let d = 3; d >= 0; d--) {
      for (let i = 0; i < 10; i++) pts.push(pt(2000, d, 8 + i, "storeA"));
      pts.push(pt(1000, d, 20, "storeB"));
    }
    const v = computePriceVerdict(pts, NOW);
    // daily cheapest is a steady 1000 → typical=1000 (NOT a raw mean ≈ 1900)
    expect(v.typical).toBe(1000);
    expect(v.currentBest).toBe(1000);
    expect(v.verdict).toBe("typical"); // steady, not a fabricated "great deal"
  });
});

describe("Drop detection", () => {
  it("counts day-over-day decreases and records the last drop", () => {
    const v = computePriceVerdict([pt(1000, 4), pt(1000, 3), pt(900, 2), pt(900, 1), pt(900, 0)], NOW);
    expect(v.dropCount).toBe(1);
    expect(v.lastDrop).not.toBeNull();
    expect(v.lastDrop!.from).toBe(1000);
    expect(v.lastDrop!.to).toBe(900);
  });
});
