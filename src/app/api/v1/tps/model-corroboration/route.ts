import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/tps/model-corroboration — cross-store MODEL-NUMBER corroborations.
 * Products proven identical because the SAME manufacturer model number appears in
 * ≥2 independent stores (a high-precision identity signal that also catches matches
 * whose titles diverge). Deterministic, provenance-complete. This is an intelligence
 * asset; folding it into canonical identity (dedup-by-construction) is a follow-up.
 */
export async function GET() {
  const sb = createServerClient();
  const { data, error } = await sb.from("tps_model_corroboration")
    .select("identity_key, model, brand, category, store_ids, store_count, observations, min_price, max_price, sample_name")
    .order("store_count", { ascending: false }).order("observations", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // `total` used to be `rows.length` against a `.limit(300)` — i.e. "rows we happened to
  // return", not a total. It is rendered as a headline figure on /price-truth, so once the
  // view passed 300 the page would have frozen at 300 and under-reported for ever without
  // anyone noticing. Counted exactly, independently of the page size (2026-07-31).
  const { count: exactTotal } = await sb.from("tps_model_corroboration")
    .select("identity_key", { count: "exact", head: true });

  // ACCESSORIES ARE EXCLUDED FROM THE TRUST HEADLINE. 88 of 166 corroborations were
  // accessories, so "products verified across multiple stores" was a majority-accessory
  // claim on the surface whose whole purpose is trust. They remain in the payload for
  // completeness — counted, published, and separated — but they do not inflate a headline
  // about products.
  const isAccessory = (c: unknown) => String(c ?? "").toLowerCase().includes("accessor");
  const { count: accessoryTotal } = await sb.from("tps_model_corroboration")
    .select("identity_key", { count: "exact", head: true }).eq("category", "accessories");

  const rows = data ?? [];
  const byCategory: Record<string, number> = {};
  const byStoreCount: Record<number, number> = {};
  for (const r of rows) { byCategory[r.category] = (byCategory[r.category] ?? 0) + 1; byStoreCount[r.store_count] = (byStoreCount[r.store_count] ?? 0) + 1; }

  const total = typeof exactTotal === "number" ? exactTotal : rows.length;
  const accessories = typeof accessoryTotal === "number" ? accessoryTotal : rows.filter((r) => isAccessory(r.category)).length;

  return NextResponse.json({
    version: "v1", generated_at: new Date().toISOString(),
    // `total` = every corroboration, accessories included (the honest full figure).
    // `products_total` = the headline: devices only, accessories excluded.
    total,
    products_total: Math.max(0, total - accessories),
    accessories_total: accessories,
    definition: "products_total = distinct identity_keys in tps_model_corroboration with category <> 'accessories'. total includes accessories. Both counted exactly, not limited by page size.",
    summary: { by_category: byCategory, by_store_count: byStoreCount },
    method: "Same manufacturer model number observed in ≥2 independent stores ⇒ definitively the same product. Precision gates: model normalized to ≥6 chars mixing letters+digits, exactly one known brand, price spread ≤3×.",
    neutrality: "ranking-blind; identity is evidence-based, never commercial",
    corroborations: rows.slice(0, 100),
  });
}
