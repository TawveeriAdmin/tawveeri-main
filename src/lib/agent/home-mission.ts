// src/lib/agent/home-mission.ts
// «جهّز بيتك بذكاء» — HOME MISSION layer (Part B of the Home Decision Intelligence
// mission, gate GO_HOME — see AUDIT_REPORT_HOME.md §19–20).
//
// This is an ORCHESTRATION layer ABOVE the existing One Brain, never a second brain:
// it parses a home description deterministically, derives per-category LEGS, applies
// the HARD eligibility the audit's honesty contract requires (BTU/liters/kg bands,
// freshness, accessory floor), and lets the UNCHANGED `decide()` engine rank inside
// each leg. Budget allocation across legs is plain deterministic arithmetic over the
// engine's own ranked output (basket.ts generalized: per-leg ceilings instead of ÷N).
// NO LLM anywhere in this module (ADR-002). Unknown beats incorrect: fields that
// cannot be extracted stay null and become honest leg states, never guesses.
//
// Honesty contract enforced here (AUDIT_REPORT_HOME §19):
//  1. `comparisonClaim()` — «قارنّا عبر N متاجر» only with ≥2 fresh (≤72h) offers AND
//     model-level identity evidence; otherwise availability wording, never comparison.
//  3. No energy-efficiency ranking: `low_electricity` stays a soft engine priority with
//     the inverter-is-not-an-efficiency-measure disclosure (`efficiencyNote`).
//  4. Totals are DEVICE-ONLY, always accompanied by the installation-unknown line.
//  6. Accessory floor (15%-of-median, mirrors `applyCheapestGate`) on EVERY leg pool.
//  7. Rows older than PICK_FRESHNESS_MAX_HOURS (168h) are not mission-eligible at all.
//  8. Oven and any non-audited category are not mission categories.
import type { CanonicalRow } from "./decision-engine";
import { requiredBtuForRoom } from "./decision-engine";
import { parseShoppingTask } from "./task-parser";
import { PICK_FRESHNESS_MAX_HOURS, STALE_CAVEAT_HOURS } from "@/lib/intelligence/evidence-engine";

