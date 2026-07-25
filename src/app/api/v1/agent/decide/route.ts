import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { decide, explainChoice, type ShoppingTask, type CanonicalRow } from "@/lib/agent/decision-engine";
import { parseShoppingTask } from "@/lib/agent/task-parser";
import { getPriceVerdicts } from "@/lib/intelligence/getPriceIntelligence";
import { getCanonicalDiscountIntegrity } from "@/lib/intelligence/discount-lookup";
import { getProductAlternatives } from "@/lib/intelligence/product-edges-lookup";
import { assessTrust, hoursSince } from "@/lib/intelligence/evidence-engine";

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
  const body = (await req.json().catch(() => ({}))) as ShoppingTask & { text?: string };
  // Accept either a structured task OR free text ("مكيف لغرفة 30 متر ... تحت 4000").
  // Free text is parsed deterministically (no LLM); explicit fields override.
  let task: ShoppingTask & { text?: string } = body;
  let parsed: ReturnType<typeof parseShoppingTask> | null = null;
  if (typeof body.text === "string" && body.text.trim()) {
    parsed = parseShoppingTask(body.text);
    task = { ...parsed, ...body }; // explicit body fields win over parsed
    if (!task.category && parsed.category) task.category = parsed.category;
  }
  if (!task.category) {
    return NextResponse.json({ error: "category required (or provide `text` the parser can classify)", parsed }, { status: 400 });
  }
  const supabase = createServerClient();

  // Canonical rows for the category: attributes (for DNA) from canonical_products,
  // price/trust from the projection. Include both Layer 1 (comparable) and Layer 2.
  const { data: canon } = await supabase
    .from("canonical_products")
    .select("id, tps_identity_key, name_ar, name_en, brand, category, attributes")
    .eq("category", task.category).not("tps_identity_key", "is", null).limit(500);
  const { data: proj } = await supabase
    .from("tps_product_projection")
    .select("canonical_id, lowest_price, store_count, has_comparison, identity_confidence, image_url, last_observed_at")
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

  const { supported, recommendations } = decide(task, rows);
  if (!rows.length) {
    return NextResponse.json({ version: "v1", task, supported, count: 0, recommendations: [],
      note: "no canonical products with offers for this category yet" });
  }
  const recs = recommendations.slice(0, Math.min(10, Number(new URL(req.url).searchParams.get("limit")) || 6));

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

  // Fuse "which to buy" with "when to buy": attach a deterministic price-history
  // verdict per recommendation (buy-timing intelligence). Additive + fail-soft —
  // if history reads fail, recommendations still return (never blocks the answer).
  const verdicts = await getPriceVerdicts(ids).catch(() => new Map());
  // Honest discount integrity per product ("real saving vs what we observed").
  const discounts = await getCanonicalDiscountIntegrity(supabase, ids).catch(() => new Map());
  // Knowledge-graph alternatives (storage variants + newer/older generations).
  const alternatives = await getProductAlternatives(supabase, ids).catch(() => new Map());
  const out = recs.map((r) => {
    const v = verdicts.get(r.canonical_id);
    const price_intel = v
      ? { verdict: v.verdict, confident: v.confident, is_observed_low: v.isObservedLow, days_tracked: v.daysTracked,
          distinct_days: v.distinctDays, current_best: v.currentBest, typical: v.typical, pct_vs_typical: v.pctVsTypical,
          trend: v.trend, text: v.text }
      : null;
    // ADR-087: enrich the base trust with the price-history evidence now available, so
    // the price-history factor reflects real observations instead of a conservative
    // default. Deterministic; the score stays evidence-grounded and cited.
    const proj = projById.get(r.canonical_id);
    // ADR-091: feed the Discount Integrity verdict (already fetched below) into the
    // deal-integrity factor so it stops defaulting. verified_drop = an honest, history-
    // backed discount; inflated_reference = a CLAIMED saving the price history does NOT
    // support → the factor drops and surfaces the "discount not supported" caveat (a
    // core Tawveeri honesty signal). stable / no data = no claim, nothing to distrust.
    const d = discounts.get(r.canonical_id);
    const discountClaimed = d ? (d.verdict === "verified_drop" || d.verdict === "inflated_reference") : false;
    const trust = assessTrust({
      store_count: r.store_count,
      identity_confidence: proj?.identity_confidence ?? null,
      has_comparison: r.comparison_available,
      specs_incomplete: /\|NO_(STORAGE|TECH|SERIES|PANEL)\b/.test(r.tps_identity_key || ""),
      price_confident: v?.confident ?? null,
      price_distinct_days: v?.distinctDays ?? null,
      data_age_hours: hoursSince((proj as { last_observed_at?: string | null } | undefined)?.last_observed_at),
      discount_claimed: discountClaimed,
      discount_honest: discountClaimed ? d!.verdict === "verified_drop" : null,
    });
    return { ...r, trust, confidence: trust.score, go_url: goByCanon.get(r.canonical_id) ?? null, price_intel, discount_intel: discounts.get(r.canonical_id) ?? null, alternatives: alternatives.get(r.canonical_id) ?? null };
  });
  // Reasoned comparison (§5.5): explain why the smart pick beats the runner-up.
  const smartIdx = out.findIndex((r) => r.is_smart_pick);
  const smart = smartIdx >= 0 ? out[smartIdx] : null;
  const runnerUp = out.find((r, i) => i !== smartIdx);
  const smartWithChoice = smart ? { ...smart, chosen_over: explainChoice(smart, runnerUp) } : null;
  return NextResponse.json({
    version: "v1", task, parsed: parsed ?? undefined, supported,
    engine: "deterministic", neutrality: "ranking-blind (suitability+trust+total-cost; no commission)",
    count: out.length, smart_pick: smartWithChoice, recommendations: out,
  });
}
