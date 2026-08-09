// src/lib/agent/decision-engine.ts
// E15.5 — Stage-1 Decision Agent (deterministic core). Takes a SHOPPING TASK (not
// a keyword) and returns an explainable, NEUTRAL, total-cost-aware recommendation
// over the TPS canonical graph + Product DNA. Deterministic engine decides; an LLM
// may later only phrase the reasons (ADR-002). Ranking is RANKING-BLIND: it uses
// suitability + trust (corroboration) + total cost ONLY — never commission.
// Saudi Context First: KSA-hot BTU sizing, total cost incl. installation + est.
// electricity. v1 category: air_conditioner (the flagship journey); the shape is
// category-generic so tv/tablet/etc. plug in later.
import { productTrust, type TrustAssessment } from "@/lib/intelligence/evidence-engine";

export interface ShoppingTask {
  category: string;
  room_size_m2?: number;
  city?: string;
  priorities?: string[]; // e.g. ["quiet","low_electricity","heating"]
  budget_total?: number | null;
  /** Units requested («ابي 3 مكيفات»). ≥2 only; absent means one. The engine prices ONE
   *  unit — callers divide the total budget before handing it in (see decide route). */
  quantity?: number | null;
}

export interface CanonicalRow {
  canonical_id: string; tps_identity_key: string;
  display_name_ar: string | null; display_name_en: string | null;
  brand: string | null; category: string | null; image_url: string | null;
  lowest_price: number | null; store_count: number | null; has_comparison: boolean | null;
  identity_confidence: number | null; attributes?: Record<string, unknown> | null;
}

export interface ProductDNA {
  brand: string | null;
  capacity_btu: number | null;
  inverter: boolean | null;
  cooling_mode: string | null;       // cool_only | hot_cold
  ac_type: string | null;
  recommended_room_m2: number | null; // derived, KSA-hot
  energy_efficiency: "high" | "standard" | null;
  installation_class: string | null;
}

/**
 * WHAT KIND OF STATEMENT A REASON IS (ADR-187 · REDESIGN_BRIEF §8).
 *
 * §8: *"Distinguish fact from inference from recommendation. Never invent a spec."* Every
 * reason used to be a bare string, and the surface rendered all of them behind an identical
 * green check — so «متوفر ومُقارَن في 3 متاجر» (measured, checkable) and «التكلفة الإجمالية
 * التقديرية ~6643 ريال» (a MODEL: installation and annual electricity are estimated, never
 * observed) were presented to the shopper as the same class of claim.
 *
 * The kind is declared where the reason is WRITTEN, by the scorer that knows what it just
 * asserted. It is never inferred downstream by scanning our own prose — that would be
 * re-deriving something we already knew, and it would drift the moment a sentence is reworded.
 */
export type ReasonKind =
  | "identity"  // what the product IS — brand/line/capacity. The card title already says it.
  | "fit"       // how it matches the need the SHOPPER stated. An inference we drew.
  | "spec"      // a measured product fact, independent of the request.
  | "evidence"  // what OUR observations show — corroboration across retailers. Measured.
  | "estimate"  // a MODELLED figure: total cost of ownership, annual electricity.
  | "caution";  // works against the stated need, or a fact we could not establish.

/**
 * Reasons and their kinds, written together so they cannot come apart.
 *
 * The scorers previously held `const reasons: string[] = []`. Replacing the array with this
 * ledger is deliberate: it makes the compiler — not a reviewer — require every one of the 68
 * sites that states a reason to also say what kind of statement it is. There is no partially
 * classified state to leak.
 */
export class ReasonLedger {
  readonly texts: string[] = [];
  readonly kinds: ReasonKind[] = [];
  add(kind: ReasonKind, text: string): void { this.texts.push(text); this.kinds.push(kind); }
  /** Put a reason FIRST (what `reasons.unshift` used to do for the identity line). */
  lead(kind: ReasonKind, text: string): void { this.texts.unshift(text); this.kinds.unshift(kind); }
  identity(t: string) { this.lead("identity", t); }
  fit(t: string) { this.add("fit", t); }
  spec(t: string) { this.add("spec", t); }
  evidence(t: string) { this.add("evidence", t); }
  estimate(t: string) { this.add("estimate", t); }
  caution(t: string) { this.add("caution", t); }
}

/**
 * THE AT-MOST-TWO SENTENCES THE CARD SHOWS (ADR-187 · REDESIGN_BRIEF §8).
 *
 * §8: *"Two sentences of reasoning, maximum."* The founder's verdict on the previous agent was
 * «كثير ومشتته» — too much, and scattered. The engine still produces its full cited list (the
 * evidence panel and the F7 validator both read it); this chooses which two the shopper reads
 * first, and the CHOICE belongs to the engine, never to the view (the ADR-163 rule).
 *
 * Two kinds are excluded because the card ALREADY states them elsewhere, and stating them twice
 * is the scattering §8 objects to:
 *   · `identity` — the card title is the product name.
 *   · `evidence` — `TrustSummary` renders corroboration as the card's evidence line.
 *
 * A caution outranks a positive: if something works against what the shopper asked for, that is
 * the sentence they need, not the best thing we can say.
 */
export function pickHeadlineReasons(kinds: ReasonKind[]): number[] {
  const of = (k: ReasonKind) => kinds.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0);
  const ordered = [...of("caution"), ...of("fit"), ...of("spec"), ...of("estimate")];
  return ordered.slice(0, 2);
}

export interface Recommendation {
  canonical_id: string; tps_identity_key: string;
  title_ar: string | null; title_en: string | null; brand: string | null;
  unit_price: number | null;
  total_cost_estimate: number | null; // unit + install + est. annual electricity
  cost_breakdown: { unit: number | null; installation: number | null; annual_electricity: number | null };
  store_count: number | null; comparison_available: boolean;
  suitability_score: number;          // 0..1 deterministic
  confidence: number;                 // 0..100 — now the evidence-grounded Trust score
  trust: TrustAssessment;             // transparent, cited trust breakdown (ADR-087)
  is_smart_pick: boolean;
  reasons_ar: string[];
  /** Same length and order as `reasons_ar` — what kind of claim each one is (ADR-187). */
  reason_kinds: ReasonKind[];
  /** Indices into `reasons_ar`; at most two. The sentences the card leads with (ADR-187). */
  headline_reasons: number[];
  dna: Record<string, unknown>;       // category-specific Product DNA (AC/TV/tablet/…)
  go_offer_hint: string;              // canonical_id; the route attaches the measured-exit go_url
}