// ── Digits: Arabic-Indic → ASCII (same defect class as task-parser's CHECKPOINT #17;
//    kept local so this module stays dependency-light and task-parser stays untouched). ──
const ARABIC_INDIC = /[٠-٩۰-۹]/g;
const asciiDigits = (t: string) =>
  t.replace(ARABIC_INDIC, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
const norm = (t: string) => asciiDigits((t || "").toLowerCase()).replace(/٬/g, "");

/** The four audited GO_HOME categories — the ONLY categories a home mission may plan.
 *  Oven measured NOT pilot-grade (AUDIT_REPORT_HOME §4); anything else is out of scope. */
export const MISSION_CATEGORIES = ["air_conditioner", "refrigerator", "washing_machine", "tv"] as const;
export type MissionCategory = (typeof MISSION_CATEGORIES)[number];

export type CategoryEmphasis = "high" | "normal" | "deprioritized" | "excluded";

export interface HomeSpace {
  key: string;            // stable id within the mission ("space_1")
  label_ar: string;       // «غرفة النوم» / «الصالة» — from the shopper's own words
  label_en: string;
  area_m2: number | null; // null = unknown → the AC leg becomes an honest needs-input state
}

export interface HomeMissionParse {
  spaces: HomeSpace[];
  household_size: number | null;
  budget_total: number | null;
  categories: Partial<Record<MissionCategory, CategoryEmphasis>>;
  priorities: string[];
  deprioritized_priorities: string[];
  excluded_priorities: string[];
  whole_home: boolean;    // generic "جهز بيتي/انتقلت لشقة" signal → default 4 categories
  /** Category words we recognized but honestly cannot plan (e.g. فرن — audit-excluded). */
  unsupported_mentions: string[];
  parsed_from_text: string;
}

// ── Space nouns (Saudi Arabic + English). Order matters: specific before generic. ──
const SPACE_NOUNS: { re: RegExp; ar: string; en: string }[] = [
  { re: /غرف[ةه]?\s*(?:ال)?نوم|master|bedroom/, ar: "غرفة النوم", en: "Bedroom" },
  { re: /غرف[ةه]?\s*(?:ال)?[أا]طفال|kids room|children/, ar: "غرفة الأطفال", en: "Kids room" },
  { re: /صال[ةه]|ليفنج|living/, ar: "الصالة", en: "Living room" },
  { re: /مجلس|majlis/, ar: "المجلس", en: "Majlis" },
  { re: /مطبخ|kitchen/, ar: "المطبخ", en: "Kitchen" },
  { re: /غرف[ةه]|room/, ar: "غرفة", en: "Room" },
];

/** «الصالة 28» / «غرفة النوم 16 متر» / «bedroom 14m²» → (label, area) pairs, in text order. */
function parseSpaces(x: string): HomeSpace[] {
  const spaces: HomeSpace[] = [];
  // One scanning pass: a space noun, optionally followed within a short window by a number
  // (with optional م/متر/م²/m² unit). A bare number elsewhere is NEVER read as an area —
  // the same rule task-parser.ts enforces («تحت 4000» is money, «مكيف 24000» is BTU).
  const noun = /(غرف[ةه]?\s*(?:ال)?(?:نوم|[أا]طفال)?|صال[ةه]|مجلس|مطبخ|bedroom|kids room|living(?: room)?|majlis|kitchen|room)/g;
  let m: RegExpExecArray | null;
  while ((m = noun.exec(x)) !== null) {
    const label = m[1];
    const tail = x.slice(m.index + label.length, m.index + label.length + 26);
    const areaM = tail.match(/^\s*(?:بمساحة|مساحتها|حوالي|تقريبا|=|:)?\s*(\d{1,3})(?:\.\d+)?\s*(?:م²|م2|متر مربع|متر|م\b|m²|m2|sqm|meters?)?/);
    let area: number | null = null;
    if (areaM) {
      const n = Number(areaM[1]);
      // Same sanity bounds as task-parser's room area (5–200 m²); outside = not an area.
      if (Number.isFinite(n) && n >= 5 && n <= 200) area = n;
    }
    const def = SPACE_NOUNS.find((s) => s.re.test(label)) ?? SPACE_NOUNS[SPACE_NOUNS.length - 1];
    spaces.push({ key: `space_${spaces.length + 1}`, label_ar: def.ar, label_en: def.en, area_m2: area });
  }
  // «3 غرف» / «غرفتين» with no per-room areas → that many unknown-area rooms.
  if (!spaces.length) {
    const count = x.match(/(\d)\s*غرف/) || (/(غرفتين|غرفتيْن)/.test(x) ? ([null, "2"] as unknown as RegExpMatchArray) : null);
    if (count) {
      const n = Math.min(6, Math.max(1, Number(count[1])));
      for (let i = 0; i < n; i++) spaces.push({ key: `space_${i + 1}`, label_ar: "غرفة", label_en: "Room", area_m2: null });
    }
  }
  return spaces;
}

/** «أسرتنا 4 أشخاص» / «عائلة من 6» / «5 أفراد» → household size (2–20 sanity bounds). */
function parseHousehold(x: string): number | null {
  const m =
    x.match(/(?:[أا]سرت\w*|عائلت\w*|عائل[ةه]|[أا]سر[ةه])\s*(?:من)?\s*(\d{1,2})/) ||
    x.match(/(\d{1,2})\s*(?:[أا]شخاص|[أا]فراد|persons|people)/) ||
    (/(متزوج|عروس|زواج|newly ?wed)/.test(x) ? ([null, "2"] as unknown as RegExpMatchArray) : null);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= 20 ? n : null;
}

/** Budget incl. Saudi thousand-forms the task-parser's 3–7-digit regex cannot see:
 *  «20 ألف» «ميزانيتي ١٢ الف» «12k». Falls back to parseShoppingTask's own budget. */
function parseBudget(x: string, fallback: number | null | undefined): number | null {
  const k = x.match(/(\d{1,3}(?:\.\d+)?)\s*(?:ألف|الف|آلاف|الاف|k\b)/);
  if (k) {
    const n = Math.round(Number(k[1]) * 1000);
    if (n >= 1000 && n <= 500_000) return n;
  }
  return typeof fallback === "number" && Number.isFinite(fallback) ? fallback : null;
}

const CATEGORY_WORDS: Record<MissionCategory, RegExp> = {
  air_conditioner: /مكيف|تكييف|مكيفات|air ?condition|\bac\b/,
  refrigerator: /ثلاج|براد|refrigerator|fridge/,
  washing_machine: /غسال[ةه]|غسالات|washer|washing/,
  tv: /تلفزيون|تليفزيون|شاش[ةه]|شاشات|television|\btv\b/,
};
// Recognized-but-unplannable words → honest "not covered" note, never a fabricated leg.
const UNSUPPORTED_WORDS: { re: RegExp; label: string }[] = [
  { re: /فرن|[أا]فران|oven/, label: "فرن" },
  { re: /نشاف[ةه](?!.*غسال)/, label: "نشافة" },
  { re: /جلاي[ةه]|غسالة صحون|dishwasher/, label: "غسالة صحون" },
];

const WHOLE_HOME = /جهز\w*\s*(?:لي\s*)?(?:بيت|منزل|شق[ةه]|البيت|المنزل|الشق[ةه])|انتقلت|بيت جديد|شق[ةه] جديد[ةه]|منزل جديد|[أا]ثاث البيت|كل ال[أا]جهز[ةه]|equip my (?:home|house|apartment)/;

/** Category-level polarity: «ما يهمني التلفزيون» → deprioritized; «ما أبي تلفزيون» → excluded;
 *  «أهم شيء المكيفات» → high. Window-scoped so one negation cannot flip the whole mission. */
function categoryEmphasis(x: string, catRe: RegExp): CategoryEmphasis | null {
  const m = catRe.exec(x);
  if (!m) return null;
  // The window must tolerate the attached definite article: the noun regex matches
  // «تلفزيون» inside «التلفزيون», leaving a trailing «ال» in the before-window
  // (measured: «أهم شيء المكيفات» and «ما يهمني التلفزيون» both failed without this).
  // NOTE the project's bilingual-matching invariant: JS `\w`/`\b` do NOT match Arabic
  // letters, so «يهمني»/«شيء» need an explicit Arabic letter class, never \w.
  const before = x.slice(Math.max(0, m.index - 24), m.index).replace(/ال$/, "").trimEnd();
  if (/(ما|لا|مو)\s*([أا]بي|[أا]بغى|[أا]ريد|نبي)$|بدون$|don'?t want$/.test(before)) return "excluded";
  if (/(ما|مو|لا)\s*يهم[؀-ۿ]*$|مو مهم[؀-ۿ]*$|not important$/.test(before)) return "deprioritized";
  if (/([أا]هم شي[؀-ۿ]*|[أا]هم حاج[ةه]|priority)$/.test(before)) return "high";
  return "normal";
}

export function parseHomeMission(text: string): HomeMissionParse {
  const x = norm(text);
  const base = parseShoppingTask(text); // priorities + polarity + (plain-digit) budget — reused, untouched
  const spaces = parseSpaces(x);
  const household = parseHousehold(x);
  const budget = parseBudget(x, base.budget_total ?? null);
  const wholeHome = WHOLE_HOME.test(x);

  const categories: Partial<Record<MissionCategory, CategoryEmphasis>> = {};
  for (const cat of MISSION_CATEGORIES) {
    const emph = categoryEmphasis(x, CATEGORY_WORDS[cat]);
    if (emph) categories[cat] = emph;
  }
  // Generic whole-home ask with no explicit category list → the four audited categories.
  if (wholeHome) for (const cat of MISSION_CATEGORIES) if (!categories[cat]) categories[cat] = "normal";

  const unsupported = UNSUPPORTED_WORDS.filter((u) => u.re.test(x)).map((u) => u.label);

  return {
    spaces,
    household_size: household,
    budget_total: budget,
    categories,
    priorities: base.priorities ?? [],
    deprioritized_priorities: base.deprioritized_priorities ?? [],
    excluded_priorities: base.excluded_priorities ?? [],
    whole_home: wholeHome,
    unsupported_mentions: unsupported,
    parsed_from_text: text,
  };
}

// ── Legs ─────────────────────────────────────────────────────────────────────────

export interface MissionLeg {
  id: string;
  category: MissionCategory;
  emphasis: CategoryEmphasis;      // never "excluded" — excluded categories build no leg
  label_ar: string;
  label_en: string;
  space: HomeSpace | null;         // AC legs only
  /** Hard eligibility bands (audit §52: eligibility is hard; ranking cannot rescue). */
  btu_required: number | null;
  liters_band: [number, number] | null;
  kg_band: [number, number] | null;
  /** The one thing missing that blocks this leg (honest needs-input state, not a guess). */
  needs: "room_area" | null;
}

/** Manufacturer-published bands (AUDIT_REPORT_HOME §12: LG/Samsung capacity guidance),
 *  widened to market granularity. household null → no hard band (never guess). */
export function litersBandFor(household: number | null): [number, number] | null {
  if (household == null) return null;
  if (household <= 2) return [150, 400];
  if (household <= 4) return [350, 600];
  return [450, 900];
}
export function kgBandFor(household: number | null): [number, number] | null {
  if (household == null) return null;
  if (household <= 2) return [6, 8];
  if (household <= 4) return [7, 10];
  return [9, 25];
}

export function buildLegs(parse: HomeMissionParse): MissionLeg[] {
  const legs: MissionLeg[] = [];
  const emph = (c: MissionCategory): CategoryEmphasis => parse.categories[c] ?? "normal";

  if (parse.categories.air_conditioner && parse.categories.air_conditioner !== "excluded") {
    const spaces = parse.spaces.length ? parse.spaces : [{ key: "space_1", label_ar: "الغرفة", label_en: "Room", area_m2: null }];
    for (const s of spaces) {
      // Kitchens get appliances, not their own AC leg, unless they were the only space named.
      if (s.label_ar === "المطبخ" && spaces.length > 1) continue;
      legs.push({
        id: `ac_${s.key}`, category: "air_conditioner", emphasis: emph("air_conditioner"),
        label_ar: `مكيف ${s.label_ar}`, label_en: `AC — ${s.label_en}`, space: s,
        btu_required: s.area_m2 != null ? requiredBtuForRoom(s.area_m2) : null,
        liters_band: null, kg_band: null,
        needs: s.area_m2 == null ? "room_area" : null,
      });
    }
  }
  if (parse.categories.refrigerator && parse.categories.refrigerator !== "excluded") {
    legs.push({
      id: "fridge", category: "refrigerator", emphasis: emph("refrigerator"),
      label_ar: "الثلاجة", label_en: "Refrigerator", space: null,
      btu_required: null, liters_band: litersBandFor(parse.household_size), kg_band: null, needs: null,
    });
  }
  if (parse.categories.washing_machine && parse.categories.washing_machine !== "excluded") {
    legs.push({
      id: "washer", category: "washing_machine", emphasis: emph("washing_machine"),
      label_ar: "الغسالة", label_en: "Washing machine", space: null,
      btu_required: null, liters_band: null, kg_band: kgBandFor(parse.household_size), needs: null,
    });
  }
  if (parse.categories.tv && parse.categories.tv !== "excluded") {
    legs.push({
      id: "tv", category: "tv", emphasis: emph("tv"),
      label_ar: "التلفزيون", label_en: "TV", space: null,
      btu_required: null, liters_band: null, kg_band: null, needs: null,
    });
  }
  return legs;
}

// ── Hard eligibility (audit §19 items 1/5/6/7 + §52) ────────────────────────────

/** TV size from structured attrs or, failing that, the title text (91% recoverable —
 *  AUDIT_REPORT_HOME §11). Returns null when no size is evidenced → NOT eligible:
 *  we never recommend a "TV" we cannot size. */
export function tvSizeOf(row: CanonicalRow): number | null {
  const a = (row.attributes ?? {}) as Record<string, unknown>;
  const structured = Number(a.screen_size);
  if (Number.isFinite(structured) && structured >= 24 && structured <= 120) return structured;
  const text = `${row.display_name_ar ?? ""} ${row.display_name_en ?? ""}`;
  const m = norm(text).match(/(?:^|[^0-9])(32|40|43|48|50|55|58|60|65|70|75|77|85|98|100)\s*(?:بوص[ةه]|انش|إنش|inch|"|-inch)?(?:[^0-9]|$)/);
  return m ? Number(m[1]) : null;
}

export interface EligibilityResult {
  rows: CanonicalRow[];
  dropped: { stale: number; band: number; floor: number; unsized_tv: number };
  /** The 15%-of-median accessory floor actually applied (null when pool <4 priced rows). */
  price_floor: number | null;
}

/** AC oversize allowance: one standard step up is acceptable (disclosed by the engine's
 *  own fit reasons); undersize below the engine's 12% tolerance is a hard NO. */
const AC_BAND = (required: number): [number, number] => [required * 0.88, required * 1.35];

export function eligibleRows(
  leg: MissionLeg,
  rows: CanonicalRow[],
  ageHoursOf: (canonicalId: string) => number | null,
): EligibilityResult {
  const dropped = { stale: 0, band: 0, floor: 0, unsized_tv: 0 };
  let pool = rows.filter((r) => {
    const age = ageHoursOf(r.canonical_id);
    // Unknown age is NOT eligible for a mission plan (stricter than the single-category
    // surface, deliberate: a plan aggregates claims, so each leg's evidence must be dated).
    if (age == null || age > PICK_FRESHNESS_MAX_HOURS) { dropped.stale++; return false; }
    return true;
  });
  if (leg.category === "air_conditioner" && leg.btu_required != null) {
    const [lo, hi] = AC_BAND(leg.btu_required);
    pool = pool.filter((r) => {
      const btu = Number((r.attributes as Record<string, unknown> | null | undefined)?.capacity_btu);
      if (!Number.isFinite(btu) || btu < lo || btu > hi) { dropped.band++; return false; }
      return true;
    });
  }
  if (leg.category === "refrigerator" && leg.liters_band) {
    const [lo, hi] = leg.liters_band;
    pool = pool.filter((r) => {
      const l = Number((r.attributes as Record<string, unknown> | null | undefined)?.capacity_liters);
      if (!Number.isFinite(l) || l < lo || l > hi) { dropped.band++; return false; }
      return true;
    });
  }
  if (leg.category === "washing_machine") {
    if (leg.kg_band) {
      const [lo, hi] = leg.kg_band;
      pool = pool.filter((r) => {
        const kg = Number((r.attributes as Record<string, unknown> | null | undefined)?.capacity_kg);
        if (!Number.isFinite(kg) || kg < lo || kg > hi) { dropped.band++; return false; }
        return true;
      });
    }
  }
  if (leg.category === "tv") {
    pool = pool.filter((r) => {
      if (tvSizeOf(r) == null) { dropped.unsized_tv++; return false; }
      return true;
    });
  }
  // Accessory floor — mirrors decision-engine's applyCheapestGate statistical floor
  // (15% of the candidate-set median, ≥4 priced rows). The audit's Frame-bezel trap
  // (299-SAR "TVs") is exactly what this exists to stop on EVERY mission path, and a
  // hard 500-SAR minimum backstops thin pools for these four major-appliance classes.
  const priced = pool.map((r) => r.lowest_price).filter((p): p is number => p != null && p > 0).sort((a, b) => a - b);
  let floor: number | null = null;
  if (priced.length >= 4) {
    const median = priced[Math.floor(priced.length / 2)];
    floor = Math.max(leg.category === "tv" ? 500 : 0, median * 0.15);
  } else if (leg.category === "tv") {
    floor = 500;
  }
  if (floor != null) {
    pool = pool.filter((r) => {
      if (r.lowest_price != null && r.lowest_price < floor!) { dropped.floor++; return false; }
      return true;
    });
  }
  return { rows: pool, dropped, price_floor: floor };
}

// ── Comparison-claim gate (audit §19 item 1) ─────────────────────────────────────

export type ClaimKind = "compared" | "availability" | "single";

/**
 * What may honestly be said about multi-store evidence for one recommendation.
 *  - "compared":     ≥2 named stores AND evidence ≤72h AND model-level identity
 *                    (identity key carries MODEL:, or a canonical model_number exists).
 *                    The audit's critical mismatches all lived in degraded spec-keys.
 *  - "availability": ≥2 stores but the gate fails → «متوفر لدى N متاجر» (an availability
 *                    statement), NEVER «قارنّا» — comparison is not implied.
 *  - "single":       one store → the audit's mandatory line.
 */
export function comparisonClaim(input: {
  store_names: string[];
  data_age_hours: number | null;
  tps_identity_key: string | null;
  model_number: string | null;
}): ClaimKind {
  const stores = input.store_names.length;
  if (stores < 2) return "single";
  const fresh = input.data_age_hours != null && input.data_age_hours <= STALE_CAVEAT_HOURS;
  const modelEvidence = Boolean(input.model_number) || /\|MODEL:/.test(input.tps_identity_key ?? "");
  const degraded = /NO_SERIES/.test(input.tps_identity_key ?? "") && /NO_TECH/.test(input.tps_identity_key ?? "");
  return fresh && modelEvidence && !degraded ? "compared" : "availability";
}

// ── Budget allocation (audit §15 — deterministic, priority-greedy) ───────────────

export interface LegCandidate {
  canonical_id: string;
  price: number | null;      // the VERIFIED unit price (never the modelled total — same
                             // basis the engine's own budget gate uses)
  rank: number;              // engine suitability order (0 = engine's top pick)
}

export interface LegAllocation {
  leg_id: string;
  picked: string | null;        // canonical_id (null: leg has no eligible candidates)
  ceiling: number | null;       // budget attributed to this leg after allocation
  upgraded_from: string | null; // candidate replaced during the upgrade pass, if any
  /** Next better-ranked candidate we could NOT afford: what +SAR would buy (null: none). */
  next_upgrade: { canonical_id: string; extra_cost: number } | null;
  /** Cheapest eligible candidate: what −SAR gives up (null when picked IS cheapest). */
  downgrade_saving: number | null;
}

export interface AllocationResult {
  feasible: boolean;
  /** When infeasible: the minimum total the mission actually needs (device-only). */
  min_total: number | null;
  shortfall: number | null;
  allocations: LegAllocation[];
  total_allocated: number | null; // sum of picked prices (device-only, null if any leg unpriced)
  remaining: number | null;
}

const EMPHASIS_ORDER: Record<CategoryEmphasis, number> = { high: 0, normal: 1, deprioritized: 2, excluded: 3 };

/**
 * Deterministic shared-budget allocation:
 *  1) every leg gets its CHEAPEST eligible candidate (feasibility floor);
 *  2) infeasible → honest shortfall, no plan fabrication;
 *  3) upgrade passes in emphasis order: move a leg to its best-ranked candidate the
 *     remaining budget affords (engine rank IS suitability — no re-scoring here);
 *  4) record, per leg, what the next +SAR upgrade would be and what the cheapest
 *     downgrade saves — the trade-off sentences render from these figures only.
 * No budget stated → every leg simply takes the engine's top pick (no gate to apply).
 */
export function allocateBudget(
  legs: { leg: MissionLeg; candidates: LegCandidate[] }[],
  budget: number | null,
): AllocationResult {
  const allocations: LegAllocation[] = [];
  const priced = (c: LegCandidate): c is LegCandidate & { price: number } => c.price != null && c.price > 0;

  if (budget == null) {
    for (const { leg, candidates } of legs) {
      const byRank = [...candidates].sort((a, b) => a.rank - b.rank);
      const pick = byRank[0] ?? null;
      const cheapest = candidates.filter(priced).sort((a, b) => a.price - b.price)[0] ?? null;
      allocations.push({
        leg_id: leg.id, picked: pick?.canonical_id ?? null, ceiling: null, upgraded_from: null,
        next_upgrade: null,
        downgrade_saving: pick && cheapest && priced(pick) && cheapest.canonical_id !== pick.canonical_id
          ? Math.max(0, pick.price! - cheapest.price) : null,
      });
    }
    const total = allocations.reduce<number | null>((sum, a) => {
      if (sum == null) return null;
      const c = legs.find((l) => l.leg.id === a.leg_id)!.candidates.find((x) => x.canonical_id === a.picked);
      return c?.price != null ? sum + c.price : null;
    }, 0);
    return { feasible: true, min_total: null, shortfall: null, allocations, total_allocated: total, remaining: null };
  }

  // 1) feasibility floor
  const state = legs.map(({ leg, candidates }) => {
    const pricedC = candidates.filter(priced).sort((a, b) => a.price - b.price);
    return { leg, candidates, cheapest: pricedC[0] ?? null, pick: pricedC[0] ?? null };
  });
  const unpriceable = state.filter((s) => !s.cheapest);
  const minTotal = state.reduce((sum, s) => sum + (s.cheapest?.price ?? 0), 0);
  if (minTotal > budget) {
    return {
      feasible: false, min_total: Math.round(minTotal), shortfall: Math.round(minTotal - budget),
      allocations: state.map((s) => ({
        leg_id: s.leg.id, picked: null, ceiling: null, upgraded_from: null, next_upgrade: null, downgrade_saving: null,
      })),
      total_allocated: null, remaining: null,
    };
  }

  // 2/3) upgrade passes, emphasis order, budget-greedy on engine rank
  let remaining = budget - minTotal;
  const order = [...state].sort((a, b) => EMPHASIS_ORDER[a.leg.emphasis] - EMPHASIS_ORDER[b.leg.emphasis]);
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const s of order) {
      if (!s.pick) continue;
      const byRank = s.candidates.filter(priced).sort((a, b) => a.rank - b.rank);
      const affordable = byRank.find((c) => c.price <= s.pick!.price! + remaining);
      if (affordable && affordable.canonical_id !== s.pick.canonical_id && affordable.rank < s.pick.rank) {
        remaining -= affordable.price - s.pick.price!;
        s.pick = affordable;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 4) trade-off figures
  for (const s of state) {
    const byRank = s.candidates.filter(priced).sort((a, b) => a.rank - b.rank);
    const pick = s.pick;
    const better = pick ? byRank.find((c) => c.rank < pick.rank && c.price > pick.price!) : null;
    allocations.push({
      leg_id: s.leg.id,
      picked: pick?.canonical_id ?? null,
      ceiling: pick?.price != null ? Math.round(pick.price) : null,
      upgraded_from: pick && s.cheapest && pick.canonical_id !== s.cheapest.canonical_id ? s.cheapest.canonical_id : null,
      next_upgrade: better ? { canonical_id: better.canonical_id, extra_cost: Math.round(better.price! - pick!.price!) } : null,
      downgrade_saving: pick && s.cheapest && pick.canonical_id !== s.cheapest.canonical_id
        ? Math.round(pick.price! - s.cheapest.price!) : null,
    });
  }
  const total = state.reduce<number | null>((sum, s) => (sum == null || s.pick?.price == null ? (s.pick ? sum : null) : sum + s.pick.price), 0);
  return {
    feasible: true, min_total: Math.round(minTotal), shortfall: null, allocations,
    total_allocated: total != null ? Math.round(total) : null,
    remaining: Math.round(remaining),
    ...(unpriceable.length ? {} : {}),
  };
}

// ── Honest fixed disclosures (template-only; every figure supplied, none invented) ──

/** Audit §19-4: totals are device prices; installation/delivery is not evidenced. */
export const TOTAL_DISCLOSURE_AR =
  "المجموع أدناه هو مجموع أسعار الأجهزة الموثقة لدينا فقط — تكلفة التركيب والتوصيل غير مثبتة لدينا وغير مشمولة.";
export const TOTAL_DISCLOSURE_EN =
  "The total below is the sum of the documented device prices only — installation and delivery costs are not evidenced and not included.";

/** Audit §19-3: efficiency priorities get the honest abstention, never an inverter proxy. */
export const EFFICIENCY_ABSTENTION_AR =
  "لا نملك بيانات كفاءة الطاقة (بطاقة هيئة المواصفات) لهذه المنتجات، لذلك لا نرتب حسب استهلاك الكهرباء. «إنفرتر» تقنية ضاغط وليست قياسًا للكفاءة.";
export const EFFICIENCY_ABSTENTION_EN =
  "We do not hold energy-efficiency label data (SASO) for these products, so we do not rank by electricity consumption. \"Inverter\" is a compressor technology, not an efficiency measurement.";

/** AC sizing beyond the screening heuristic's defensible range (audit §12). */
export const AC_PRO_SIZING_AR =
  "المساحات الكبيرة (فوق ~40م²) أو المفتوحة تحتاج حساب حمل تبريد مهني — توصيتنا هنا تقديرية أولية فقط.";
export const AC_PRO_SIZING_EN =
  "Large (>~40m²) or open-plan spaces need a professional cooling-load calculation — our guidance here is a preliminary screening estimate only.";
