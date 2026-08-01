import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { decide, explainChoice, type ShoppingTask, type CanonicalRow } from "@/lib/agent/decision-engine";
import { buildPublishedEvidence } from "@/lib/agent/published-evidence";
import { parseShoppingTask } from "@/lib/agent/task-parser";
import { shouldAsk } from "@/lib/agent/clarify";
import { getPriceVerdicts } from "@/lib/intelligence/getPriceIntelligence";
import { getCanonicalDiscountIntegrity } from "@/lib/intelligence/discount-lookup";
import { getProductAlternatives } from "@/lib/intelligence/product-edges-lookup";
import { assessTrust, hoursSince } from "@/lib/intelligence/evidence-engine";
import { getProviderByStoreId, getProvider } from "@/lib/providers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CanonRaw = { id: string; tps_identity_key: string | null; name_ar: string; name_en: string | null; brand: string | null; category: string; attributes: Record<string, unknown> | null };
type ProjRaw = { canonical_id: string; lowest_price: number | null; store_count: number | null; has_comparison: boolean; identity_confidence: number | null; image_url: string | null; last_observed_at: string | null };

// Per-category canon+proj cache. The two heavy reads (~1.6s) return the SAME rows for every
// shopper of a category and only change when the hourly chain rebuilds — so a short in-process
// TTL removes them from the warm request path with no meaningful staleness and NO ranking change
// (identical data). Bounded (one entry per category). Miss (cold/expired) still fetches fresh.
const CAT_CACHE = new Map<string, { canon: CanonRaw[]; proj: ProjRaw[]; expires: number }>();
const CAT_TTL_MS = 5 * 60_000;

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
  // TPS tables aren't in the generated typed schema; the codebase accesses them via an
  // untyped handle (see store-identity.ts). Row shapes are asserted at the call sites.
  const sb = supabase as unknown as { from: (t: string) => { select: (c: string) => any } };

  // Canonical rows for the category: attributes (for DNA) from canonical_products, price/trust
  // from the projection. Served from the per-category cache; on a miss the two independent heavy
  // reads run in PARALLEL (were two serial PostgREST round-trips) and are cached.
  let cat = CAT_CACHE.get(task.category);
  if (!cat || cat.expires < Date.now()) {
    const [canonRes, projRes] = await Promise.all([
      sb.from("canonical_products")
        .select("id, tps_identity_key, name_ar, name_en, brand, category, attributes")
        .eq("category", task.category).not("tps_identity_key", "is", null).limit(500),
      sb.from("tps_product_projection")
        .select("canonical_id, lowest_price, store_count, has_comparison, identity_confidence, image_url, last_observed_at")
        .eq("category", task.category).limit(500),
    ]);
    cat = { canon: (canonRes?.data ?? []) as CanonRaw[], proj: (projRes?.data ?? []) as ProjRaw[], expires: Date.now() + CAT_TTL_MS };
    CAT_CACHE.set(task.category, cat);
  }
  const canon = cat.canon;
  const projById = new Map((cat.proj ?? []).map((p) => [p.canonical_id, p]));

  const rows: CanonicalRow[] = (canon ?? [])
    .filter((c) => projById.has(c.id)) // only products that made it to the projection (have offers)
    .map((c) => {
      const p = projById.get(c.id)!;
      return {
        canonical_id: c.id, tps_identity_key: c.tps_identity_key,
        display_name_ar: c.name_ar, display_name_en: c.name_en, brand: c.brand, category: c.category,
        image_url: p.image_url ?? null, lowest_price: p.lowest_price, store_count: p.store_count,
        has_comparison: p.has_comparison, identity_confidence: p.identity_confidence, attributes: c.attributes ?? {},
      } as CanonicalRow;
    });

  const { supported, recommendations } = decide(task, rows);

  // P2-8 · "Ambiguous requests may ask ONE clarification question" — and the Constitution's
  // condition on it: *every clarification question must change the recommendation; questions
  // that do not improve confidence are never asked.* That test is run HERE, against the same
  // engine and the same candidate rows that produced the answer above, so a question can only
  // reach a customer when the engine has demonstrated it matters. Enforcing it at review time
  // is enforcing it nowhere.
  const clarify = shouldAsk(task, rows);

  if (!rows.length) {
    return NextResponse.json({ version: "v1", task, supported, count: 0, recommendations: [],
      note: "no canonical products with offers for this category yet" });
  }
  const recs = recommendations.slice(0, Math.min(10, Number(new URL(req.url).searchParams.get("limit")) || 6));

  // Attach a measured-exit go_url per recommendation (cheapest offer of that canonical),
  // and collect WHICH stores corroborate it (the named evidence behind "N stores").
  const ids = recs.map((r) => r.canonical_id);
  // The four top-N-keyed reads were SERIAL (~4 PostgREST round-trips). They are independent,
  // so run them in PARALLEL: observations (go-links + named corroboration), price verdicts,
  // discount integrity, and knowledge-graph alternatives. All fail-soft.
  const goByCanon = new Map<string, string>();
  const storesByCanon = new Map<string, Set<string>>();
  type ObsRaw = { id: string; canonical_product_id: string; observed_at: string; store_id: unknown };
  const [obsRes, verdicts, discounts, alternatives] = await Promise.all([
    ids.length
      ? sb.from("normalized_product_observations")
          .select("id, canonical_product_id, observed_at, store_id")
          .in("canonical_product_id", ids).order("observed_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    getPriceVerdicts(ids).catch(() => new Map()),
    getCanonicalDiscountIntegrity(supabase, ids).catch(() => new Map()),
    getProductAlternatives(supabase, ids).catch(() => new Map()),
  ]);
  const obs = ((obsRes as { data?: unknown })?.data ?? []) as ObsRaw[];
  for (const o of obs) {
    if (!goByCanon.has(o.canonical_product_id)) goByCanon.set(o.canonical_product_id, `/go/${o.id}`);
    // store_id here is a STRING identity (Arabic name / slug / numeric id), not always numeric.
    const raw = o.store_id == null ? "" : String(o.store_id).trim();
    if (raw) {
      const set = storesByCanon.get(o.canonical_product_id) ?? new Set<string>();
      set.add(raw); storesByCanon.set(o.canonical_product_id, set);
    }
  }
  // Resolve each store identity to an Arabic display name. Named stores make the
  // corroboration a VERIFIED FACT, not a count. Handles numeric id, slug, or an
  // already-Arabic name (pass-through — never fabricate a different label).
  const storeDisplay = (raw: string): string => {
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && /^\d+$/.test(raw)) return getProviderByStoreId(asNum)?.displayNameAr || getProviderByStoreId(asNum)?.displayName || raw;
    const bySlug = getProvider(raw.toLowerCase());
    return bySlug?.displayNameAr || raw;
  };
  // Dedupe AFTER mapping — the same store can appear as both a numeric id ("4") and its
  // Arabic name ("اكسترا") in the raw store_id; both resolve to one display name.
  const storeNames = (cid: string): string[] => [...new Set([...(storesByCanon.get(cid) ?? [])].map(storeDisplay))];

  // verdicts / discounts / alternatives were fetched in parallel above (buy-timing intelligence,
  // honest discount integrity, and knowledge-graph alternatives — all fail-soft).
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
    const data_age_hours = hoursSince((proj as { last_observed_at?: string | null } | undefined)?.last_observed_at);
    return { ...r, trust, confidence: trust.score, go_url: goByCanon.get(r.canonical_id) ?? null, stores: storeNames(r.canonical_id), data_age_hours, price_intel, discount_intel: discounts.get(r.canonical_id) ?? null, alternatives: alternatives.get(r.canonical_id) ?? null };
  });
  // Reasoned comparison (§5.5): explain why the smart pick beats the runner-up.
  const smartIdx = out.findIndex((r) => r.is_smart_pick);
  const smart = smartIdx >= 0 ? out[smartIdx] : null;
  const runnerUp = out.find((r, i) => i !== smartIdx);
  const smartWithChoice = smart ? { ...smart, chosen_over: explainChoice(smart, runnerUp) } : null;
  // THE PUBLISHED EVIDENCE CONTRACT (ADR-162). Every customer-visible figure this answer renders,
  // declared with its provenance, so a consumer can verify any number WITHOUT knowing how the
  // engine works and without inferring anything from field names. Built from the same objects the
  // answer is rendered from, so it cannot describe a different answer than the one returned.
  const evidence = buildPublishedEvidence({ recommendations: out, smart_pick: smartWithChoice });
  return NextResponse.json({
    version: "v1", task, parsed: parsed ?? undefined, supported,
    engine: "deterministic", neutrality: "ranking-blind (suitability+trust+total-cost; no commission)",
    count: out.length, smart_pick: smartWithChoice, recommendations: out, evidence,
    // Present ONLY when the engine proved the answer would change it.  still
    // carries its reason so the decision is auditable rather than inferred from silence.
    clarify: clarify.ask ? { question: clarify.question, reason: clarify.reason } : null,
    clarify_skipped_reason: clarify.ask ? null : clarify.reason,
  });
}