// ── KSA-hot BTU sizing: hotter climate needs more BTU/m² than temperate tables. ──
export function requiredBtuForRoom(roomM2: number): number {
  const perM2 = 700; // KSA-hot heuristic (temperate ~500); conservative for Riyadh summers
  const raw = Math.max(18000, roomM2 * perM2);
  const standards = [18000, 24000, 30000, 36000, 48000, 60000];
  // round UP to the nearest standard capacity (never undersize in KSA heat)
  return standards.find((s) => s >= raw) ?? standards[standards.length - 1];
}

// ── Derive Product DNA (AC) deterministically from canonical attributes. ──
export function deriveAcDna(row: CanonicalRow): ProductDNA {
  const a = row.attributes ?? {};
  const btu = typeof a.capacity_btu === "number" ? a.capacity_btu : (a.capacity_btu ? Number(a.capacity_btu) : null);
  const tech = (a.technology as string) ?? null;
  const inverter = tech ? /inverter/i.test(tech) : null;
  return {
    brand: row.brand,
    capacity_btu: btu,
    inverter,
    cooling_mode: (a.cooling_mode as string) ?? null,
    ac_type: (a.ac_type as string) ?? null,
    recommended_room_m2: btu ? Math.round(btu / 700) : null, // inverse of the sizing heuristic
    energy_efficiency: inverter == null ? null : inverter ? "high" : "standard",
    installation_class: (a.ac_type as string) === "split" ? "split_professional" : "standard",
  };
}

// ── Total cost of ownership (Saudi Context): unit + installation + est. annual electricity. ──
function estimateTotalCost(unit: number | null, dna: ProductDNA): Recommendation["cost_breakdown"] & { total: number | null } {
  if (unit == null) return { unit: null, installation: null, annual_electricity: null, total: null };
  const installation = dna.installation_class === "split_professional" ? 350 : 0; // SAR, typical split install
  // Rough annual electricity: BTU→kW (÷3412) × ~1800 cooling h/yr × 0.18 SAR/kWh, inverter ~30% less.
  const kw = dna.capacity_btu ? dna.capacity_btu / 3412 : 2.5;
  const base = kw * 1800 * 0.18;
  const annual_electricity = Math.round(base * (dna.inverter ? 0.7 : 1));
  return { unit, installation, annual_electricity, total: Math.round(unit + installation + annual_electricity) };
}

// ── Deterministic AC decision. Returns ranked recommendations. RANKING-BLIND. ──
// Shared with the decide route (2026-08-09, founder AC Smart Pick audit): the SAME bar
// decideAc's own reason text uses for "مناسب/تطابق المطلوب" vs "⚠️ أقل من المطلوب" must be
// the one thing that decides whether the route discloses "no candidate fully reaches the
// recommended capacity" — a second, independently-chosen threshold could disagree with the
// reason text on the very same candidate, which is worse than not having the disclosure.
export const AC_BTU_FIT_TOLERANCE = 0.12;

export function decideAc(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const wantsQuiet = (task.priorities ?? []).includes("quiet");
  const wantsLowElec = (task.priorities ?? []).includes("low_electricity");
  const wantsHeating = (task.priorities ?? []).includes("heating");
  const requiredBtu = task.room_size_m2 ? requiredBtuForRoom(task.room_size_m2) : null;

  const scored = rows.map((row) => {
    const dna = deriveAcDna(row);
    const reasons = new ReasonLedger();
    let score = 0.5; // neutral base

    // 1. BTU fit (the dominant suitability signal for AC)
    if (requiredBtu && dna.capacity_btu) {
      const rel = Math.abs(dna.capacity_btu - requiredBtu) / requiredBtu;
      const fit = Math.max(0, 1 - rel * 1.5); // penalize mis-size
      score += (fit - 0.5) * 0.5;
      if (rel <= AC_BTU_FIT_TOLERANCE) reasons.fit(`مناسب لغرفة ~${task.room_size_m2}م² (السعة ${dna.capacity_btu} وحدة تطابق المطلوب)`);
      else if (dna.capacity_btu < requiredBtu) reasons.caution(`⚠️ السعة ${dna.capacity_btu} أقل من المطلوب (~${requiredBtu} وحدة) لغرفة ${task.room_size_m2}م²`);
      else reasons.fit(`السعة ${dna.capacity_btu} وحدة (أكبر من ~${requiredBtu} المطلوب — تبريد أسرع، استهلاك أعلى)`);
    }
    // 2. Inverter for low electricity
    if (dna.inverter) { score += wantsLowElec ? 0.18 : 0.06; if (wantsLowElec) reasons.fit("إنفرتر — أوفر في فاتورة الكهرباء (أولويتك)"); else reasons.spec("إنفرتر — كفاءة أعلى في الكهرباء"); }
    else if (wantsLowElec) { score -= 0.1; reasons.caution("عادي (غير إنفرتر) — استهلاك كهرباء أعلى"); }
    // 2b. Quiet operation — CATEGORY DECISION CONTRACT (Section 9): noise level (dB) is not
    // extracted anywhere in the pipeline (`category-contracts.ts`'s AC contract marks
    // `noise_level_db` 'unknown'). `wantsQuiet` used to be parsed and then silently dropped —
    // never scored, never disclosed — which is a softer failure than fabricating a claim, but
    // still leaves the shopper unaware their stated priority could not be acted on. Disclosed
    // honestly instead, never scored (no data to score on; unknown must never read as either
    // a positive or a violation).
    if (wantsQuiet) reasons.caution("⚠️ لا تتوفر لدينا بيانات مستوى الضجيج (ديسيبل) لهذا المنتج حاليًا");
    // 3. Cooling mode fit
    if (wantsHeating && dna.cooling_mode === "hot_cold") { score += 0.08; reasons.fit("حار وبارد — يدفّئ شتاءً"); }
    if (!wantsHeating && dna.cooling_mode === "cool_only") { reasons.spec("بارد فقط — مناسب لأغلب أجواء المملكة"); }
    // 4. Trust: cross-store corroboration
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.evidence(`سعر موثوق — متوفر ومُقارَن في ${row.store_count} متاجر`); }
    else reasons.evidence("متوفر في متجر واحد — المقارنة غير متاحة");

    const cost = estimateTotalCost(row.lowest_price, dna);
    // 5. Total cost within budget (suitability, not commission). ESTIMATE, not a measurement:
    //    installation and annual electricity are modelled from KSA heuristics (ADR-187).
    if (task.budget_total && cost.total) {
      if (cost.total <= task.budget_total) { score += 0.06; reasons.estimate(`ضمن ميزانيتك — التكلفة الإجمالية ~${cost.total} ريال`); }
      else { score -= 0.12; reasons.caution(`أعلى من ميزانيتك — التكلفة الإجمالية ~${cost.total} ريال`); }
    } else if (cost.total) {
      reasons.estimate(`التكلفة الإجمالية التقديرية ~${cost.total} ريال (الجهاز ${cost.unit} + تركيب ${cost.installation} + كهرباء سنوية ~${cost.annual_electricity})`);
    }

    const confidence = Math.min(95, Math.round(((row.identity_confidence ?? 70) + (row.store_count ?? 0) * 8) / 1.2));
    score = Math.max(0, Math.min(1, score));
    return { row, dna, score, reasons, cost, confidence };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, i): Recommendation => {
    const trust = baseTrust(s.row);
    return {
      canonical_id: s.row.canonical_id, tps_identity_key: s.row.tps_identity_key,
      title_ar: s.row.display_name_ar, title_en: s.row.display_name_en, brand: s.row.brand,
      unit_price: s.row.lowest_price,
      total_cost_estimate: s.cost.total,
      cost_breakdown: { unit: s.cost.unit, installation: s.cost.installation, annual_electricity: s.cost.annual_electricity },
      store_count: s.row.store_count, comparison_available: !!s.row.has_comparison,
      suitability_score: Math.round(s.score * 100) / 100, confidence: trust.score, trust,
      is_smart_pick: i === 0,
      reasons_ar: s.reasons.texts,
      reason_kinds: s.reasons.kinds,
      headline_reasons: pickHeadlineReasons(s.reasons.kinds),
      dna: s.dna as unknown as Record<string, unknown>,
      go_offer_hint: s.row.canonical_id,
    };
  });
}

