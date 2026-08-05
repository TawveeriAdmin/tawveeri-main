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
import { isExtremeUncorroboratedDiscount } from "@/lib/intelligence/price-truth-gate";

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
}

type Row = {
  current_price: number | null;
  original_price: number | null;
  store_id: number | null;
  products: { id: string; name_ar: string; name_en: string | null; brand: string | null; slug: string | null; image_url: string | null } | null;
  stores: { name_ar: string | null; name_en: string | null; slug: string | null } | null;
};

export async function getDeals(limit = 20, minDiscountPct = 1): Promise<Deal[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("product_stores")
    .select(`current_price, original_price, store_id,
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

  // Group offers by product; keep the cheapest offer whose recorded original price beats it.
  interface Agg { product: NonNullable<Row["products"]>; best: number; was: number; store: string; stores: Set<number>; }
  const byProduct = new Map<string, Agg>();
  for (const r of data as unknown as Row[]) {
    const p = r.products;
    // Approved-27 scope gate: deals only from approved retailers (Founder Directive 2026-07-27).
    if (!isApprovedStoreId(r.store_id)) continue;
    const cur = Number(r.current_price), was = Number(r.original_price);
    if (!p || !p.slug || !Number.isFinite(cur) || cur <= 0 || !Number.isFinite(was) || was <= cur) continue;
    const store = r.stores?.name_ar || r.stores?.slug || "";
    let agg = byProduct.get(p.id);
    if (!agg) { agg = { product: p, best: cur, was, store, stores: new Set() }; byProduct.set(p.id, agg); }
    if (cur < agg.best) { agg.best = cur; agg.was = was; agg.store = store; }
    if (r.store_id != null) agg.stores.add(r.store_id);
  }

  const deals: Deal[] = [];
  for (const agg of byProduct.values()) {
    const discountPct = Math.round(((agg.was - agg.best) / agg.was) * 100);
    if (discountPct < minDiscountPct) continue;
    // Best Deals contract (P0 incident 2026-08-05): an extreme discount claim from a
    // single retailer, with nothing else corroborating it, is not honest to publish —
    // it is exactly the shape of the false 98%-off TV claim. Quarantine for
    // revalidation by omission; never auto-promote. See price-truth-gate.ts.
    if (isExtremeUncorroboratedDiscount({ discountPct, corroboratingStoreCount: agg.stores.size })) continue;
    const strength: DealStrength = discountPct >= HOT_DISCOUNT_PCT ? "hot" : "good";
    deals.push({
      productId: agg.product.id,
      slug: agg.product.slug!,
      compareUrl: `/products/${agg.product.slug}`,
      nameAr: agg.product.name_ar,
      nameEn: agg.product.name_en,
      brand: agg.product.brand,
      imageUrl: agg.product.image_url,
      bestPrice: Math.round(agg.best),
      bestStore: agg.store,
      averagePrice: Math.round(agg.was),
      discountPct,
      isLowestEver: false,
      trackingDays: 0,
      storesCount: Math.max(1, agg.stores.size),
      strength,
      reason: `أرخص من سعره المعتاد (${Math.round(agg.was).toLocaleString("ar-SA")} ريال) بنسبة ${discountPct}٪${agg.store ? ` · أفضل سعر لدى ${agg.store}` : ""}`,
    });
  }

  deals.sort((a, b) => (a.strength !== b.strength ? (a.strength === "hot" ? -1 : 1) : b.discountPct - a.discountPct));
  return deals.slice(0, limit);
}
