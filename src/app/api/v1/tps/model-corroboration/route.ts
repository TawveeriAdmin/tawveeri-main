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

  const rows = data ?? [];
  const byCategory: Record<string, number> = {};
  const byStoreCount: Record<number, number> = {};
  for (const r of rows) { byCategory[r.category] = (byCategory[r.category] ?? 0) + 1; byStoreCount[r.store_count] = (byStoreCount[r.store_count] ?? 0) + 1; }

  return NextResponse.json({
    version: "v1", generated_at: new Date().toISOString(),
    total: rows.length,
    summary: { by_category: byCategory, by_store_count: byStoreCount },
    method: "Same manufacturer model number observed in ≥2 independent stores ⇒ definitively the same product. Precision gates: model normalized to ≥6 chars mixing letters+digits, exactly one known brand, price spread ≤3×.",
    neutrality: "ranking-blind; identity is evidence-based, never commercial",
    corroborations: rows.slice(0, 100),
  });
}
