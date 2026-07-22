import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { decideAc, type ShoppingTask, type CanonicalRow } from "@/lib/agent/decision-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/agent/decide  — E15.5 Stage-1 Decision Agent (deterministic).
 * Body: a SHOPPING TASK, e.g.
 *   { "category":"air_conditioner", "room_size_m2":30, "city":"Riyadh",
 *     "priorities":["quiet","low_electricity"], "budget_total":4000 }
 * Returns a NEUTRAL, explainable, total-cost-aware ranked recommendation over the
 * TPS canonical graph + Product DNA. RANKING-BLIND (suitability + trust + total
 * cost only; never commission). Each item carries a measured-exit go_url.
 * Deterministic engine decides; no LLM in the ranking path (ADR-002).
 */
export async function POST(req: NextRequest) {
  const task = (await req.json().catch(() => ({}))) as ShoppingTask;
  if (!task.category) return NextResponse.json({ error: "category required" }, { status: 400 });
  const supabase = createServerClient();

  // Canonical rows for the category: attributes (for DNA) from canonical_products,
  // price/trust from the projection. Include both Layer 1 (comparable) and Layer 2.
  const { data: canon } = await supabase
    .from("canonical_products")
    .select("id, tps_identity_key, name_ar, name_en, brand, category, attributes")
    .eq("category", task.category).not("tps_identity_key", "is", null).limit(500);
  const { data: proj } = await supabase
    .from("tps_product_projection")
    .select("canonical_id, lowest_price, store_count, has_comparison, identity_confidence, image_url")
    .eq("category", task.category).limit(500);
  const projById = new Map((proj ?? []).map((p) => [p.canonical_id, p]));

  const rows: CanonicalRow[] = (canon ?? [])
    .filter((c) => projById.has(c.id)) // only products that made it to the projection (have offers)
    .map((c) => {
      const p = projById.get(c.id)!;
      return {
        canonical_id: c.id, tps_identity_key: c.tps_identity_key,
        display_name_ar: c.name_ar, display_name_en: c.name_en, brand: c.brand, category: c.category,
        image_url: p.image_url ?? null, lowest_price: p.lowest_price, store_count: p.store_count,
        has_comparison: p.has_comparison, identity_confidence: p.identity_confidence, attributes: c.attributes ?? {},
      };
    });

  if (!rows.length) {
    return NextResponse.json({ version: "v1", task, supported: task.category === "air_conditioner", count: 0, recommendations: [],
      note: rows.length === 0 ? "no canonical products with offers for this category yet" : undefined });
  }

  // v1 supports the air_conditioner journey deterministically. Other categories
  // fall back to a neutral trust+price ordering (no fabricated suitability).
  let recs = task.category === "air_conditioner"
    ? decideAc(task, rows)
    : rows
        .sort((a, b) => (b.store_count ?? 0) - (a.store_count ?? 0) || (a.lowest_price ?? 9e9) - (b.lowest_price ?? 9e9))
        .map((r, i) => ({
          canonical_id: r.canonical_id, tps_identity_key: r.tps_identity_key, title_ar: r.display_name_ar, title_en: r.display_name_en,
          brand: r.brand, unit_price: r.lowest_price, total_cost_estimate: r.lowest_price,
          cost_breakdown: { unit: r.lowest_price, installation: null, annual_electricity: null },
          store_count: r.store_count, comparison_available: !!r.has_comparison,
          suitability_score: 0.5, confidence: Math.min(90, Math.round((r.identity_confidence ?? 70))),
          is_smart_pick: i === 0, reasons_ar: [(r.store_count ?? 0) >= 2 ? `سعر موثوق — متوفر في ${r.store_count} متاجر` : "متوفر في متجر واحد"],
          dna: {} as never, go_offer_hint: r.canonical_id,
        }));

  recs = recs.slice(0, Math.min(10, Number(new URL(req.url).searchParams.get("limit")) || 6));

  // Attach a measured-exit go_url per recommendation (cheapest offer of that canonical).
  const ids = recs.map((r) => r.canonical_id);
  const goByCanon = new Map<string, string>();
  if (ids.length) {
    const { data: obs } = await supabase
      .from("normalized_product_observations")
      .select("id, canonical_product_id, observed_at")
      .in("canonical_product_id", ids).order("observed_at", { ascending: false });
    for (const o of obs ?? []) if (!goByCanon.has(o.canonical_product_id)) goByCanon.set(o.canonical_product_id, `/go/${o.id}`);
  }

  const out = recs.map((r) => ({ ...r, go_url: goByCanon.get(r.canonical_id) ?? null }));
  return NextResponse.json({
    version: "v1", task, supported: task.category === "air_conditioner",
    engine: "deterministic", neutrality: "ranking-blind (suitability+trust+total-cost; no commission)",
    count: out.length, smart_pick: out.find((r) => r.is_smart_pick) ?? null, recommendations: out,
  });
}
