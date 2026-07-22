// src/lib/intelligence/price-intelligence.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tawveeri Price Intelligence — the deterministic "is this a good price, and
// should I buy now?" core. Pure function (no I/O, no Date.now) so it is fully
// testable and reproducible. Fuses with the Decision Agent to answer WHEN to buy.
//
// PRINCIPLES (enforced here, not asserted):
//  • Precision over recall / no fabricated data: a verdict is only rendered when
//    genuine history exists (≥ MIN_DISTINCT_DAYS distinct days). Thin data returns
//    `building_history` — honest, and it showcases the compounding data moat.
//  • De-biased signal: we reason over the DAILY-CHEAPEST price a buyer actually
//    faces, not raw rows — so a store scraped 5×/day cannot skew the "typical".
//  • The boldest claim needs the most evidence: `great_price` ("best since tracking")
//    requires ≥ MIN_DAYS_FOR_GREAT distinct days, not a lucky single low reading.
//  • Bilingual (ar/en), deterministic phrasing (no LLM).
// ─────────────────────────────────────────────────────────────────────────────

export type PriceVerdictKind = "great_price" | "good_price" | "typical" | "elevated" | "building_history";

export interface PricePoint { price: number; store?: string | null; at: string | number | Date }

export interface PriceDrop { from: number; to: number; at: string; pct: number }

export interface PriceVerdict {
  verdict: PriceVerdictKind;
  confident: boolean;              // false ⇒ building_history (insufficient evidence)
  currentBest: number | null;      // cheapest price on the most recent observed day
  observedLow: number | null;      // lowest daily-cheapest ever observed
  observedHigh: number | null;
  typical: number | null;          // median of the daily-cheapest series (robust)
  pctVsTypical: number | null;     // signed % of currentBest vs typical (− = cheaper)
  isObservedLow: boolean;          // currentBest at/near the observed low (only when confident)
  trend: "rising" | "falling" | "stable";
  daysTracked: number;             // calendar days since first observation
  distinctDays: number;            // number of days with at least one observation
  points: number;                  // total valid observations
  dropCount: number;               // day-over-day decreases in daily-cheapest series
  lastDrop: PriceDrop | null;
  text: { ar: string; en: string };
}

// ── Deterministic thresholds (named, auditable) ──
const MIN_DISTINCT_DAYS = 3;       // below this → building_history (no verdict)
const MIN_POINTS = 3;
const MIN_DAYS_FOR_GREAT = 5;      // "best since tracking" needs ≥5 days of evidence
const NEAR_LOW_TOL = 0.02;         // within 2% of the observed low counts as "at the low"
const TYPICAL_BAND = 0.02;         // ±2% of the median is "typical"

