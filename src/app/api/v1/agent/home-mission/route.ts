import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { decide, type ShoppingTask, type CanonicalRow, type Recommendation } from "@/lib/agent/decision-engine";
import {
  parseHomeMission, buildLegs, eligibleRows, allocateBudget, comparisonClaim,
  tvSizeOf, MISSION_CATEGORIES, TOTAL_DISCLOSURE_AR, TOTAL_DISCLOSURE_EN,
  EFFICIENCY_ABSTENTION_AR, EFFICIENCY_ABSTENTION_EN, AC_PRO_SIZING_AR, AC_PRO_SIZING_EN,
  type HomeMissionParse, type MissionLeg, type MissionCategory, type ClaimKind,
} from "@/lib/agent/home-mission";
import { buildPublishedEvidence } from "@/lib/agent/published-evidence";
import { guardAdvisorPayload } from "@/lib/agent/answer-guard";
import { hoursSince } from "@/lib/intelligence/evidence-engine";
import { getProviderByStoreId, getProvider } from "@/lib/providers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/agent/home-mission — «جهّز بيتك بذكاء» (Home Decision Intelligence pilot;
 * gate GO_HOME, AUDIT_REPORT_HOME §19–20).
 *
 * ORCHESTRATION ABOVE THE ONE BRAIN, NEVER A SECOND BRAIN: parses a Saudi home
 * description deterministically (no LLM anywhere in this route), derives per-category
 * legs, applies the audit's HARD eligibility (freshness ≤168h, BTU/liters/kg bands,
 * accessory floor), then the UNCHANGED `decide()` ranks inside each leg, and a
 * deterministic allocator spreads ONE shared budget across the legs (basket.ts
 * generalized). Every price is a verified device price; totals are device-only and say
 * so; comparison wording is gated per the audit's honesty contract.
 *
 * Body: { text?: string } — natural language, OR
 *       { mission?: <structured parse — the client's mutated DecisionState> ,
 *         excluded_ids?: string[] }  — rejections carried across turns.
 */

type CanonRaw = { id: string; tps_identity_key: string | null; name_ar: string; name_en: string | null; brand: string | null; category: string; attributes: Record<string, unknown> | null; model_number: string | null };
type ProjRaw = { canonical_id: string; lowest_price: number | null; store_count: number | null; has_comparison: boolean; identity_confidence: number | null; image_url: string | null; last_observed_at: string | null };

// Same per-category cache discipline as /api/v1/agent/decide (5-min TTL, identical data).
const CAT_CACHE = new Map<string, { canon: CanonRaw[]; proj: ProjRaw[]; expires: number }>();
const CAT_TTL_MS = 5 * 60_000;

async function fetchCategory(sb: { from: (t: string) => { select: (c: string) => any } }, category: string) {
  let cat = CAT_CACHE.get(category);
  if (!cat || cat.expires < Date.now()) {
    const [canonRes, projRes] = await Promise.all([
      sb.from("canonical_products")
        .select("id, tps_identity_key, name_ar, name_en, brand, category, attributes, model_number")
        .eq("category", category).not("tps_identity_key", "is", null).limit(500),
      sb.from("tps_product_projection")
        .select("canonical_id, lowest_price, store_count, has_comparison, identity_confidence, image_url, last_observed_at")
        .eq("category", category).limit(500),
    ]);
    cat = { canon: (canonRes?.data ?? []) as CanonRaw[], proj: (projRes?.data ?? []) as ProjRaw[], expires: Date.now() + CAT_TTL_MS };
    CAT_CACHE.set(category, cat);
  }
  return cat;
}

/** Structured mission accepted from the client on continuation turns — validated field by
 *  field against the same closed vocabulary the parser emits (never trusted raw). */
