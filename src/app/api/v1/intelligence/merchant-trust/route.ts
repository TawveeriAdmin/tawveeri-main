import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { rankStoresByTrust, type StoreTrust } from "@/lib/intelligence/merchant-trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/intelligence/merchant-trust — deterministic, evidence-based trust
 * profile per store (discount honesty + real price competitiveness + coverage),
 * ranked by real value then honesty. Non-accusatory & precision-first: "inflated"
 * means only "the advertised 'was' is a price we never observed"; "insufficient_data"
 * is stated honestly rather than implying a store makes no discounts. Ranking-blind.
 */
export async function GET() {
  const sb = createServerClient();
  const { data, error } = await sb.from("tps_merchant_trust")
    .select("store_id, store_name, discount_behavior, evaluable_claims, discount_inflation_pct, verified_deals, price_competitiveness_pct, distinct_products, headline_ar, headline_en, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profiles: StoreTrust[] = (data ?? []).map((r) => ({
    store_id: r.store_id, store_name: r.store_name, discount_behavior: r.discount_behavior,
    evaluable_claims: r.evaluable_claims, discount_inflation_pct: r.discount_inflation_pct,
    verified_deals: r.verified_deals, price_competitiveness_pct: r.price_competitiveness_pct,
    distinct_products: r.distinct_products, headline: { ar: r.headline_ar ?? "", en: r.headline_en ?? "" },
  }));

  return NextResponse.json({
    version: "v1", generated_at: new Date().toISOString(),
    method: "Discount honesty = share of a store's evaluable advertised discounts whose 'was' price we never observed. Price competitiveness = share of corroborated products where the store is cheapest. Ranked by real value then honesty. Ranking-blind; commission never enters this.",
    neutrality: "ranking-blind",
    stores: rankStoresByTrust(profiles),
  });
}
