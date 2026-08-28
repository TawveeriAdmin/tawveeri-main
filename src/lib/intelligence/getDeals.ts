// src/lib/intelligence/getDeals.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tawveeri Deal Engine — Knowledge Layer.
// A real deal = a store-flagged deal (is_deal) whose current price is genuinely below its own
// recorded original price. original_price is a REAL prior price, never fabricated — so the discount
// is honest. Sources from product_stores/products (the populated storefront tables) across ALL
// categories. Read-only. Equal consumers: /deals, search, product page, وفّر, API.
//
// (Superseded the earlier canonical_products + 30-day-price_history method, which returned nothing
//  in production because System A price_history is sparse and often lacks canonical_product_id.)
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isApprovedStoreId } from "@/lib/retailers/approved-retailers";
import {
  isExtremeUncorroboratedDiscount,
  classifyDealLabelTier,
  tierAllowsStrongDealBadge,
  dealLabelText,
  type DealLabelTier,
} from "@/lib/intelligence/price-truth-gate";
import { isFreshObservation } from "@/lib/intelligence/evidence-engine";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const HOT_DISCOUNT_PCT = 15; // a "hot" deal cutoff

export type DealStrength = "hot" | "good";

export interface Deal {
  productId: string;
  slug: string;
  compareUrl: string;
  nameAr: string;
  nameEn: string | null;
  brand: string | null;
  imageUrl: string | null;
  bestPrice: number;
  bestStore: string;
  averagePrice: number; // the recorded original ("was") price
  discountPct: number;
  isLowestEver: boolean;
  trackingDays: number;
  storesCount: number;
  strength: DealStrength;
  reason: string;
  /** ADR-211 bounded closeout — the smallest truthful superiority claim this offer
   *  has earned: single retailer / single retailer with a stable price-history
   *  baseline / two-or-more corroborating retailers. Drives labelAr/labelEn. */
  labelTier: DealLabelTier;
  labelAr: string;
  labelEn: string;
}

type Row = {
  id: string;
  current_price: number | null;
  original_price: number | null;
  store_id: number | null;
  last_checked_at: string | null;
  last_seen_at: string | null;
  products: { id: string; name_ar: string; name_en: string | null; brand: string | null; slug: string | null; image_url: string | null } | null;
  stores: { name_ar: string | null; name_en: string | null; slug: string | null } | null;
};

/** A candidate "best offer" row, reduced to just what the best-offer selection needs. */
export interface OfferCandidate {
  id: string; price: number; was: number; storeAr: string; storeEn: string; observedAt: string | null;
}

/**
 * QUALITY PROGRAM P1 §19.2 item 3 (2026-08-28): the "best offer" (and therefore the
 * discount % / "hot deal" claim) crowned per product used to be the raw cheapest
 * flagged-deal row with zero freshness check — the storefront-layer twin of the gap
 * §17.1/§19.1/§20 already fixed elsewhere, here for the platform's highest-stakes claim
 * (a "deal" implies urgency; a stale "98% off" is worse than a stale "best price").
 * Same `isFreshObservation()` gate, same backward-compatible design (no `observed_at`
 * data at all → behaves exactly as before), same tiered fallback (fresh cheapest > any
 * cheapest — never drops a product from the deals feed for being stale, only prefers
 * fresher evidence when it exists). Kept as its own function (not a shared import) for
 * the same reason as compare/page.tsx's version: this file's row shape is its own.
 */
export function selectBestDealOffer(candidates: OfferCandidate[]): OfferCandidate {
  const anyObservedAt = candidates.some((c) => c.observedAt != null);
  const fresh = anyObservedAt ? candidates.filter((c) => isFreshObservation(c.observedAt)) : candidates;
  const pool = fresh.length ? fresh : candidates;
  return pool.reduce((best, c) => (c.price < best.price ? c : best), pool[0]);
}