function sanitizeMission(m: unknown): HomeMissionParse | null {
  if (!m || typeof m !== "object") return null;
  const src = m as Record<string, unknown>;
  const spaces = Array.isArray(src.spaces)
    ? src.spaces.slice(0, 8).flatMap((s, i) => {
        if (!s || typeof s !== "object") return [];
        const sp = s as Record<string, unknown>;
        const area = typeof sp.area_m2 === "number" && sp.area_m2 >= 5 && sp.area_m2 <= 200 ? sp.area_m2 : null;
        return [{
          key: `space_${i + 1}`,
          label_ar: typeof sp.label_ar === "string" ? sp.label_ar.slice(0, 40) : "غرفة",
          label_en: typeof sp.label_en === "string" ? sp.label_en.slice(0, 40) : "Room",
          area_m2: area,
        }];
      })
    : [];
  const household = typeof src.household_size === "number" && src.household_size >= 1 && src.household_size <= 20 ? Math.floor(src.household_size) : null;
  const budget = typeof src.budget_total === "number" && src.budget_total >= 1000 && src.budget_total <= 500_000 ? Math.round(src.budget_total) : null;
  const categories: HomeMissionParse["categories"] = {};
  if (src.categories && typeof src.categories === "object") {
    for (const cat of MISSION_CATEGORIES) {
      const v = (src.categories as Record<string, unknown>)[cat];
      if (v === "high" || v === "normal" || v === "deprioritized" || v === "excluded") categories[cat] = v;
    }
  }
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12) : []);
  return {
    spaces, household_size: household, budget_total: budget, categories,
    priorities: strArr(src.priorities), deprioritized_priorities: strArr(src.deprioritized_priorities),
    excluded_priorities: strArr(src.excluded_priorities),
    whole_home: Boolean(src.whole_home), unsupported_mentions: [],
    parsed_from_text: typeof src.parsed_from_text === "string" ? src.parsed_from_text.slice(0, 500) : "",
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; mission?: unknown; excluded_ids?: unknown };
  const structured = sanitizeMission(body.mission);
  const parse: HomeMissionParse | null = structured
    ?? (typeof body.text === "string" && body.text.trim() ? parseHomeMission(body.text) : null);
  if (!parse) {
    return NextResponse.json({ error: "text or mission required" }, { status: 400 });
  }
  const excludedIds = new Set(
    Array.isArray(body.excluded_ids) ? body.excluded_ids.filter((x): x is string => typeof x === "string").slice(0, 40) : [],
  );

  const legs = buildLegs(parse);
  if (!legs.length) {
    // Honest empty state: we understood the text but found no plannable category —
    // never a fabricated default plan.
    return NextResponse.json({
      version: "v1", state: "need_categories", understood: parse,
      note_ar: "ما قدرت أحدد الأجهزة المطلوبة — اذكر مثلاً: مكيفات، ثلاجة، غسالة، تلفزيون، أو قل «جهز بيتي».",
      note_en: "I could not identify which appliances you need — mention e.g. ACs, refrigerator, washer, TV, or say \"equip my home\".",
      unsupported_mentions: parse.unsupported_mentions,
    });
  }

  const supabase = createServerClient();
  const sb = supabase as unknown as { from: (t: string) => { select: (c: string) => any } };
  const categories = [...new Set(legs.map((l) => l.category))];
  const fetched = await Promise.all(categories.map((c) => fetchCategory(sb, c)));
  const byCategory = new Map(categories.map((c, i) => [c, fetched[i]]));

  // Per-leg: rows → hard eligibility → decide() ranking (engine untouched, no leg budget:
  // the allocator, not the engine, owns the shared budget — a leg-level budget nudge would
  // double-count the constraint).
  type LegRun = {
    leg: MissionLeg;
    state: "ok" | "needs_area" | "insufficient";
    recs: Recommendation[];
    dropped?: ReturnType<typeof eligibleRows>["dropped"];
    ageOf: (id: string) => number | null;
    projOf: (id: string) => ProjRaw | undefined;
    modelOf: (id: string) => string | null;
  };
  const runs: LegRun[] = legs.map((leg) => {
    const cat = byCategory.get(leg.category)!;
    const projById = new Map(cat.proj.map((p) => [p.canonical_id, p]));
    const modelById = new Map(cat.canon.map((c) => [c.id, c.model_number]));
    const ageOf = (id: string) => hoursSince(projById.get(id)?.last_observed_at ?? null);
    const projOf = (id: string) => projById.get(id);
    const modelOf = (id: string) => modelById.get(id) ?? null;
    if (leg.needs === "room_area") return { leg, state: "needs_area", recs: [], ageOf, projOf, modelOf };
    const rows: CanonicalRow[] = cat.canon
      .filter((c) => projById.has(c.id) && !excludedIds.has(c.id))
      .map((c) => {
        const p = projById.get(c.id)!;
        return {
          canonical_id: c.id, tps_identity_key: c.tps_identity_key ?? "",
          display_name_ar: c.name_ar, display_name_en: c.name_en, brand: c.brand, category: c.category,
          image_url: p.image_url ?? null, lowest_price: p.lowest_price, store_count: p.store_count,
          has_comparison: p.has_comparison, identity_confidence: p.identity_confidence, attributes: c.attributes ?? {},
        } as CanonicalRow;
      });
    const elig = eligibleRows(leg, rows, ageOf);
    if (!elig.rows.length) return { leg, state: "insufficient", recs: [], dropped: elig.dropped, ageOf, projOf, modelOf };
    const task: ShoppingTask = {
      category: leg.category,
      room_size_m2: leg.space?.area_m2 ?? undefined,
      priorities: parse.priorities,
    };
    const { recommendations } = decide(task, elig.rows);
    return { leg, state: "ok", recs: recommendations.slice(0, 8), dropped: elig.dropped, ageOf, projOf, modelOf };
  });

  // Shared-budget allocation over the engine's own ranked candidates.
  const allocation = allocateBudget(
    runs.filter((r) => r.state === "ok").map((r) => ({
      leg: r.leg,
      candidates: r.recs.map((rec, i) => ({ canonical_id: rec.canonical_id, price: rec.unit_price, rank: i })),
    })),
    parse.budget_total,
  );
  const allocByLeg = new Map(allocation.allocations.map((a) => [a.leg_id, a]));

  // Evidence enrichment (measured /go exits + NAMED stores) for every canonical the plan
  // may show — picked + alternative + next-upgrade. Same resolution rules as the decide
  // route (numeric id vs Arabic name both map to ONE display name; dedupe after mapping).
  const shownIds = new Set<string>();
  for (const r of runs) {
    const a = allocByLeg.get(r.leg.id);
    const picked = a?.picked ?? r.recs[0]?.canonical_id ?? null;
    if (picked) shownIds.add(picked);
    const alt = r.recs.find((x) => x.canonical_id !== picked);
    if (alt) shownIds.add(alt.canonical_id);
    if (a?.next_upgrade) shownIds.add(a.next_upgrade.canonical_id);
  }
  const goByCanon = new Map<string, string>();
  const storesByCanon = new Map<string, Set<string>>();
  if (shownIds.size) {
    const obsRes = await sb.from("normalized_product_observations")
      .select("id, canonical_product_id, observed_at, store_id")
      .in("canonical_product_id", [...shownIds]).order("observed_at", { ascending: false });
    const obs = ((obsRes as { data?: unknown })?.data ?? []) as { id: string; canonical_product_id: string; store_id: unknown }[];
    for (const o of obs) {
      if (!goByCanon.has(o.canonical_product_id)) goByCanon.set(o.canonical_product_id, `/go/${o.id}`);
      const raw = o.store_id == null ? "" : String(o.store_id).trim();
      if (raw) {
        const set = storesByCanon.get(o.canonical_product_id) ?? new Set<string>();
        set.add(raw); storesByCanon.set(o.canonical_product_id, set);
      }
    }
  }
  const storeDisplay = (raw: string): string => {
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && /^\d+$/.test(raw)) return getProviderByStoreId(asNum)?.displayNameAr || getProviderByStoreId(asNum)?.displayName || raw;
    return getProvider(raw.toLowerCase())?.displayNameAr || raw;
  };
  const storeNames = (cid: string): string[] => [...new Set([...(storesByCanon.get(cid) ?? [])].map(storeDisplay))];

  const claimLine = (kind: ClaimKind, stores: string[]): { ar: string; en: string } => {
    if (kind === "compared") return {
      ar: `قارنّا ${stores.length} عروض موثقة لنفس الموديل (${stores.join("، ")})`,
      en: `Compared ${stores.length} documented offers of the same model (${stores.join(", ")})`,
    };
    if (kind === "availability") return {
      ar: `متوفر لدى ${stores.length} متاجر — لم نؤكد أنها نفس الموديل تمامًا، فلا نسميها مقارنة`,
      en: `Available at ${stores.length} stores — same-model identity not confirmed, so we do not call it a comparison`,
    };
    return { ar: "متاح لدينا حاليًا من متجر واحد", en: "Currently evidenced from one store only" };
  };

  const recOut = (r: LegRun, rec: Recommendation) => {
    const stores = storeNames(rec.canonical_id);
    const age = r.ageOf(rec.canonical_id);
    const proj = r.projOf(rec.canonical_id);
    const claim = comparisonClaim({
      store_names: stores, data_age_hours: age,
      tps_identity_key: rec.tps_identity_key, model_number: r.modelOf(rec.canonical_id),
    });
    return {
      canonical_id: rec.canonical_id,
      title_ar: rec.title_ar, title_en: rec.title_en, brand: rec.brand,
      image_url: proj?.image_url ?? null,
      unit_price: rec.unit_price != null ? Math.round(rec.unit_price) : null,
      store_count: stores.length, stores,
      data_age_hours: age,
      claim_kind: claim, claim_ar: claimLine(claim, stores).ar, claim_en: claimLine(claim, stores).en,
      reasons_ar: rec.reasons_ar, reason_kinds: rec.reason_kinds, headline_reasons: rec.headline_reasons,
      trust: rec.trust, suitability_score: rec.suitability_score,
      dna: rec.dna,
      go_url: goByCanon.get(rec.canonical_id) ?? null,
      compare_url: `/products?canonical=${rec.canonical_id}`,
      tv_size: r.leg.category === "tv"
        ? tvSizeOf({ display_name_ar: rec.title_ar, display_name_en: rec.title_en, attributes: rec.dna } as unknown as CanonicalRow)
        : undefined,
    };
  };

  const legsOut = runs.map((r) => {
    const a = allocByLeg.get(r.leg.id);
    if (r.state === "needs_area") {
      return {
        leg_id: r.leg.id, category: r.leg.category, label_ar: r.leg.label_ar, label_en: r.leg.label_en,
        emphasis: r.leg.emphasis, state: "needs_area" as const,
        space: r.leg.space,
        question_ar: `كم مساحة ${r.leg.space?.label_ar ?? "الغرفة"} بالمتر المربع؟ السعة المناسبة للمكيف تعتمد عليها مباشرة.`,
        question_en: `What is the area of ${r.leg.space?.label_en ?? "the room"} in m²? The right AC capacity depends on it directly.`,
      };
    }
    if (r.state === "insufficient" || !r.recs.length) {
      return {
        leg_id: r.leg.id, category: r.leg.category, label_ar: r.leg.label_ar, label_en: r.leg.label_en,
        emphasis: r.leg.emphasis, state: "insufficient" as const,
        dropped: r.dropped ?? null,
        note_ar: "بيانات هذه الفئة ضمن قيودك غير كافية حاليًا لتوصية بنفس مستوى الثقة — نفضل قول ذلك بصراحة على تقديم ترشيح غير موثوق.",
        note_en: "Our current evidence within your constraints is not sufficient for a recommendation at our confidence bar — we prefer saying so over an unreliable pick.",
      };
    }
    // Infeasible budget → show the CHEAPEST eligible option per leg, so the cards sum to
    // the `min_total` the shortfall sentence cites (top picks here would contradict it).
    const cheapestRec = [...r.recs].filter((x) => x.unit_price != null).sort((x, y) => x.unit_price! - y.unit_price!)[0];
    const fallbackRec = allocation.feasible ? r.recs[0] : (cheapestRec ?? r.recs[0]);
    const pickedId = a?.picked ?? fallbackRec.canonical_id;
    const picked = r.recs.find((x) => x.canonical_id === pickedId) ?? fallbackRec;
    const alternative = r.recs.find((x) => x.canonical_id !== picked.canonical_id) ?? null;
    const upgradeRec = a?.next_upgrade ? r.recs.find((x) => x.canonical_id === a.next_upgrade!.canonical_id) ?? null : null;
    return {
      leg_id: r.leg.id, category: r.leg.category, label_ar: r.leg.label_ar, label_en: r.leg.label_en,
      emphasis: r.leg.emphasis, state: "ok" as const,
      space: r.leg.space,
      btu_required: r.leg.btu_required, liters_band: r.leg.liters_band, kg_band: r.leg.kg_band,
      picked: recOut(r, picked),
      alternative: alternative ? recOut(r, alternative) : null,
      trade: {
        next_upgrade: a?.next_upgrade && upgradeRec
          ? { extra_cost: a.next_upgrade.extra_cost, title_ar: upgradeRec.title_ar, title_en: upgradeRec.title_en, canonical_id: upgradeRec.canonical_id }
          : null,
        downgrade_saving: a?.downgrade_saving ?? null,
      },
      dropped: r.dropped ?? null,
    };
  });

  // Mission-level honest notes (template-only; every figure below is also DECLARED in the
  // evidence bundle so F7 can verify the sentences that carry it).
  const wantsEfficiency = parse.priorities.includes("low_electricity");
  const bigSpace = parse.spaces.some((s) => (s.area_m2 ?? 0) > 40);
  const partialLegs = legsOut.filter((l) => l.state !== "ok").length;
  const okLegs = legsOut.filter((l) => l.state === "ok").length;

  const missionNotes: { caveats_ar: string[]; caveats_en: string[] } = { caveats_ar: [], caveats_en: [] };
  missionNotes.caveats_ar.push(TOTAL_DISCLOSURE_AR); missionNotes.caveats_en.push(TOTAL_DISCLOSURE_EN);
  if (wantsEfficiency) { missionNotes.caveats_ar.push(EFFICIENCY_ABSTENTION_AR); missionNotes.caveats_en.push(EFFICIENCY_ABSTENTION_EN); }
  if (bigSpace) { missionNotes.caveats_ar.push(AC_PRO_SIZING_AR); missionNotes.caveats_en.push(AC_PRO_SIZING_EN); }
  if (parse.unsupported_mentions.length) {
    missionNotes.caveats_ar.push(`ذكرت: ${parse.unsupported_mentions.join("، ")} — هذه الفئات خارج نطاق التخطيط الموثوق حاليًا، فلم نضفها للخطة.`);
    missionNotes.caveats_en.push(`You mentioned: ${parse.unsupported_mentions.join(", ")} — these categories are outside our evidence bar today, so they were not added to the plan.`);
  }
  if (!allocation.feasible && allocation.shortfall != null && allocation.min_total != null) {
    missionNotes.caveats_ar.push(`ميزانيتك الحالية لا تكفي لأرخص تشكيلة موثقة تلبي القيود — أقل مجموع ممكن ${allocation.min_total} ريال، أي أعلى من ميزانيتك بـ${allocation.shortfall} ريال. يمكن رفع الميزانية أو إسقاط فئة أقل أهمية.`);
    missionNotes.caveats_en.push(`Your current budget cannot cover the cheapest documented set that meets the constraints — the minimum possible total is ${allocation.min_total} SAR, ${allocation.shortfall} SAR above your budget. Raise the budget or drop a lower-priority category.`);
  }

  // ONE clarification, highest-information first (§47): room areas beat budget beats household.
  const needsAreaLeg = legsOut.find((l) => l.state === "needs_area");
  const clarify = needsAreaLeg
    ? { field: "room_area", question_ar: (needsAreaLeg as { question_ar?: string }).question_ar!, question_en: (needsAreaLeg as { question_en?: string }).question_en! }
    : parse.budget_total == null && okLegs > 0
      ? { field: "budget_total", question_ar: "كم ميزانيتك الإجمالية للأجهزة؟ بدونها نعرض الأنسب دون موازنة بين الفئات.", question_en: "What is your total appliance budget? Without it we show best fits without cross-category balancing." }
      : parse.household_size == null && legs.some((l) => l.category === "refrigerator" || l.category === "washing_machine")
        ? { field: "household_size", question_ar: "كم عدد أفراد الأسرة؟ سعة الثلاجة والغسالة المناسبة تعتمد عليه.", question_en: "How many people in the household? The right fridge and washer capacities depend on it." }
        : null;

  // Evidence + F7 guard over every prose sentence the mission renders.
  const allRecsOut = legsOut.flatMap((l) => (l.state === "ok" ? [l.picked, ...(l.alternative ? [l.alternative] : [])] : []));
  const evidence = buildPublishedEvidence({ recommendations: allRecsOut as unknown as Record<string, unknown>[] });
  for (const [label, value] of [
    ["mission.total_allocated", allocation.total_allocated],
    ["mission.remaining", allocation.remaining],
    ["mission.min_total", allocation.min_total],
    ["mission.shortfall", allocation.shortfall],
    ["mission.budget_total", parse.budget_total],
  ] as const) {
    if (typeof value === "number" && Number.isFinite(value)) {
      evidence.figures.push({ value, kind: "price", derivedFrom: "computed", label });
    }
  }
  for (const l of legsOut) {
    if (l.state === "ok") {
      if (l.trade.next_upgrade) evidence.figures.push({ value: l.trade.next_upgrade.extra_cost, kind: "price", derivedFrom: "computed", label: `trade.${l.leg_id}.extra_cost` });
      if (l.trade.downgrade_saving != null) evidence.figures.push({ value: l.trade.downgrade_saving, kind: "price", derivedFrom: "computed", label: `trade.${l.leg_id}.downgrade_saving` });
      if (l.btu_required != null) evidence.figures.push({ value: l.btu_required, kind: "attribute", derivedFrom: "computed", label: `leg.${l.leg_id}.btu_required` });
    }
  }
  const guarded = guardAdvisorPayload(
    { legs: legsOut, mission_notes: missionNotes } as unknown as Record<string, unknown>,
    evidence,
    { query: parse.parsed_from_text || "home-mission", surface: "agent/home-mission", timestamp: new Date().toISOString() },
  );
  if (guarded.withheld.length) {
    console.warn(`[f7-home-mission] withheld ${guarded.withheld.length} sentence(s):`,
      guarded.withheld.map((w) => `${w.path} [${w.ruleIds.join(",")}]`).join(" · "));
  }
  const guardedPayload = guarded.payload as unknown as { legs: typeof legsOut; mission_notes: typeof missionNotes };

  return NextResponse.json({
    version: "v1",
    state: partialLegs && okLegs ? "partial" : okLegs ? "ok" : "insufficient",
    engine: "deterministic",
    neutrality: "ranking-blind (suitability+trust+price; no commission)",
    understood: parse,
    legs: guardedPayload.legs,
    allocation: {
      feasible: allocation.feasible,
      budget_total: parse.budget_total,
      total_allocated: allocation.total_allocated,
      remaining: allocation.remaining,
      min_total: allocation.min_total,
      shortfall: allocation.shortfall,
    },
    mission_notes: guardedPayload.mission_notes,
    clarify,
    evidence,
  });
}
