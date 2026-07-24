import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { productTrust } from '@/lib/intelligence/evidence-engine';
import { ucpAdapter, type TawveeriProduct } from "@/lib/protocol/adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORE_SLUG: Record<string, string> = { "اكسترا": "extra", "المنيع": "almanea", "جرير": "jarir", "أمازون": "amazon", "نون": "noon" };

/**
 * GET /api/v1/protocol/ucp/feed?category=&limit=&offset=
 * E15.5 / W4 — Protocol-neutral export of the canonical graph in a UCP-compatible
 * SHAPE (v0). Read-only product feed: each product carries offers whose
 * merchant_of_record is the retailer (Merchant Independence) and whose exit_url is
 * the measured /go redirect. No checkout/payment (Stage-2, SAMA-gated). Ranking-blind.
 * v0 shape pending UCP wire-spec validation (see POST-E15-GLOBAL-RESEARCH-AUDIT.md).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const category = q.get("category");
  const limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 50));
  const offset = Math.max(0, Number(q.get("offset")) || 0);
  const supabase = createServerClient();

  let proj = supabase.from("tps_product_projection")
    .select("canonical_id, tps_identity_key, display_name_ar, display_name_en, brand, category, image_url, store_count, has_comparison, identity_confidence, last_observed_at")
    .order("store_count", { ascending: false }).range(offset, offset + limit - 1);
  if (category) proj = proj.eq("category", category);
  const { data: rows } = await proj;
  const canon = rows ?? [];

  // Product DNA (attributes) from canonical_products.
  const ids = canon.map((c) => c.canonical_id);
  const attrById = new Map<string, Record<string, unknown>>();
  const offersByCanon = new Map<string, TawveeriProduct["offers"]>();
  if (ids.length) {
    const { data: cps } = await supabase.from("canonical_products").select("id, attributes").in("id", ids);
    for (const cp of cps ?? []) attrById.set(cp.id, (cp.attributes as Record<string, unknown>) ?? {});

    const { data: obs } = await supabase.from("normalized_product_observations")
      .select("id, store_id, canonical_product_id, observed_at").in("canonical_product_id", ids).order("observed_at", { ascending: false });
    const { data: prices } = await supabase.from("price_history")
      .select("canonical_product_id, store_name, price, observed_at").in("canonical_product_id", ids).order("observed_at", { ascending: false });
    const latestPrice = new Map<string, number>();
    for (const p of prices ?? []) { const k = `${p.canonical_product_id}|${p.store_name}`; if (!latestPrice.has(k)) latestPrice.set(k, Number(p.price)); }
    const seen = new Set<string>();
    for (const o of obs ?? []) {
      const k = `${o.canonical_product_id}|${o.store_id}`;
      if (seen.has(k)) continue; seen.add(k);
      const list = offersByCanon.get(o.canonical_product_id) ?? [];
      list.push({ store: STORE_SLUG[o.store_id] ?? o.store_id, price: latestPrice.get(k) ?? null, currency: "SAR", availability: "in_stock", measured_exit: `/go/${o.id}` });
      offersByCanon.set(o.canonical_product_id, list);
    }
  }

  const products = canon.map((c) => {
    const trust = productTrust({ store_count: c.store_count, identity_confidence: c.identity_confidence, has_comparison: c.has_comparison, tps_identity_key: c.tps_identity_key, last_observed_at: c.last_observed_at });
    const tp: TawveeriProduct = {
      canonical_id: c.canonical_id, identity_key: c.tps_identity_key,
      title_ar: c.display_name_ar, title_en: c.display_name_en, brand: c.brand, category: c.category, image_url: c.image_url,
      attributes: attrById.get(c.canonical_id) ?? {}, comparison_available: !!c.has_comparison, confidence: trust.score,
      offers: (offersByCanon.get(c.canonical_id) ?? []).sort((a, b) => (a.price ?? 9e9) - (b.price ?? 9e9)),
    };
    return ucpAdapter.toProduct(tp);
  });

  return NextResponse.json({
    protocol: "ucp", protocol_version: ucpAdapter.version, source: "tawveeri",
    note: "v0 UCP-compatible shape; merchant-of-record = retailer; exits measured via /go; no checkout (Stage-2 SAMA-gated).",
    count: products.length, offset, limit, products,
  });
}
