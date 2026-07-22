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
    .select("store_id, store_name, discount_behavior, evaluable_claims, unobserved_reference_pct, verified_deals, price_competitiveness_pct, distinct_products, sample_size, observation_window_days, data_age_days, confidence, headline_ar, headline_en, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profiles: StoreTrust[] = (data ?? []).map((r) => ({
    store_id: r.store_id, store_name: r.store_name, discount_behavior: r.discount_behavior,
    evaluable_claims: r.evaluable_claims, unobserved_reference_pct: r.unobserved_reference_pct,
    verified_deals: r.verified_deals, price_competitiveness_pct: r.price_competitiveness_pct,
    distinct_products: r.distinct_products,
    evidence: { sample_size: r.sample_size, observation_window_days: r.observation_window_days, data_age_days: r.data_age_days, confidence: r.confidence },
    headline: { ar: r.headline_ar ?? "", en: r.headline_en ?? "" },
  }));

  return NextResponse.json({
    version: "v1", generated_at: new Date().toISOString(),
    method: "unobserved_reference_pct = share of a store's EVALUABLE advertised discounts whose advertised 'was' price we did NOT observe in our tracking window. This is NOT a claim that the price was fabricated — only that we did not see it in our available history (see evidence.sample_size / observation_window_days / confidence). Price competitiveness = share of corroborated products where the store is cheapest. Ranked by real value then fewer unobserved references. Ranking-blind; commission never enters this.",
    neutrality: "ranking-blind",
    stores: rankStoresByTrust(profiles),
  });
}