// ── Shared assembly: turn scored rows into ranked Recommendations. ──
/**
 * Base trust from the projection signals available at ranking time (corroboration,
 * identity precision, unspecified-spec detection). The decide route ENRICHES this with
 * price-history/freshness/discount evidence when it attaches price intelligence. The
 * sentinel check flags a price-determining spec left unstated (mobile NO_STORAGE etc.).
 */
export function baseTrust(row: CanonicalRow): TrustAssessment {
  return productTrust({
    store_count: row.store_count,
    identity_confidence: row.identity_confidence,
    has_comparison: row.has_comparison,
    tps_identity_key: row.tps_identity_key,
  });
}

function assemble(scored: { row: CanonicalRow; dna: Record<string, unknown>; score: number; reasons: ReasonLedger; total: number | null; breakdown: Recommendation["cost_breakdown"] }[]): Recommendation[] {
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, i): Recommendation => {
    const trust = baseTrust(s.row);
    return {
      canonical_id: s.row.canonical_id, tps_identity_key: s.row.tps_identity_key,
      title_ar: s.row.display_name_ar, title_en: s.row.display_name_en, brand: s.row.brand,
      unit_price: s.row.lowest_price, total_cost_estimate: s.total, cost_breakdown: s.breakdown,
      store_count: s.row.store_count, comparison_available: !!s.row.has_comparison,
      suitability_score: Math.round(Math.max(0, Math.min(1, s.score)) * 100) / 100,
      confidence: trust.score, trust,
      is_smart_pick: i === 0,
      reasons_ar: s.reasons.texts,
      reason_kinds: s.reasons.kinds,
      headline_reasons: pickHeadlineReasons(s.reasons.kinds),
      dna: s.dna, go_offer_hint: s.row.canonical_id,
    };
  });
}