function dayKey(at: string | number | Date): string {
  const d = at instanceof Date ? at : new Date(at);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * Compute a deterministic buy-timing verdict from a product's price history.
 * @param points raw price observations (any store, any time)
 * @param nowMs  current time in ms (injected — keeps this pure/testable)
 */
export function computePriceVerdict(points: PricePoint[], nowMs: number): PriceVerdict {
  const valid = (points ?? []).filter((p) => Number.isFinite(Number(p.price)) && Number(p.price) > 0);

  // Build the DAILY-CHEAPEST series: min price per calendar day, ordered by day.
  const byDay = new Map<string, { min: number; ms: number }>();
  for (const p of valid) {
    const k = dayKey(p.at);
    const price = Number(p.price);
    const ms = (p.at instanceof Date ? p.at : new Date(p.at)).getTime();
    const cur = byDay.get(k);
    if (!cur) byDay.set(k, { min: price, ms });
    else { if (price < cur.min) cur.min = price; if (ms > cur.ms) cur.ms = ms; }
  }
  const series = [...byDay.values()].sort((a, b) => a.ms - b.ms);
  const dailyMins = series.map((s) => s.min);
  const distinctDays = series.length;

  const base: PriceVerdict = {
    verdict: "building_history", confident: false,
    currentBest: null, observedLow: null, observedHigh: null, typical: null, pctVsTypical: null,
    isObservedLow: false, trend: "stable", daysTracked: 0, distinctDays, points: valid.length, dropCount: 0, lastDrop: null,
    text: { ar: "", en: "" },
  };

  if (distinctDays === 0) {
    base.text = { ar: "لا يوجد سجل سعر بعد", en: "No price history yet" };
    return base;
  }

  const firstMs = series[0].ms;
  const daysTracked = Math.max(1, Math.round((nowMs - firstMs) / 86_400_000));
  const currentBest = series[series.length - 1].min;
  const observedLow = Math.min(...dailyMins);
  const observedHigh = Math.max(...dailyMins);
  const typical = median(dailyMins);

  // day-over-day drops in the daily-cheapest series
  let dropCount = 0; let lastDrop: PriceDrop | null = null;
  for (let i = 1; i < series.length; i++) {
    if (series[i].min < series[i - 1].min) {
      dropCount++;
      lastDrop = { from: series[i - 1].min, to: series[i].min, at: new Date(series[i].ms).toISOString(), pct: Math.round(((series[i].min - series[i - 1].min) / series[i - 1].min) * 100) };
    }
  }

  // trend: second-half vs first-half median of the daily-cheapest series
  let trend: PriceVerdict["trend"] = "stable";
  if (dailyMins.length >= 2) {
    const mid = Math.floor(dailyMins.length / 2);
    const firstMed = median(dailyMins.slice(0, mid || 1));
    const secondMed = median(dailyMins.slice(mid));
    const change = firstMed > 0 ? (secondMed - firstMed) / firstMed : 0;
    trend = change > 0.02 ? "rising" : change < -0.02 ? "falling" : "stable";
  }

  base.currentBest = currentBest; base.observedLow = observedLow; base.observedHigh = observedHigh;
  base.typical = typical; base.daysTracked = daysTracked; base.dropCount = dropCount; base.lastDrop = lastDrop;
  base.trend = trend;

  // ── Precision gate: not enough evidence → honest "building history" ──
  if (distinctDays < MIN_DISTINCT_DAYS || valid.length < MIN_POINTS) {
    base.text = {
      ar: `نبني سجل السعر (${distinctDays} ${distinctDays === 1 ? "يوم" : "أيام"} حتى الآن)`,
      en: `Building price history (${distinctDays} day${distinctDays === 1 ? "" : "s"} so far)`,
    };
    return base;
  }

  const pctVsTypical = typical > 0 ? (currentBest - typical) / typical : 0;
  const isNearLow = currentBest <= observedLow * (1 + NEAR_LOW_TOL);
  const pctAbs = Math.round(Math.abs(pctVsTypical) * 100);

  let verdict: PriceVerdictKind;
  let text: { ar: string; en: string };
  if (isNearLow && distinctDays >= MIN_DAYS_FOR_GREAT) {
    verdict = "great_price";
    text = { ar: `أفضل سعر منذ بدء التتبع (${daysTracked} يوم) — وقت مناسب للشراء`, en: `Best price since tracking began (${daysTracked}d) — a good time to buy` };
  } else if (pctVsTypical <= -TYPICAL_BAND) {
    verdict = "good_price";
    text = { ar: `أقل من المعتاد بـ${pctAbs}٪ — سعر جيد`, en: `${pctAbs}% below typical — a good price` };
  } else if (pctVsTypical >= TYPICAL_BAND) {
    verdict = "elevated";
    text = { ar: `أعلى من المعتاد بـ${pctAbs}٪ — قد ينخفض لاحقًا`, en: `${pctAbs}% above typical — may drop later` };
  } else {
    verdict = "typical";
    text = { ar: "قريب من السعر المعتاد", en: "Around the typical price" };
  }

  base.verdict = verdict; base.confident = true;
  base.pctVsTypical = Math.round(pctVsTypical * 100);
  base.isObservedLow = isNearLow;
  base.text = text;
  return base;
}
