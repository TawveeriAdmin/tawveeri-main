import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { isMoreAuthoritative, productListingKey } from "@/lib/intelligence/listing-currency";
import { resolveApprovedSlug, retailerDisplayName } from "@/lib/retailers/approved-retailers";

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
      .select("store_name, name, brand, current_price, observed_min, observed_max, claimed_was, distinct_days, last_seen, verdict, advertised_saving_pct, real_saving_pct, text_ar, text_en")
      .eq("url", url).limit(1).maybeSingle();
    if (!data) return NextResponse.json({ url, integrity: null, note: "listing not tracked yet" });

    // ADR-134: if a fresher listing for the same product in the same store contradicts
    // this row, this row is superseded and must not publish a drop.
    const { data: siblings } = await sb.from("tps_listing_price_facts")
      .select("store_name, name, verdict, last_seen").eq("store_name", data.store_name).eq("name", data.name);
    let winner: { verdict: string; last_seen: string | null } = { verdict: String(data.verdict), last_seen: (data as { last_seen?: string }).last_seen ?? null };
    for (const s of siblings ?? []) {
      const cand = { verdict: String(s.verdict), last_seen: (s.last_seen as string) ?? null };
      if (isMoreAuthoritative(cand, winner)) winner = cand;
    }
    if (winner.verdict !== data.verdict) {
      return NextResponse.json({
        url,
        integrity: { ...data, verdict: winner.verdict, real_saving_pct: null, text_ar: "", text_en: "" },
        note: "superseded listing — verdict taken from the current listing for this product (ADR-134)",
      });
    }
    return NextResponse.json({ url, integrity: data });
  }

  // Market summary — how honest are advertised discounts? (checkable = has verdict)
  const kinds = ["verified_drop", "inflated_reference", "stable", "insufficient_history"] as const;
  const counts: Record<string, number> = {};
  for (const k of kinds) {
    const { count } = await sb.from("tps_listing_price_facts").select("*", { count: "exact", head: true }).eq("verdict", k);
    counts[k] = count ?? 0;
  }

  // ADR-134 — a product can carry two listing rows in the same store with contradictory
  // verdicts (Almanea serves one item under two URL shapes). A superseded duplicate may
  // NOT be counted or published as a verified drop, so the headline figure and the deals
  // list below are both gated to the listing we observed most recently.
  const dropRows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("tps_listing_price_facts")
      .select("store_name, name, brand, category, url, current_price, observed_max, real_saving_pct, distinct_days, last_seen, verdict, text_ar, text_en")
      .eq("verdict", "verified_drop").order("url", { ascending: true }).range(from, from + 999);
    if (!data?.length) break;
    dropRows.push(...(data as Array<Record<string, unknown>>));
    if (data.length < 1000) break;
  }

  // Which listing speaks for each (store, product). Built by ONE full pass over the
  // facts table, 4 narrow columns. Deliberately NOT an `.in("name", …)` sibling query:
  // product names are full of commas and quotes ("مكيف سبليت ال جي، 18,000 وحدة"), which
  // corrupt a PostgREST `in.(…)` filter — that returned no siblings at all, so every
  // drop looked superseded and the live count collapsed to 0.
  const authoritative = new Map<string, { verdict: string; last_seen: string | null }>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("tps_listing_price_facts")
      .select("store_name, name, verdict, last_seen").order("url", { ascending: true }).range(from, from + 999);
    if (!data?.length) break;
    for (const row of data) {
      const key = productListingKey(row as never);
      const cur = authoritative.get(key);
      const cand = { verdict: String(row.verdict), last_seen: (row.last_seen as string) ?? null };
      if (!cur || isMoreAuthoritative(cand, cur)) authoritative.set(key, cand);
    }
    if (data.length < 1000) break;
  }

  const supersededDrops = dropRows.filter((d) => authoritative.get(productListingKey(d as never))?.verdict !== "verified_drop");
  const currentDrops = dropRows.filter((d) => authoritative.get(productListingKey(d as never))?.verdict === "verified_drop");
  counts.verified_drop = currentDrops.length;
  counts.superseded_duplicate_drops_suppressed = supersededDrops.length;

  const checkable = counts.verified_drop + counts.inflated_reference + counts.stable;
  const inflatedShare = checkable ? Math.round((counts.inflated_reference / checkable) * 100) : null;

  // Top VERIFIED real deals (genuine drops from a price we actually observed).
  const realDealsRaw = currentDrops
    .slice()
    .sort((a, b) => (Number(b.real_saving_pct) || 0) - (Number(a.real_saving_pct) || 0))
    .slice(0, 120);
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
      // `store_name` on a listing-facts row is whatever namespace the ingest wrote — in
      // production it is frequently a NUMERIC stores.id ("4", "5", "1"), and this is a
      // PUBLIC v1 feed. Rendering a raw internal id to a customer or an integrator is the
      // defect ADR-135 added `retailerDisplayName()` to end. Resolve it; if it does not
      // resolve to an approved retailer, say nothing rather than echo an id.
      store_name: retailerDisplayName(resolveApprovedSlug(d.store_name) ?? '', 'ar')
        ?? (resolveApprovedSlug(d.store_name) ? d.store_name : null),
      observed_max: d.observed_max != null ? Math.round(Number(d.observed_max) * 100) / 100 : d.observed_max,
      current_price: d.current_price != null ? Math.round(Number(d.current_price) * 100) / 100 : d.current_price,
    })),
  });
}
