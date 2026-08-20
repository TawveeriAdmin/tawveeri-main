import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { decide, explainChoice, requiredBtuForRoom, AC_BTU_FIT_TOLERANCE, type ShoppingTask, type CanonicalRow, type Recommendation } from "@/lib/agent/decision-engine";
import { buildPublishedEvidence } from "@/lib/agent/published-evidence";
import { guardAdvisorPayload } from "@/lib/agent/answer-guard";
import { parseShoppingTask } from "@/lib/agent/task-parser";
import { semanticExtract } from "@/lib/agent/semantic-fallback";
import { buildBasketSummary } from "@/lib/agent/basket";
import { shouldAsk } from "@/lib/agent/clarify";
import { getPriceVerdicts } from "@/lib/intelligence/getPriceIntelligence";
import { getCanonicalDiscountIntegrity } from "@/lib/intelligence/discount-lookup";
import { getProductAlternatives } from "@/lib/intelligence/product-edges-lookup";
import { assessTrust, hoursSince, PICK_FRESHNESS_MAX_HOURS } from "@/lib/intelligence/evidence-engine";
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
 * MEASURED DEFECT (2026-08-20, «أبي تليفزيون ب 250ريال»): `applyBudgetGate`
 * (decision-engine.ts, shared across every category) deliberately keeps suitability-ranked
 * over-budget candidates visible as "closest options" when nothing satisfies the stated
 * budget — a considered cross-category tradeoff, pinned by
 * tests/agent/decision-engine.test.ts ("never emptied — the closest options still show").
 * Founder direction (2026-08-20): leave that shared behavior untouched for every OTHER
 * category; scope this fix to `tv` only. `decideTv`'s suitability score (screen size /
 * resolution / brand fit) is not price-correlated, so "closest by suitability" can land
 * arbitrarily far from budget — MEASURED on production: Samsung TVs at
 * 59,999 / 27,699 / 6,499 SAR surfaced as "خيارات أخرى مناسبة" beside an honest "nothing
 * fits under 250 SAR" note. The top pick (index 0 — `budgetNote` below already names it
 * honestly when nobody qualifies) is kept either way; every OTHER over-budget item is
 * dropped rather than presented as if it were a suitable alternative ("Unknown beats
 * incorrect" — same principle `categoryEnforcedZero`/search-client.tsx already applies).
 *
 * A pure function (no I/O) so it is unit-testable without mocking the route's Supabase reads.
 */
export function filterOverBudgetTvAlternatives(
  category: string,
  budgetTotal: number | null,
  recommendations: Recommendation[],
): Recommendation[] {
  if (category !== "tv" || !budgetTotal || budgetTotal <= 0) return recommendations;
  return recommendations.filter((r, i) => i === 0 || r.unit_price == null || r.unit_price <= budgetTotal);
}

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
  let semanticUsed = false;
  if (typeof body.text === "string" && body.text.trim()) {
    parsed = parseShoppingTask(body.text);
    task = { ...parsed, ...body }; // explicit body fields win over parsed
    if (!task.category && parsed.category) task.category = parsed.category;

    // ── SEMANTIC FALLBACK (FINAL SEMANTIC INTELLIGENCE mission, 2026-08-10) ──────────────
    // Runs when the deterministic parser found NOTHING (no category) — full extraction — OR
    // when it resolved a category but the sentence is long/descriptive (>=5 words), in which
    // case it runs PRIORITIES-ONLY enrichment (never touches an already-resolved category or
    // budget). MEASURED (scripts/waffar-eval, cases M03/M06/M07/EXP03/PARA02/PARA03): a
    // sentence like «نومي خفيف والمكيف الحالي يزعجني» resolves "air_conditioner" from «مكيف»
    // just fine deterministically, but its actual DECISION-RELEVANT signal — noise
    // sensitivity — has no keyword to land on and was silently lost; gating the semantic call
    // on "no category at all" missed exactly the cases where the ceiling actually bites.
    // Interpretation only: never touches ranking, eligibility, price, or evidence below this
    // block (still exclusively `decide()` + the deterministic engine — ADR-002 untouched).
    // See semantic-fallback.ts's own header for the closed-vocabulary / never-throws contract.
    const descriptiveText = body.text.trim().split(/\s+/).filter(Boolean).length >= 5;
    if (!body.category && (!task.category || descriptiveText)) {
      const semantic = await semanticExtract(body.text).catch(() => null);
      if (semantic) {
        semanticUsed = true;
        if (semantic.category && !task.category) {
          task.category = semantic.category;
          parsed = { ...parsed!, category: semantic.category, semantic_confidence: semantic.confidence };
        }
        if (semantic.budget_total != null && task.budget_total == null) {
          task.budget_total = semantic.budget_total;
          parsed = { ...parsed!, budget_total: semantic.budget_total };
        }
        if (semantic.priorities.length) {
          // MEASURED CONFLICT DEFECT (2026-08-10, FINAL SEMANTIC INTELLIGENCE mission,
          // scripts/waffar-eval/parity.ts case P04): given ONLY «ما يهمني الألعاب» in
          // isolation (a 3-word fragment naming no device), the model returned a POSITIVE
          // "gaming" priority at confidence 0 — directly contradicting what the deterministic
          // parser (task-parser.ts's negation-window logic) correctly read from the SAME text
          // moments earlier: "gaming" de-prioritized, not wanted. Mission brief §18 requires an
          // explicit fallback for exactly this — "semantic output conflicting with explicit
          // text" — and the deterministic reading of the shopper's OWN words must win a
          // conflict, never a probabilistic guess. Filtered here, once, before either merge
          // below, rather than trusting the model to never contradict a signal it was not even
          // asked to reconcile against.
          const conflictsWithDeterministic = new Set([...(parsed!.deprioritized_priorities ?? []), ...(parsed!.excluded_priorities ?? [])]);
          const safeInferred = semantic.priorities.filter((p) => !conflictsWithDeterministic.has(p));
          if (safeInferred.length) {
            // NEVER merged into `task.priorities`/`parsed.priorities` — those feed
            // `explicit_preferences` downstream (decision-state.ts). Landing on the dedicated
            // `inferred_priorities` field is what keeps a semantic guess from ever being shown
            // with the same confidence as something the shopper actually typed, while still
            // reaching the SAME ranking input the deterministic priorities use (soft_preferences).
            parsed = { ...parsed!, inferred_priorities: safeInferred };
            task = { ...task, priorities: [...new Set([...(task.priorities ?? []), ...safeInferred])] };
          }
        }
      }
    }
  }
  if (!task.category) {
    return NextResponse.json({ error: "category required (or provide `text` the parser can classify)", parsed, semantic_used: semanticUsed }, { status: 400 });
  }
  // Multi-unit honesty (basket, 2026-08-04): the engine prices ONE unit, so a request for
  // N units with a TOTAL budget must reason against the per-unit ceiling (total ÷ N) —
  // otherwise «ضمن ميزانيتك» would bless a single device that consumes the whole basket
  // budget. The acknowledgement (quantity · total · per-unit · unknowns) is returned as
  // `basket` and rendered by the answer surface; the ranking itself stays single-unit.
  const basket = buildBasketSummary(task.quantity, task.budget_total ?? null, task.category);
  const engineTask = basket?.per_unit_ceiling ? { ...task, budget_total: basket.per_unit_ceiling } : task;
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

  const { supported, recommendations, anyWithinBudget } = decide(engineTask, rows);
  const scopedRecommendations = filterOverBudgetTvAlternatives(engineTask.category, engineTask.budget_total ?? null, recommendations);

  // P2-8 · "Ambiguous requests may ask ONE clarification question" — and the Constitution's
  // condition on it: *every clarification question must change the recommendation; questions
  // that do not improve confidence are never asked.* That test is run HERE, against the same
  // engine and the same candidate rows that produced the answer above, so a question can only
  // reach a customer when the engine has demonstrated it matters. Enforcing it at review time
  // is enforcing it nowhere.
  const clarify = shouldAsk(engineTask, rows);

  if (!rows.length) {
    return NextResponse.json({ version: "v1", task, supported, count: 0, recommendations: [], basket,
      note: "no canonical products with offers for this category yet" });
  }
  const recs = scopedRecommendations.slice(0, Math.min(10, Number(new URL(req.url).searchParams.get("limit")) || 6));

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
    // ADR-193 — the pick LABEL is conditioned on the age of its price evidence. The
    // suitability ranking is untouched (fit does not age; the price claim does): the same
    // product stays first in the list, it just is not badged «الاختيار الأنسب» when its
    // freshest observation sits in the freshness floor band. Unknown age does not demote
    // (P2 handles unknown through the trust score, not through silent suppression).
    const is_smart_pick = r.is_smart_pick && !(data_age_hours != null && data_age_hours > PICK_FRESHNESS_MAX_HOURS);
    if (r.is_smart_pick && !is_smart_pick) {
      console.warn(`[smart-pick-freshness] advisor label withheld: age=${Math.round(data_age_hours!)}h > ${PICK_FRESHNESS_MAX_HOURS}h · canonical=${r.canonical_id}`);
    }
    return { ...r, is_smart_pick, trust, confidence: trust.score, go_url: goByCanon.get(r.canonical_id) ?? null, stores: storeNames(r.canonical_id), data_age_hours, price_intel, discount_intel: discounts.get(r.canonical_id) ?? null, alternatives: alternatives.get(r.canonical_id) ?? null };
  });
  // Never silently relax a hard budget (brief §10/§24): when the gate found NO in-budget
  // candidate, say so explicitly and name the closest (cheapest) option instead of quietly
  // presenting a suitability-sorted over-budget item as if it satisfied the request. Uses
  // `unit_price` — the SAME verified-price basis `decide()`'s budget gate itself uses (not
  // `total_cost_estimate`, which bundles modelled installation/electricity estimates) — so
  // this note and `anyWithinBudget` can never disagree about what "closest" means.
  const budgetNote = (() => {
    if (anyWithinBudget || !engineTask.budget_total) return null;
    const cheapest = out.reduce<{ cost: number; title_ar: string | null; title_en: string | null } | null>((min, r) => {
      const cost = r.unit_price;
      if (cost == null) return min;
      return !min || cost < min.cost ? { cost, title_ar: r.title_ar, title_en: r.title_en } : min;
    }, null);
    if (!cheapest) return null;
    return {
      ar: `لم أجد خيارًا موثقًا تحت ${engineTask.budget_total} ريال. أقرب خيار هو "${cheapest.title_ar ?? cheapest.title_en}" بسعر ~${Math.round(cheapest.cost)} ريال.`,
      en: `No documented option under ${engineTask.budget_total} SAR. The closest is "${cheapest.title_en ?? cheapest.title_ar}" at ~${Math.round(cheapest.cost)} SAR.`,
    };
  })();

  // Saudi Shopper Language & Demand Discovery mission (2026-08-11): a shopper who asked for
  // something "عليه عرض"/"on sale" gets an HONEST answer built from the Discount Integrity
  // evidence already computed above for every candidate (`discount_intel`, ADR-091) — never a
  // new claim, never a re-sort (ranking stays single-authority: suitability + trust + cost).
  // If no candidate carries a `verified_drop`, say so plainly rather than silently ignoring the
  // request or reusing an `inflated_reference`/unverified "خصم" claim just to answer "yes".
  const dealNote = (() => {
    if (!engineTask.wants_discount) return null;
    const verified = out.find((r) => r.discount_intel?.verdict === "verified_drop");
    if (verified && verified.discount_intel) {
      const title = verified.title_ar ?? verified.title_en;
      return { ar: `وجدت خصمًا موثقًا على "${title}": ${verified.discount_intel.text.ar}`.trim(),
        en: `Found a verified discount on "${verified.title_en ?? verified.title_ar}": ${verified.discount_intel.text.en}`.trim() };
    }
    return {
      ar: "لا نملك حاليًا خصمًا موثّقًا على أي من هذه الترشيحات — الترشيح أدناه مبني على الملاءمة والسعر، وليس على عرض غير مؤكد.",
      en: "We don't currently have a verified discount on any of these picks — the recommendation below is based on fit and price, not an unverified offer.",
    };
  })();

  // Reasoned comparison (§5.5): explain why the smart pick beats the runner-up.
  const smartIdx = out.findIndex((r) => r.is_smart_pick);
  const smart = smartIdx >= 0 ? out[smartIdx] : null;
  const runnerUp = out.find((r, i) => i !== smartIdx);
  const smartWithChoice = smart ? { ...smart, chosen_over: explainChoice(smart, runnerUp) } : null;

  // AC SMART PICK AUDIT (2026-08-09, founder direction): the per-item reason text already
  // carries "⚠️ السعة X أقل من المطلوب" when a candidate under-sizes, but the TOP-LEVEL
  // "الاختيار الأنسب" (Best Pick) label carried no equivalent disclosure — a shopper could
  // read the crown without registering the caveat sitting inside a collapsed reasons list.
  // MEASURED on the Golden Query: the Smart Pick (20500 BTU, ~14.6% under a 24000-BTU room)
  // beats two correctly-sized 24000 BTU candidates in the SAME shortlist whose device price
  // is comfortably under budget (2,820 / 2,362 SAR) but whose ESTIMATED total cost
  // (device + modelled installation + modelled annual electricity) crosses the stated
  // budget — decideAc's soft total-cost penalty (-0.12) outweighs their better BTU-fit
  // score. This is coherent, not a bug (the hard budget gate correctly gates on the
  // VERIFIED device price, not the estimate — see decision-engine.ts) — but a shopper
  // reading only the crowned pick would not know a properly-sized option exists at all.
  // Same governing rule as `budgetNote`: never present a partial match as an unqualified
  // winner without saying so.
  const capacityNote = (() => {
    if (engineTask.category !== "air_conditioner" || !engineTask.room_size_m2 || !smart) return null;
    const requiredBtu = requiredBtuForRoom(engineTask.room_size_m2);
    const smartBtu = Number((smart.dna as { capacity_btu?: unknown })?.capacity_btu);
    if (!Number.isFinite(smartBtu)) return null;
    const relOf = (btu: number) => Math.abs(btu - requiredBtu) / requiredBtu;
    if (relOf(smartBtu) <= AC_BTU_FIT_TOLERANCE) return null; // the pick itself already fits — nothing to disclose
    // Is there a correctly-sized option among the SAME shown shortlist? Named honestly if
    // so — including that its own total cost may be why it did not win — never invented.
    const betterFit = out.find((r) => {
      const btu = Number((r.dna as { capacity_btu?: unknown })?.capacity_btu);
      return Number.isFinite(btu) && relOf(btu) <= AC_BTU_FIT_TOLERANCE;
    });
    if (betterFit) {
      const overBudget = engineTask.budget_total != null && (betterFit.total_cost_estimate ?? betterFit.unit_price ?? 0) > engineTask.budget_total;
      return {
        ar: `الاختيار المرشّح لا يصل للسعة الموصى بها بالكامل (~${requiredBtu} وحدة لغرفة ${engineTask.room_size_m2}م²). يوجد خيار بالسعة الصحيحة — "${betterFit.title_ar ?? betterFit.title_en}"${overBudget ? ` — لكن تكلفته الإجمالية التقديرية (شاملة التركيب والكهرباء) تتجاوز ميزانيتك، رغم أن سعر الجهاز نفسه لا يتجاوزها` : ''}.`,
        en: `The recommended pick does not fully reach the suggested capacity (~${requiredBtu} BTU for a ${engineTask.room_size_m2}m² room). A correctly-sized option exists — "${betterFit.title_en ?? betterFit.title_ar}"${overBudget ? ` — but its estimated total cost (including modelled installation and electricity) exceeds your budget, even though the unit price alone does not` : ''}.`,
      };
    }
    return {
      ar: `لا يوجد ضمن الخيارات المعروضة اليوم مكيف يصل للسعة الموصى بها بالكامل (~${requiredBtu} وحدة لغرفة ${engineTask.room_size_m2}م²) — الاختيار المعروض هو الأقرب المتاح ضمن الأدلة الحالية.`,
      en: `None of the options shown today reach the fully recommended capacity (~${requiredBtu} BTU for a ${engineTask.room_size_m2}m² room) — the option shown is the closest available given current evidence.`,
    };
  })();
  // THE PUBLISHED EVIDENCE CONTRACT (ADR-162). Every customer-visible figure this answer renders,
  // declared with its provenance, so a consumer can verify any number WITHOUT knowing how the
  // engine works and without inferring anything from field names. Built from the same objects the
  // answer is rendered from, so it cannot describe a different answer than the one returned.
  const evidence = buildPublishedEvidence({ recommendations: out, smart_pick: smartWithChoice });

  // P2-5 · F7 ON EVERY CUSTOMER-VISIBLE SENTENCE (ADR-163). The engine is deterministic, but its
  // sentences are COMPOSED at runtime from data — and a repository search cannot catch what a
  // template produces, which is the same property F7 exists to answer for a model. A failing
  // sentence is WITHHELD, never rewritten. Measured to fire zero times on real production output;
  // that is the difference between "we checked" and "we believe".
  const guarded = guardAdvisorPayload(
    { smart_pick: smartWithChoice, recommendations: out },
    evidence,
    { query: typeof task.text === "string" ? task.text : task.category, surface: "agent/decide", timestamp: new Date().toISOString() },
  );
  if (guarded.withheld.length) {
    console.warn(`[f7-advisor] withheld ${guarded.withheld.length} sentence(s):`,
      guarded.withheld.map((w) => `${w.path} [${w.ruleIds.join(",")}]`).join(" · "));
  }

  return NextResponse.json({
    version: "v1", task, parsed: parsed ?? undefined, supported, basket,
    engine: "deterministic", neutrality: "ranking-blind (suitability+trust+total-cost; no commission)",
    count: out.length, smart_pick: guarded.payload.smart_pick, recommendations: guarded.payload.recommendations, evidence,
    // true unless a budget was stated AND no candidate satisfies it (never silent — see
    // `budget_note` below). Absent/true when no budget was stated at all.
    budget_satisfied: anyWithinBudget,
    budget_note: budgetNote,
    // Present ONLY when the shopper's own text asked for something on offer/discounted —
    // never fabricated, never silent (see `dealNote` above).
    deal_note: dealNote,
    // AC-only, present ONLY when the Smart Pick itself under/over-sizes beyond the same
    // tolerance its own reason text uses — never silent about a partial capacity match.
    capacity_note: capacityNote,
    // Present ONLY when the engine proved the answer would change it.  still
    // carries its reason so the decision is auditable rather than inferred from silence.
    clarify: clarify.ask ? { question: clarify.question, reason: clarify.reason } : null,
    clarify_skipped_reason: clarify.ask ? null : clarify.reason,
  });
}
