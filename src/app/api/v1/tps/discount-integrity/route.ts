import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/tps/discount-integrity — Discount Integrity (trust through evidence).
 *   ?url=<listing url>  → the integrity verdict for one listing
 *   (no params)         → market summary + top VERIFIED real deals
 *
 * Verifies each store's advertised "was" price against what Tawveeri ACTUALLY
 * observed for that listing over time. Non-accusatory & precision-first: an
 * `inflated_reference` means only "we never observed it at that price", and thin
 * history stays silent (`insufficient_history`). Deterministic; commission-blind.
 */
export async function GET(req: NextRequest) {
  const sb = createServerClient();
  const url = new URL(req.url).searchParams.get("url");

  if (url) {
    const { data } = await sb.from("tps_listing_price_facts")
      .select("store_name, name, brand, current_price, observed_min, observed_max, claimed_was, distinct_days, verdict, advertised_saving_pct, real_saving_pct, text_ar, text_en")
      .eq("url", url).limit(1).maybeSingle();
    if (!data) return NextResponse.json({ url, integrity: null, note: "listing not tracked yet" });
    return NextResponse.json({ url, integrity: data });
  }

  // Market summary — how honest are advertised discounts? (checkable = has verdict)
  const kinds = ["verified_drop", "inflated_reference", "stable", "insufficient_history"] as const;
  const counts: Record<string, number> = {};
  for (const k of kinds) {
    const { count } = await sb.from("tps_listing_price_facts").select("*", { count: "exact", head: true }).eq("verdict", k);
    counts[k] = count ?? 0;
  }
  const checkable = counts.verified_drop + counts.inflated_reference + counts.stable;
  const inflatedShare = checkable ? Math.round((counts.inflated_reference / checkable) * 100) : null;

  // Top VERIFIED real deals (genuine drops from a price we actually observed).
  const { data: realDeals } = await sb.from("tps_listing_price_facts")
    .select("store_name, name, brand, url, current_price, observed_max, real_saving_pct, distinct_days, text_ar, text_en")
    .eq("verdict", "verified_drop").order("real_saving_pct", { ascending: false }).limit(20);

  return NextResponse.json({
    version: "v1", generated_at: new Date().toISOString(),
    summary: { checkable_listings: checkable, by_verdict: counts, inflated_reference_share_pct: inflatedShare },
    methodology: "A store's advertised 'was' price is compared to the highest price Tawveeri actually observed for that listing over the tracked period. inflated_reference = we never observed it that high (the ad's reference is not a price we saw); it is not an accusation of fraud. Thin history stays silent.",
    neutrality: "ranking-blind; commission never influences this",
    real_deals: realDeals ?? [],
  });
}
