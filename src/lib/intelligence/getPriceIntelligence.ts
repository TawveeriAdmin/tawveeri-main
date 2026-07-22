// src/lib/intelligence/getPriceIntelligence.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tawveeri Intelligence Engine — Layer 3 (data-access wrapper).
// Reads accumulated price_history and delegates the VERDICT to the deterministic,
// precision-first pure engine (`computePriceVerdict`). Backward compatible: the
// `PriceIntelligence` shape is unchanged, so existing consumers (the TPS product
// page + AI assistant) keep working — but they now get the honest verdict for
// free: thin data no longer fabricates a "record low 🔥" (precision over recall).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { computePriceVerdict, type PricePoint, type PriceVerdict } from "./price-intelligence";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const WINDOW_DAYS = 90; // read up to 90 days; the engine honestly labels the actual span

export type DealRating = "excellent" | "good" | "normal" | "high";

export interface PriceIntelligence {
  currentBestPrice: number;
  lowestEver: number;
  highestEver: number;
  average: number;              // typical (median of daily-cheapest) — robust to store/scrape bias
  trackingDays: number;
  pricePoints: number;
  isLowestEver: boolean;        // true ONLY when confident (never on thin data)
  diffFromAverage: number;      // % vs typical (− = cheaper)
  trend: "rising" | "falling" | "stable";
  dealRating: DealRating;
  dealText: string;             // Arabic (backward compatible)
  verdict: PriceVerdict["verdict"]; // richer verdict (additive)
}

function ratingFor(v: PriceVerdict["verdict"]): DealRating {
  switch (v) {
    case "great_price": return "excellent";
    case "good_price": return "good";
    case "elevated": return "high";
    default: return "normal"; // typical | building_history
  }
}

function toIntelligence(v: PriceVerdict): PriceIntelligence | null {
  if (v.currentBest == null || v.observedLow == null || v.observedHigh == null || v.typical == null) return null;
  return {
    currentBestPrice: v.currentBest,
    lowestEver: v.observedLow,
    highestEver: v.observedHigh,
    average: v.typical,
    trackingDays: v.daysTracked,
    pricePoints: v.points,
    isLowestEver: v.confident && v.isObservedLow,
    diffFromAverage: v.pctVsTypical ?? 0,
    trend: v.trend,
    dealRating: ratingFor(v.verdict),
    dealText: v.text.ar,
    verdict: v.verdict,
  };
}

/** Single-product price intelligence (backward-compatible shape). */
export async function getPriceIntelligence(canonicalProductId: string): Promise<PriceIntelligence | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const { data: rows, error } = await supabase
    .from("price_history")
    .select("price, store_name, observed_at")
    .eq("canonical_product_id", canonicalProductId)
    .gte("observed_at", since.toISOString())
    .order("observed_at", { ascending: false }) // newest first, bounded — recent history is what matters
    .limit(1000);

  if (error || !rows || rows.length === 0) return null;
  const points: PricePoint[] = rows.map((r) => ({ price: Number(r.price), store: r.store_name, at: r.observed_at }));
  return toIntelligence(computePriceVerdict(points, Date.now()));
}

/** The raw verdict (richer than PriceIntelligence) for one canonical. */
export async function getPriceVerdict(canonicalProductId: string): Promise<PriceVerdict | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const { data: rows, error } = await supabase
    .from("price_history")
    .select("price, store_name, observed_at")
    .eq("canonical_product_id", canonicalProductId)
    .gte("observed_at", since.toISOString())
    .order("observed_at", { ascending: false })
    .limit(1000);
  if (error || !rows) return null;
  const points: PricePoint[] = rows.map((r) => ({ price: Number(r.price), store: r.store_name, at: r.observed_at }));
  return computePriceVerdict(points, Date.now());
}

/**
 * BATCH verdicts for many canonicals in ONE query — used by the Advisor to fuse
 * "which to buy" with "when to buy" without N round-trips. Returns a map of
 * canonical_id → PriceVerdict (only ids with any history appear).
 */
export async function getPriceVerdicts(canonicalIds: string[]): Promise<Map<string, PriceVerdict>> {
  const out = new Map<string, PriceVerdict>();
  const ids = [...new Set(canonicalIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const byId = new Map<string, PricePoint[]>();
  // paginate defensively — many canonicals × 90 days can exceed the 1000-row cap
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("price_history")
      .select("canonical_product_id, price, store_name, observed_at")
      .in("canonical_product_id", ids)
      .gte("observed_at", since.toISOString())
      .order("observed_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`getPriceVerdicts read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const id = r.canonical_product_id as string;
      if (!id) continue;
      (byId.get(id) ?? byId.set(id, []).get(id)!).push({ price: Number(r.price), store: r.store_name, at: r.observed_at });
    }
    if (data.length < PAGE) break;
  }
  const now = Date.now();
  for (const [id, pts] of byId) out.set(id, computePriceVerdict(pts, now));
  return out;
}
