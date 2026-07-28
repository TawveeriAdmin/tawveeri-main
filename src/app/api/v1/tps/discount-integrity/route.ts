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
  const { data: realDealsRaw } = await sb.from("tps_listing_price_facts")
    .select("store_name, name, brand, category, url, current_price, observed_max, real_saving_pct, distinct_days, text_ar, text_en")
    .eq("verdict", "verified_drop").order("real_saving_pct", { ascending: false }).limit(120);
  // P0-4 ranking (founder-approved): surface high-VALUE confirmed products first, not accessory %-theatre.
  // (1) non-accessory first, (2) absolute SAR saving desc, (3) real_saving_pct desc. Already verdict-gated to
  // verified_drop. NOTE: the "model-confirmed multi-store first" tier needs a canonical/store-count join not
  // present on the listing-facts row — a follow-up refinement; this fixes the visible accessory-lead defect now.
  const isAcc = (cat: unknown) => String(cat ?? "").toLowerCase() === "accessories";
  const absSave = (d: { observed_max?: unknown; current_price?: unknown }) => (Number(d.observed_max) || 0) - (Number(d.current_price) || 0);
  const realDeals = (realDealsRaw ?? []).slice().sort((a, b) =>
    (isAcc(a.category) ? 1 : 0) - (isAcc(b.category) ? 1 : 0)
    || absSave(b) - absSave(a)
    || (Number(b.real_saving_pct) || 0) - (Number(a.real_saving_pct) || 0)
  ).slice(0, 20);

  return NextResponse.json({
    version: "v1", generated_at: new Date().toISOString(),
    summary: { checkable_listings: checkable, by_verdict: counts, inflated_reference_share_pct: inflatedShare },
    methodology: "A store's advertised 'was' price is compared to the highest price Tawveeri actually observed for that listing over the tracked period. inflated_reference = we never observed it that high (the ad's reference is not a price we saw); it is not an accusation of fraud. Thin history stays silent.",
    neutrality: "ranking-blind; commission never influences this",
    // Round away float-noise (e.g. 69.000001, 369.000501) before it reaches any customer surface (ADR item-4).
    real_deals: (realDeals ?? []).map((d) => ({
      ...d,
      observed_max: d.observed_max != null ? Math.round(Number(d.observed_max) * 100) / 100 : d.observed_max,
      current_price: d.current_price != null ? Math.round(Number(d.current_price) * 100) / 100 : d.current_price,
    })),
  });
}