export async function getDeals(limit = 20, minDiscountPct = 1): Promise<Deal[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("product_stores")
    .select(`id, current_price, original_price, store_id, last_checked_at, last_seen_at,
      products!inner(id, name_ar, name_en, brand, slug, image_url),
      stores(name_ar, name_en, slug)`)
    .eq("is_deal", true)
    .not("original_price", "is", null)
    // Service-role queries bypass RLS (which already hides quarantined rows from
    // anon/browser reads) — filter explicitly here too. See price-truth-gate.ts.
    .is("price_quarantined_at", null)
    .order("updated_at", { ascending: false })
    .limit(1200);
  if (error || !data?.length) return [];

  // Group offers by product; resolve the crowned "best" offer per product via
  // selectBestDealOffer (fresh-preferred, never-drops-coverage fallback) below, not a
  // raw running-cheapest track — freshness needs to see ALL of a product's candidate
  // rows at once to know whether any of them are fresh at all.
  interface Agg {
    product: NonNullable<Row["products"]>;
    offers: OfferCandidate[];
    stores: Set<number>;
  }
  const byProduct = new Map<string, Agg>();
  for (const r of data as unknown as Row[]) {
    const p = r.products;
    // Approved-27 scope gate: deals only from approved retailers (Founder Directive 2026-07-27).
    if (!isApprovedStoreId(r.store_id)) continue;
    const cur = Number(r.current_price), was = Number(r.original_price);
    if (!p || !p.slug || !Number.isFinite(cur) || cur <= 0 || !Number.isFinite(was) || was <= cur) continue;
    const storeAr = r.stores?.name_ar || r.stores?.slug || "";
    const storeEn = r.stores?.name_en || r.stores?.slug || storeAr;
    let agg = byProduct.get(p.id);
    if (!agg) { agg = { product: p, offers: [], stores: new Set() }; byProduct.set(p.id, agg); }
    agg.offers.push({ id: r.id, price: cur, was, storeAr, storeEn, observedAt: r.last_checked_at ?? r.last_seen_at ?? null });
    if (r.store_id != null) agg.stores.add(r.store_id);
  }

  interface Candidate { agg: Agg; best: OfferCandidate; discountPct: number; }
  const candidates: Candidate[] = [];
  for (const agg of byProduct.values()) {
    const best = selectBestDealOffer(agg.offers);
    const discountPct = Math.round(((best.was - best.price) / best.was) * 100);
    if (discountPct < minDiscountPct) continue;
    // Best Deals contract (P0 incident 2026-08-05): an extreme discount claim from a
    // single retailer, with nothing else corroborating it, is not honest to publish —
    // it is exactly the shape of the false 98%-off TV claim. Quarantine for
    // revalidation by omission; never auto-promote. See price-truth-gate.ts.
    if (isExtremeUncorroboratedDiscount({ discountPct, corroboratingStoreCount: agg.stores.size })) continue;
    candidates.push({ agg, best, discountPct });
  }

  // Provisional sort by naive strength (discount-based) so the price_history lookup
  // below is only spent on offers that will actually make the final `limit` slice.
  candidates.sort((a, b) =>
    (a.discountPct >= HOT_DISCOUNT_PCT) !== (b.discountPct >= HOT_DISCOUNT_PCT)
      ? (a.discountPct >= HOT_DISCOUNT_PCT ? -1 : 1)
      : b.discountPct - a.discountPct
  );
  const finalists = candidates.slice(0, limit);

  // ADR-211 bounded closeout — the label tier for a single-retailer offer depends on
  // whether we hold a reproducible, stable price-history baseline for THAT exact
  // listing. Batched to just the finalist ids (not all 1200 candidates).
  const finalistIds = finalists.map((c) => c.best.id);
  const baselineById = new Map<string, { obs: number; days: number }>();
  if (finalistIds.length) {
    const { data: phRows } = await supabase
      .from("price_history")
      .select("product_store_id, observed_at")
      .in("product_store_id", finalistIds);
    for (const row of (phRows ?? []) as { product_store_id: string; observed_at: string }[]) {
      const cur = baselineById.get(row.product_store_id) ?? { obs: 0, days: 0 };
      cur.obs += 1;
      baselineById.set(row.product_store_id, cur);
    }
    // Distinct-day count, second pass (cheap; finalist set is small).
    const dayGroups = new Map<string, Set<string>>();
    for (const row of (phRows ?? []) as { product_store_id: string; observed_at: string }[]) {
      const day = row.observed_at.slice(0, 10);
      let set = dayGroups.get(row.product_store_id);
      if (!set) { set = new Set(); dayGroups.set(row.product_store_id, set); }
      set.add(day);
    }
    for (const [id, set] of dayGroups) {
      const cur = baselineById.get(id);
      if (cur) cur.days = set.size;
    }
  }

  const deals: Deal[] = finalists.map(({ agg, best, discountPct }) => {
    const baseline = baselineById.get(best.id) ?? { obs: 0, days: 0 };
    const tier = classifyDealLabelTier({
      corroboratingStoreCount: agg.stores.size,
      priceHistoryObservationCount: baseline.obs,
      priceHistoryDistinctDays: baseline.days,
    });
    const strength: DealStrength =
      tierAllowsStrongDealBadge(tier) && discountPct >= HOT_DISCOUNT_PCT ? "hot" : "good";
    const label = dealLabelText(tier, best.storeAr);
    const labelEn = dealLabelText(tier, best.storeEn);

    return {
      productId: agg.product.id,
      slug: agg.product.slug!,
      compareUrl: `/products/${agg.product.slug}`,
      nameAr: agg.product.name_ar,
      nameEn: agg.product.name_en,
      brand: agg.product.brand,
      imageUrl: agg.product.image_url,
      bestPrice: Math.round(best.price),
      bestStore: best.storeAr,
      averagePrice: Math.round(best.was),
      discountPct,
      isLowestEver: false,
      trackingDays: 0,
      storesCount: Math.max(1, agg.stores.size),
      strength,
      labelTier: tier,
      labelAr: label.ar,
      labelEn: labelEn.en,
      reason: `أرخص من سعره المعتاد (${Math.round(best.was).toLocaleString("ar-SA")} ريال) بنسبة ${discountPct}٪`,
    };
  });

  deals.sort((a, b) => (a.strength !== b.strength ? (a.strength === "hot" ? -1 : 1) : b.discountPct - a.discountPct));
  return deals;
}