// ── TV: derive DNA + decide. Suitability = use-fit (gaming→refresh, movies→panel,
//    sports→refresh+size) + size + trust + budget. Ranking-blind. ──
const PANEL_QUALITY: Record<string, number> = { oled: 1.0, neo_qled: 0.9, qled: 0.8, qned: 0.75, nanocell: 0.7, mini_led: 0.85, crystal: 0.6, led: 0.5 };
export function deriveTvDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  return { brand: row.brand, screen_size: a.screen_size ?? null, resolution: a.resolution ?? null,
    panel: a.panel ?? null, refresh_rate: a.refresh_rate ?? null,
    gaming_ready: typeof a.refresh_rate === "number" ? a.refresh_rate >= 120 : null,
    movie_quality: a.panel ? (PANEL_QUALITY[String(a.panel)] ?? 0.5) >= 0.8 : null };
}
export function decideTv(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const pr = task.priorities ?? [];
  const wantGaming = pr.includes("gaming"), wantMovies = pr.includes("movies"), wantSports = pr.includes("sports"), wantBright = pr.includes("bright_room");
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveTvDna(row); const reasons = new ReasonLedger();
    let score = 0.5;
    const rr = typeof a.refresh_rate === "number" ? a.refresh_rate : null;
    const pq = a.panel ? (PANEL_QUALITY[String(a.panel)] ?? 0.5) : null;
    if ((wantGaming || wantSports) && rr != null) { if (rr >= 120) { score += 0.18; reasons.fit(`معدل تحديث ${rr}Hz — ممتاز للألعاب/الرياضة`); } else { score -= 0.05; reasons.caution(`معدل تحديث ${rr}Hz — منخفض للألعاب`); } }
    if (wantMovies && pq != null) { score += (pq - 0.5) * 0.4; if (pq >= 0.8) reasons.fit(`شاشة ${a.panel} — جودة عالية للأفلام`); else reasons.caution(`شاشة ${a.panel} — جودة متوسطة`); }
    if (wantBright && pq != null && pq >= 0.8) { score += 0.06; reasons.fit(`لوحة ${a.panel} — سطوع جيد للغرف المضيئة`); }
    if (a.resolution === "4k" || a.resolution === "8k") { score += 0.04; reasons.spec(`دقة ${String(a.resolution).toUpperCase()}`); }
    if (typeof a.screen_size === "number") reasons.spec(`${a.screen_size} بوصة`);
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.evidence(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.evidence("متوفر في متجر واحد");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.fit(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.caution(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Tablet: derive DNA + decide. Suitability = use-fit + connectivity + storage +
//    size + trust + budget. Ranking-blind. ──
export function deriveTabletDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  return { brand: row.brand, line: a.line ?? null, storage: a.storage ?? null,
    connectivity: a.connectivity ?? null, screen_size: a.screen_size ?? null,
    cellular: a.connectivity ? a.connectivity !== "wifi" : null };
}
export function decideTablet(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const t = task as ShoppingTask & { use?: string[]; connectivity_needed?: string; storage_min?: number };
  const use = t.use ?? task.priorities ?? [];
  const wantProductivity = use.includes("productivity"), wantReading = use.includes("reading"), wantGaming = use.includes("gaming");
  const needCell = t.connectivity_needed && t.connectivity_needed !== "wifi";
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveTabletDna(row); const reasons = new ReasonLedger();
    let score = 0.5;
    const storage = typeof a.storage === "number" ? a.storage : null;
    const size = typeof a.screen_size === "number" ? a.screen_size : null;
    const conn = a.connectivity as string | null;
    if (needCell) { if (conn && conn !== "wifi") { score += 0.15; reasons.fit(`اتصال ${conn.toUpperCase()} — يدعم الشريحة`); } else { score -= 0.15; reasons.caution("واي فاي فقط — لا يدعم الشريحة (تحتاج خلوي)"); } }
    else if (conn) reasons.spec(conn === "wifi" ? "واي فاي" : `${conn.toUpperCase()}`);
    if (t.storage_min && storage != null) { if (storage >= t.storage_min) { score += 0.1; reasons.fit(`تخزين ${storage}GB (يكفي)`); } else { score -= 0.12; reasons.caution(`⚠️ تخزين ${storage}GB أقل من المطلوب (${t.storage_min}GB)`); } }
    else if (storage != null) reasons.spec(`تخزين ${storage}GB`);
    if (wantProductivity && size != null) { if (size >= 11) { score += 0.1; reasons.fit(`شاشة ${size}" — مناسبة للإنتاجية`); } else reasons.caution(`شاشة ${size}" — صغيرة للإنتاجية`); }
    if (wantReading && size != null && size <= 11) { score += 0.05; reasons.fit(`شاشة ${size}" — خفيفة للقراءة`); }
    if (wantGaming && storage != null && storage >= 128) { score += 0.06; reasons.fit(`تخزين ${storage}GB — مناسب للألعاب`); }
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.evidence(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.evidence("متوفر في متجر واحد");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.fit(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.caution(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Mobile: derive DNA + decide. Suitability = variant tier (camera/battery),
//    generation recency, storage fit, trust, budget. Ranking-blind. ──
const VARIANT_TIER: Record<string, number> = { "ultra": 1.0, "pro max": 1.0, "pro": 0.85, "plus": 0.7, "fe": 0.6, "standard": 0.5 };
function variantTier(v: unknown): number { const s = String(v ?? "standard").toLowerCase(); return VARIANT_TIER[s] ?? 0.5; }
function genNumber(g: unknown): number | null { const m = String(g ?? "").match(/(\d{1,3})/); return m ? Number(m[1]) : null; }
export function deriveMobileDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  return { brand: row.brand, family: a.family ?? null, generation: a.generation ?? null,
    variant: a.variant ?? null, storage: a.storage != null ? Number(a.storage) : null,
    ram: Array.isArray(a.ram_values) && a.ram_values.length ? a.ram_values[0] : null };
}
export function decideMobile(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const t = task as ShoppingTask & { storage_min?: number };
  const pr = task.priorities ?? [];
  const wantCamera = pr.includes("camera"), wantGaming = pr.includes("gaming"), wantBattery = pr.includes("battery"), wantLatest = pr.includes("latest");
  const maxGen = Math.max(0, ...rows.map((r) => genNumber((r.attributes ?? {}).generation) ?? 0));
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveMobileDna(row); const reasons = new ReasonLedger();
    let score = 0.5;
    const tier = variantTier(a.variant); const storage = a.storage != null ? Number(a.storage) : null; const gen = genNumber(a.generation);
    if (wantCamera) { score += (tier - 0.5) * 0.3; if (tier >= 0.85) reasons.fit(`إصدار ${a.variant} — كاميرا أفضل`); }
    if (wantGaming) { score += (tier - 0.5) * 0.2; if (storage && storage >= 256) { score += 0.05; reasons.fit(`تخزين ${storage}GB — مناسب للألعاب`); } }
    if (wantBattery && /ultra|pro max|plus/i.test(String(a.variant))) { score += 0.08; reasons.fit(`إصدار ${a.variant} — بطارية أكبر`); }
    if (wantLatest && gen != null && maxGen > 0) { const rec = gen / maxGen; score += (rec - 0.5) * 0.3; if (gen === maxGen) reasons.fit(`الجيل ${gen} — الأحدث`); }
    if (t.storage_min && storage != null) { if (storage >= t.storage_min) { score += 0.08; reasons.fit(`تخزين ${storage}GB (يكفي)`); } else { score -= 0.12; reasons.caution(`⚠️ تخزين ${storage}GB أقل من المطلوب (${t.storage_min}GB)`); } }
    else if (storage != null) reasons.spec(`تخزين ${storage}GB`);
    // ADR-081: storage-unspecified (NO_STORAGE canonical) — be explicit and cautious.
    // The price may reflect different storage configurations across merchants, so
    // this card must never win purely on a lower price, and if the shopper asked
    // for a minimum storage we cannot confirm it. Neutrality + explainability.
    else {
      score -= 0.04;
      reasons.caution("⚠️ السعة التخزينية غير محددة في هذه العروض — قد تختلف بين المتاجر");
      if (t.storage_min) { score -= 0.06; reasons.caution(`⚠️ لا يمكن تأكيد ${t.storage_min}GB المطلوبة`); }
    }
    reasons.identity(`${a.family ?? row.brand} ${a.generation ?? ""} ${a.variant && a.variant !== "Standard" ? a.variant : ""}`.replace(/\s+/g, " ").trim());
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.evidence(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.evidence("متوفر في متجر واحد");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.fit(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.caution(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Laptop: derive DNA + decide. Suitability = use-fit (gaming→discrete GPU+RAM,
//    productivity→RAM+CPU, portability→screen), storage, trust, budget. Ranking-blind.
//    Note: laptops are structurally single-store in KSA (ADR-032) — most results are
//    resolved-single (comparison_available:false), surfaced honestly. ──
export function deriveLaptopDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  const gpu = (a.gpu as string) ?? null;
  return { brand: row.brand, family: a.family ?? null, cpu: a.cpu ?? null,
    ram: a.ram != null ? Number(a.ram) : null, storage: a.storage != null ? Number(a.storage) : null,
    screen: a.screen != null ? Number(a.screen) : null, gpu,
    discrete_gpu: gpu ? gpu !== "igpu" : null };
}
export function decideLaptop(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const t = task as ShoppingTask & { storage_min?: number; ram_min?: number };
  const pr = task.priorities ?? [];
  const wantGaming = pr.includes("gaming"), wantProductivity = pr.includes("productivity"), wantPortability = pr.includes("portability");
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveLaptopDna(row); const reasons = new ReasonLedger();
    let score = 0.5;
    const ram = a.ram != null ? Number(a.ram) : null; const storage = a.storage != null ? Number(a.storage) : null;
    const screen = a.screen != null ? Number(a.screen) : null; const gpu = (a.gpu as string) ?? null; const discrete = gpu ? gpu !== "igpu" : false;
    if (wantGaming) { if (discrete) { score += 0.15; reasons.fit(`كرت شاشة منفصل (${gpu?.toUpperCase()}) — مناسب للألعاب`); } else { score -= 0.08; reasons.caution("كرت مدمج — ضعيف للألعاب"); } if (ram && ram >= 16) { score += 0.06; reasons.spec(`رام ${ram}GB`); } }
    if (wantProductivity) { if (ram && ram >= 16) { score += 0.1; reasons.fit(`رام ${ram}GB — مناسب للإنتاجية`); } else if (ram) reasons.caution(`رام ${ram}GB — متوسط للإنتاجية`); if (a.cpu) reasons.spec(`معالج ${String(a.cpu).toUpperCase()}`); }
    // PORTABILITY (Category Decision Contract, Section 9's own worked example): no laptop
    // weight is extracted anywhere in the pipeline (see category-contracts.ts's `laptop`
    // contract — `weight` is 'unknown'). Screen size is a REAL attribute and a genuine,
    // named correlate of portability, but it is NOT weight — a small-screen laptop is not
    // guaranteed to be light. "خفيف" (light) must never be asserted as a bare fact; the
    // reason states exactly what IS known (screen size) and says the weight itself is
    // unconfirmed, every time this signal fires.
    if (wantPortability && screen != null) {
      if (screen <= 14) { score += 0.08; reasons.fit(`شاشة ${screen}" صغيرة — أسهل للحمل عادةً (الوزن الفعلي غير مؤكد في بياناتنا)`); }
      else { reasons.caution(`شاشة ${screen}" أكبر — عادةً أصعب للحمل (الوزن الفعلي غير مؤكد في بياناتنا)`); }
    }
    if (t.ram_min && ram != null) { if (ram >= t.ram_min) score += 0.06; else { score -= 0.1; reasons.caution(`⚠️ رام ${ram}GB أقل من المطلوب (${t.ram_min}GB)`); } }
    if (t.storage_min && storage != null && storage < t.storage_min) { score -= 0.08; reasons.caution(`⚠️ تخزين ${storage}GB أقل من المطلوب`); }
    else if (storage != null) reasons.spec(`تخزين ${storage}GB`);
    reasons.identity(`${row.brand ?? ""} ${a.family ?? ""} ${a.cpu ? String(a.cpu).toUpperCase() : ""}`.replace(/\s+/g, " ").trim());
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.evidence(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.evidence("متوفر في متجر واحد — المقارنة غير متاحة");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.fit(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.caution(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Refrigerator: derive DNA + decide. Runs 24/7 → electricity is a real TCO signal
//    (inverter matters). Suitability = capacity-for-household + efficiency + type +
//    trust + total cost (unit + est. annual electricity). Ranking-blind. Appliances
//    are structurally single-store in KSA (Extra-dominant) — surfaced honestly. ──
export function deriveRefrigeratorDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  const liters = a.capacity_liters != null ? Number(a.capacity_liters) : null;
  return { brand: row.brand, fridge_type: a.fridge_type ?? null, capacity_liters: liters,
    inverter: a.inverter === true ? true : a.inverter === false ? false : null,
    energy_efficiency: a.inverter == null ? null : a.inverter ? "high" : "standard" };
}
// Fridge annual electricity (rough, KSA tariff): base + capacity term, inverter ~30% less.
function fridgeAnnualElectricity(liters: number | null, inverter: boolean | null): number {
  const kwh = 200 + (liters ?? 350) * 0.4; // heuristic kWh/yr
  return Math.round(kwh * 0.18 * (inverter ? 0.7 : 1)); // 0.18 SAR/kWh
}
export function decideRefrigerator(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const pr = task.priorities ?? [];
  const wantLowElec = pr.includes("low_electricity"), wantLarge = pr.includes("large") || /كبير|عائلة|large|family/.test((task as { parsed_from_text?: string }).parsed_from_text ?? "");
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveRefrigeratorDna(row); const reasons = new ReasonLedger();
    let score = 0.5;
    const liters = a.capacity_liters != null ? Number(a.capacity_liters) : null;
    const inverter = a.inverter === true; const type = (a.fridge_type as string) ?? null;
    if (liters != null) { reasons.identity(`${row.brand ?? ""} ${type ? type.replace(/_/g, " ") : ""} ${liters} لتر`.replace(/\s+/g, " ").trim()); if (wantLarge) { if (liters >= 500) { score += 0.12; reasons.fit(`سعة ${liters} لتر — واسعة للعائلات`); } else reasons.caution(`سعة ${liters} لتر — متوسطة`); } }
    if (inverter) { score += wantLowElec ? 0.15 : 0.05; if (wantLowElec) reasons.fit("إنفرتر — أوفر في الكهرباء (يعمل ٢٤ ساعة)"); else reasons.spec("إنفرتر — كفاءة أعلى"); }
    else if (wantLowElec) { score -= 0.08; reasons.caution("عادي (غير إنفرتر) — استهلاك أعلى على مدار الساعة"); }
    if (type === "french_door" || type === "side_by_side") reasons.spec(`${type.replace(/_/g, " ")} — تصميم واسع`);
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.evidence(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.evidence("متوفر في متجر واحد — المقارنة غير متاحة");
    const unit = row.lowest_price; const annual = fridgeAnnualElectricity(liters, inverter);
    const total = unit != null ? Math.round(unit + annual) : null;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.estimate(`ضمن ميزانيتك — التكلفة ~${total} ريال (الجهاز ${unit} + كهرباء سنوية ~${annual})`); } else { score -= 0.12; reasons.caution(`أعلى من ميزانيتك — التكلفة ~${total} ريال`); } }
    else if (total) reasons.estimate(`التكلفة التقديرية ~${total} ريال (الجهاز ${unit} + كهرباء سنوية ~${annual})`);
    return { row, dna, score, reasons, total, breakdown: { unit: unit ?? null, installation: null, annual_electricity: annual } };
  });
  return assemble(scored);
}

// ── Washing machine: derive DNA + decide. Suitability = capacity-for-household +
//    efficiency (front-load + inverter) + dryer combo + trust + budget. Ranking-blind.
export function deriveWashingMachineDna(row: CanonicalRow): Record<string, unknown> {
  const a = row.attributes ?? {};
  return { brand: row.brand, washer_type: a.washer_type ?? null,
    capacity_kg: a.capacity_kg != null ? Number(a.capacity_kg) : null,
    has_dryer: a.has_dryer === true, inverter: a.inverter === true ? true : a.inverter === false ? false : null };
}
export function decideWashingMachine(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const pr = task.priorities ?? []; const text = (task as { parsed_from_text?: string }).parsed_from_text ?? "";
  const wantLowElec = pr.includes("low_electricity"), wantQuiet = pr.includes("quiet");
  const wantLarge = /كبير|عائلة|large|family/.test(text), wantDryer = /نشاف|نشافة|dryer|تجفيف/.test(text);
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const dna = deriveWashingMachineDna(row); const reasons = new ReasonLedger();
    let score = 0.5;
    const kg = a.capacity_kg != null ? Number(a.capacity_kg) : null; const type = (a.washer_type as string) ?? null;
    const inverter = a.inverter === true; const combo = a.has_dryer === true;
    reasons.identity(`${row.brand ?? ""} ${type ? type.replace(/_/g, " ") : ""} ${kg != null ? kg + " كجم" : ""}`.replace(/\s+/g, " ").trim());
    if (kg != null && wantLarge) { if (kg >= 10) { score += 0.1; reasons.fit(`سعة ${kg} كجم — مناسبة للعائلات`); } else reasons.caution(`سعة ${kg} كجم — متوسطة`); }
    if (type === "front_load") { score += 0.06; reasons.spec("تحميل أمامي — غسيل أعمق وأوفر ماءً"); }
    if (inverter) { score += (wantLowElec || wantQuiet) ? 0.12 : 0.05; if (wantLowElec || wantQuiet) reasons.fit("محرك إنفرتر — أهدأ وأوفر (أولويتك)"); else reasons.spec("محرك إنفرتر — كفاءة أعلى"); }
    else if (wantLowElec) { score -= 0.06; reasons.caution("عادي (غير إنفرتر) — استهلاك أعلى"); }
    if (combo) { score += wantDryer ? 0.1 : 0.03; if (wantDryer) reasons.fit("غسالة ونشافة — تغسل وتجفف (أولويتك)"); else reasons.spec("غسالة ونشافة مدمجة"); }
    else if (wantDryer) { score -= 0.08; reasons.caution("غسالة فقط — بدون نشافة"); }
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.evidence(`سعر موثوق — متوفر في ${row.store_count} متاجر`); } else reasons.evidence("متوفر في متجر واحد — المقارنة غير متاحة");
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.fit(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.caution(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Generic appliance decider (config-driven, deterministic, ranking-blind). Covers
//    the config-factory categories (dishwasher, microwave, vacuum, air_purifier,
//    coffee_maker, kettle, air_fryer, toaster, blender, oven) whose identity is
//    brand + type + capacity. Suitability = capacity-for-household + efficiency +
//    requested features + trust + budget. All structurally single-store (Layer 2) —
//    surfaced honestly with comparison_available:false. Never fabricates comparison.
interface ApplianceMeta {
  nounAr: string; metricAr?: string; largeAt?: number;   // capacity ≥ largeAt ⇒ "family size"
  features: Record<string, string>;                        // attribute flag → Arabic phrase
  featureWants?: Record<string, string>;                   // priority keyword → attribute flag it satisfies
}
export const APPLIANCE_META: Record<string, ApplianceMeta> = {
  dishwasher: { nounAr: "غسالة صحون", metricAr: "مكان", largeAt: 14, features: { inverter: "محرك إنفرتر — أهدأ وأوفر", third_rack: "رف ثالث", aquastop: "أمان تسرب الماء" }, featureWants: { quiet: "inverter", low_electricity: "inverter" } },
  microwave: { nounAr: "مايكرويف", metricAr: "لتر", largeAt: 30, features: { convection: "حراري — يشوي ويخبز", grill: "جريل", inverter: "إنفرتر" }, featureWants: { cooking: "convection" } },
  vacuum: { nounAr: "مكنسة", metricAr: "واط", features: { cordless: "لاسلكية", mop: "تمسح وتشفط", wifi: "تحكم بالتطبيق/المساعد", hepa: "فلتر HEPA", bagless: "بدون كيس" }, featureWants: {} },
  air_purifier: { nounAr: "منقي هواء", metricAr: "م²", largeAt: 40, features: { hepa: "فلتر HEPA", ionizer: "مؤيّن", uv: "أشعة UV", wifi: "تحكم ذكي" }, featureWants: {} },
  coffee_maker: { nounAr: "صانعة قهوة", features: { milk_frother: "خافق حليب", grinder: "مطحنة مدمجة", touchscreen: "شاشة لمس" }, featureWants: {} },
  kettle: { nounAr: "غلاية", metricAr: "لتر", features: { temperature_control: "تحكم بدرجة الحرارة", keep_warm: "حفظ السخونة", glass: "زجاج", digital: "رقمية" }, featureWants: {} },
  air_fryer: { nounAr: "قلاية هوائية", metricAr: "لتر", largeAt: 6, features: { dual_zone: "منطقتا طهي", digital: "رقمية", window: "نافذة رؤية" }, featureWants: {} },
  toaster: { nounAr: "محمصة", metricAr: "شريحة", largeAt: 4, features: { digital: "رقمية", defrost: "إذابة الثلج" }, featureWants: {} },
  blender: { nounAr: "خلاط", metricAr: "واط", features: { cordless: "لاسلكي", ice_crush: "جرش الثلج", digital: "رقمي" }, featureWants: {} },
  oven: { nounAr: "فرن", metricAr: "سم", features: { steam: "بخار", convection: "مروحة حرارية", self_clean: "تنظيف ذاتي", gas: "غاز", digital: "رقمي" }, featureWants: {} },
};
export function decideAppliance(task: ShoppingTask, rows: CanonicalRow[]): Recommendation[] {
  const meta = APPLIANCE_META[task.category];
  const pr = task.priorities ?? [];
  const text = (task as { parsed_from_text?: string }).parsed_from_text ?? "";
  const wantLarge = pr.includes("large") || /كبير|كبيرة|عائلة|عائلية|family|large/.test(text);
  const wantLowElec = pr.includes("low_electricity"), wantQuiet = pr.includes("quiet");
  const scored = rows.map((row) => {
    const a = row.attributes ?? {}; const reasons = new ReasonLedger();
    let score = 0.5;
    const type = (a.appliance_type as string | null) ?? null;
    const cap = a.capacity != null ? Number(a.capacity) : null;
    const unit = meta.metricAr ?? "";
    // headline
    reasons.identity(`${meta.nounAr} ${row.brand ?? ""} ${type ? type.replace(/_/g, " ") : ""}${cap != null ? ` ${cap} ${unit}` : ""}`.replace(/\s+/g, " ").trim());
    // capacity-for-household
    if (cap != null && meta.largeAt) {
      if (wantLarge) { if (cap >= meta.largeAt) { score += 0.1; reasons.fit(`سعة ${cap} ${unit} — مناسبة للعائلات`); } else reasons.caution(`سعة ${cap} ${unit} — متوسطة`); }
    }
    // efficiency (inverter) — matters most where the appliance runs long/often
    if (a.inverter === true) { score += (wantLowElec || wantQuiet) ? 0.12 : 0.05; if (wantLowElec || wantQuiet) reasons.fit("إنفرتر — أهدأ وأوفر (أولويتك)"); else reasons.spec("إنفرتر — كفاءة أعلى"); }
    else if (wantLowElec && "inverter" in a && a.inverter === false) { score -= 0.05; reasons.caution("عادي (غير إنفرتر)"); }
    // requested features
    for (const [flag, want] of Object.entries(meta.featureWants ?? {})) {
      if (pr.includes(flag) && a[want] === true) { score += 0.06; }
    }
    // present features (neutral reasons — no score unless requested above)
    for (const [flag, phrase] of Object.entries(meta.features)) if (a[flag] === true) reasons.spec(phrase);
    // trust
    if ((row.store_count ?? 0) >= 2) { score += 0.08; reasons.evidence(`سعر موثوق — متوفر في ${row.store_count} متاجر`); }
    else reasons.evidence("متوفر في متجر واحد — المقارنة غير متاحة");
    // budget
    const total = row.lowest_price;
    if (task.budget_total && total) { if (total <= task.budget_total) { score += 0.06; reasons.fit(`ضمن ميزانيتك (${total} ريال)`); } else { score -= 0.12; reasons.caution(`أعلى من ميزانيتك (${total} ريال)`); } }
    return { row, dna: { brand: row.brand, appliance_type: type, capacity: cap, capacity_unit: a.capacity_unit ?? null }, score, reasons, total: total ?? null, breakdown: { unit: total ?? null, installation: null, annual_electricity: null } };
  });
  return assemble(scored);
}

// ── Reasoned comparison (Brief §5.5): explain WHY the smart pick beats the runner-up,
//    deterministically, from the SAME signals that produced the ranking (never
//    commission). Generic across categories: total cost, corroboration/trust,
//    suitability, and the pick's distinguishing merits. Returns null when the pick
//    is not clearly better on any axis (honest — no fabricated superiority). ──
export interface ChoiceExplanation {
  alternative_title_ar: string | null;
  alternative_title_en: string | null;
  reasons_ar: string[];
  reasons_en: string[];
  /**
   * PUBLISH, NEVER INFER (ADR-162).
   *
   * The saving this explanation RENDERS — «أوفر بـ180 ريال في التكلفة الإجمالية» / "180 SAR lower
   * total cost". It used to exist only inside that sentence: both total costs were published and
   * the DELTA was not, so nothing downstream could verify the one number a customer actually
   * reads. Measured on production 2026-08-01, that made four strings per query unverifiable.
   *
   * `null` when no saving was rendered. A figure that cannot be declared is not rendered — the
   * two are set together, a few lines below, so they cannot drift apart.
   */
  total_cost_delta: number | null;
}
export function explainChoice(pick: Recommendation, runnerUp: Recommendation | undefined): ChoiceExplanation | null {
  if (!runnerUp || runnerUp.canonical_id === pick.canonical_id) return null;
  const ar: string[] = []; const en: string[] = [];
  let totalCostDelta: number | null = null;
  // 1) total cost (or unit price when no total-cost components)
  const pc = pick.total_cost_estimate ?? pick.unit_price;
  const rc = runnerUp.total_cost_estimate ?? runnerUp.unit_price;
  if (pc != null && rc != null && pc < rc) {
    const diff = Math.round(rc - pc);
    // The figure is PUBLISHED on the same branch that renders it. Setting `totalCostDelta` here
    // rather than recomputing it later is what makes "the engine cannot render a figure it does
    // not declare" true by construction instead of by review.
    if (diff > 0) { totalCostDelta = diff; ar.push(`أوفر بـ${diff} ريال في التكلفة الإجمالية`); en.push(`${diff} SAR lower total cost`); }
  }
  // 2) trust: more cross-store corroboration
  const ps = pick.store_count ?? 0, rs = runnerUp.store_count ?? 0;
  if (pick.comparison_available && ps > rs) { ar.push(`سعر مؤكَّد في متاجر أكثر (${ps} مقابل ${rs})`); en.push(`corroborated across more stores (${ps} vs ${rs})`); }
  // 3) suitability: better fit to the task
  if (pick.suitability_score > runnerUp.suitability_score + 0.02) { ar.push("ملاءمة أعلى لطلبك"); en.push("higher suitability for your task"); }
  // 4) a distinguishing merit the pick states and the runner-up does not (e.g. inverter, quiet)
  const merit = (pick.reasons_ar ?? []).find((r) => /إنفرتر|هادئ|أوفر|تدفئة|كرت شاشة منفصل|تحميل أمامي|HEPA|حراري|أفضل سعر/.test(r) && !(runnerUp.reasons_ar ?? []).some((x) => x === r));
  if (merit && ar.length < 3) { ar.push(merit.replace(/^[^—]*—\s*/, "").trim()); }
  if (ar.length === 0) return null; // not clearly better — say nothing rather than fabricate
  return {
    alternative_title_ar: runnerUp.title_ar, alternative_title_en: runnerUp.title_en,
    reasons_ar: ar.slice(0, 3), reasons_en: en.slice(0, 3),
    // `slice(0,3)` can drop the saving sentence; publish the delta only if it SURVIVED into the
    // rendered list. Publishing a figure we did not render would be the mirror of the defect.
    total_cost_delta: ar.slice(0, 3).some((r) => r.includes("أوفر بـ")) ? totalCostDelta : null,
  };
}

/**
 * MEASURED GAP (2026-08-09, founder architectural clarification): every category decider
 * treats `budget_total` as a SOFT scoring input — +0.06 within budget, -0.12 over — never
 * as a hard eligibility gate. -0.12 is small next to BTU-fit (~±0.25), inverter (+0.18) or
 * trust (+0.08), so an OVER-BUDGET candidate with strong fit/trust could still outscore an
 * in-budget one and be crowned Smart Pick — silently relaxing a stated hard constraint,
 * which the Constitution forbids exactly as much as a false zero-result. Retrieval
 * (`/api/search`'s `inferredMaxPrice`) was already fixed to hard-filter; this closes the
 * same gap on the DECISION side.
 *
 * Applied ONCE, centrally, in the dispatcher — not inside each of the 8 category deciders
 * — so their own nuanced within-budget ranking (BTU fit, inverter, trust, …) is completely
 * untouched, and their existing direct unit tests (which call `decideAc`/`decideAppliance`/…
 * directly, bypassing this dispatcher) keep passing unchanged. Only candidates reachable
 * through `decide()` — the actual `/api/v1/agent/decide` route — get the hard gate.
 *
 * Rule: an in-budget candidate always outranks an over-budget one, regardless of
 * suitability score (never silently relax a hard constraint). Order WITHIN each side is
 * untouched (the category decider's own suitability ranking still decides ties). A
 * candidate with UNKNOWN cost is treated as satisfying the budget — unknown must never be
 * treated as a violation ("unknown beats incorrect"). When every priced candidate exceeds
 * budget, the fallback is the existing suitability-sorted order (already true today) — but
 * now explicitly flagged via `anyWithinBudget` so the answer surface can render the honest
 * "لا يوجد خيار مطابق تحت X… أقرب خيار هو Y" message (brief §10) instead of presenting the
 * closest over-budget item as if it satisfied the request.
 *
 * Gates on `unit_price` (the VERIFIED, observed device price) — deliberately NOT
 * `total_cost_estimate`. Total cost bundles installation/annual-electricity, which are
 * MODELLED estimates (KSA heuristics, ADR-187), not measurements; hard-excluding a product
 * because a projection pushed it a few hundred SAR over would gate a real fact on an
 * estimate's error margin. MEASURED regression caught by the flagship benchmark
 * (`ac-riyadh-30m-quiet-saving`, tests/agent/saudi-agent-benchmark.test.ts): gating on
 * total_cost_estimate demoted the well-sized 24000 BTU inverter unit (unit price 2600,
 * comfortably under a 4000 budget, but estimated total ~4545 once installation + estimated
 * annual electricity are added) below an undersized 18000 BTU unit whose lower estimated
 * total happened to clear the same bar. The estimated total remains a SOFT signal in each
 * decider's own scoring (unchanged, still nudges ranking toward genuinely cheaper-to-run
 * options within the verified-price-gated set) — it just does not hard-exclude.
 */
function applyBudgetGate(
  task: ShoppingTask,
  recommendations: Recommendation[],
): { recommendations: Recommendation[]; anyWithinBudget: boolean } {
  const budget = task.budget_total;
  if (!budget || budget <= 0 || recommendations.length === 0) {
    return { recommendations, anyWithinBudget: true }; // no stated budget — nothing to gate
  }
  const withinBudget: Recommendation[] = [];
  const overBudget: Recommendation[] = [];
  for (const r of recommendations) {
    const cost = r.unit_price; // verified device price — see doc comment above
    if (cost == null || cost <= budget) withinBudget.push(r);
    else overBudget.push(r);
  }
  const anyWithinBudget = withinBudget.length > 0;
  const ordered = anyWithinBudget ? [...withinBudget, ...overBudget] : recommendations;
  // `is_smart_pick` was set by the category decider against ITS pre-gate order; recompute
  // against the post-gate order so the flag always names the actual rank-0 item.
  const recomputed = ordered.map((r, i) => ({ ...r, is_smart_pick: i === 0 }));
  return { recommendations: recomputed, anyWithinBudget };
}

// ── Category dispatcher. Deterministic per-category deciders; neutral trust+price
//    fallback for categories without a bespoke decider yet (no fabrication). ──
export function decide(
  task: ShoppingTask,
  rows: CanonicalRow[],
): { supported: boolean; recommendations: Recommendation[]; anyWithinBudget: boolean } {
  const base: { supported: boolean; recommendations: Recommendation[] } = (() => {
    switch (task.category) {
      case "air_conditioner": return { supported: true, recommendations: decideAc(task, rows) };
      case "tv": return { supported: true, recommendations: decideTv(task, rows) };
      case "tablet": return { supported: true, recommendations: decideTablet(task, rows) };
      case "mobile": return { supported: true, recommendations: decideMobile(task, rows) };
      case "laptop": return { supported: true, recommendations: decideLaptop(task, rows) };
      case "refrigerator": return { supported: true, recommendations: decideRefrigerator(task, rows) };
      case "washing_machine": return { supported: true, recommendations: decideWashingMachine(task, rows) };
      default: {
        if (APPLIANCE_META[task.category]) return { supported: true, recommendations: decideAppliance(task, rows) };
        const scored = rows.map((row) => {
          const reasons = new ReasonLedger();
          reasons.evidence((row.store_count ?? 0) >= 2 ? `سعر موثوق — متوفر في ${row.store_count} متاجر` : "متوفر في متجر واحد");
          return { row, dna: {}, score: 0.5 + ((row.store_count ?? 0) >= 2 ? 0.08 : 0), reasons,
            total: row.lowest_price ?? null, breakdown: { unit: row.lowest_price ?? null, installation: null, annual_electricity: null } };
        });
        return { supported: false, recommendations: assemble(scored) };
      }
    }
  })();
  const gated = applyBudgetGate(task, base.recommendations);
  return { supported: base.supported, recommendations: gated.recommendations, anyWithinBudget: gated.anyWithinBudget };
}
