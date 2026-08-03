// src/lib/agent/advisor-api.ts
// Client-side helper for the Neutral Advisor UI. Wraps POST /api/v1/agent/decide
// (the deterministic, ranking-blind Decision Agent) and provides PURE, testable
// presentation helpers (category/priority labels, comparison badge, cost lines,
// parsed-task summary). No fabrication: helpers only reformat what the engine
// returned; they never invent prices, stores, or reasons.

/** What kind of statement a reason is (ADR-187). Mirrors `decision-engine.ts`'s own union. */
export type ReasonKind = "identity" | "fit" | "spec" | "evidence" | "estimate" | "caution";

export interface AdvisorRecommendation {
  canonical_id: string;
  tps_identity_key: string;
  title_ar: string | null;
  title_en: string | null;
  brand: string | null;
  unit_price: number | null;
  total_cost_estimate: number | null;
  cost_breakdown: { unit: number | null; installation: number | null; annual_electricity: number | null };
  store_count: number | null;
  comparison_available: boolean;
  suitability_score: number;
  confidence: number;
  is_smart_pick: boolean;
  reasons_ar: string[];
  /**
   * ADR-187 · REDESIGN_BRIEF §8 — *"Distinguish fact from inference from recommendation."*
   * Same length and order as `reasons_ar`. Declared by the engine where the reason is written;
   * the view never classifies our own prose. Optional so an older cached payload still renders.
   */
  reason_kinds?: ReasonKind[] | null;
  /**
   * ADR-187 · REDESIGN_BRIEF §8 — *"Two sentences of reasoning, maximum."* Indices into
   * `reasons_ar`, at most two, chosen by the ENGINE (the ADR-163 rule: the view never re-derives
   * a judgement the engine already made).
   */
  headline_reasons?: number[] | null;
  dna: Record<string, unknown>;
  go_offer_hint: string;
  go_url: string | null;
  /** Named stores that corroborate this product (Arabic display names). */
  stores?: string[] | null;
  /** Hours since the freshest observation, when known. */
  data_age_hours?: number | null;
  /** The deterministic Trust Engine breakdown (factors + caveats), when present. */
  trust?: TrustSummary | null;
  price_intel?: PriceIntel | null;
  chosen_over?: ChoiceExplanation | null;
  discount_intel?: DiscountIntel | null;
  alternatives?: ProductAlternative[] | null;
}

// ── Trust Engine breakdown (ADR-087) surfaced to the customer ────────────────
export type FactorStatus = "strong" | "ok" | "weak" | "unknown";
export interface TrustFactorSummary {
  key: string;
  label_ar: string; label_en: string;
  status: FactorStatus;
  evidence_ar: string; evidence_en: string;
}
export interface TrustSummary {
  score: number;
  tier: "high" | "medium" | "low";
  factors: TrustFactorSummary[];
  caveats_ar: string[]; caveats_en?: string[];
}

/**
 * Organize the Trust Engine's evidence into the epistemic categories a customer must be
 * able to DISTINGUISH (Founder Directive Part 2): what is a VERIFIED FACT, what is an
 * INFERRED conclusion, what is UNKNOWN, and what is INSUFFICIENT EVIDENCE. Pure — it only
 * reclassifies what the deterministic engine already produced; it never invents evidence.
 * The "recommendation" itself (reasons_ar / chosen_over) is rendered separately so the
 * customer never confuses "why we suggest it" with "what we verified."
 */
export interface EvidenceGroups { facts: string[]; inferences: string[]; insufficient: string[]; unknown: string[]; }

/**
 * How well the product fits the shopper's task, IN WORDS.
 *
 * `suitability_score` is a **0..1** value (`decision-engine.ts` clamps and rounds it to two
 * decimals). This line used to render it as `${score}%`, which published "0.89%" — a fit of
 * 89% shown as "almost no match" on the product we ranked FIRST. Two separate faults: the
 * scale was wrong by 100×, and a raw confidence percentage is not something a shopper can
 * act on. Confidence is stated in plain language or not at all.
 *
 * Bands are deterministic and derived only from the engine's own score — no new judgement is
 * introduced here, and a score of 0 (or a missing one) says nothing rather than guessing.
 */
export function suitabilityPhrase(score: number | null | undefined, locale: Locale): string | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) return null;
  const ar = locale === "ar";
  if (score >= 0.85) return ar ? "مطابق لما طلبته" : "Matches what you asked for";
  if (score >= 0.7) return ar ? "مناسب لطلبك" : "Suitable for your request";
  if (score >= 0.5) return ar ? "مناسب جزئيًا لطلبك" : "Partly suitable for your request";
  return ar ? "ملاءمته لطلبك محدودة" : "Limited fit for your request";
}
export function evidenceGroups(rec: AdvisorRecommendation, locale: Locale): EvidenceGroups {
  const g: EvidenceGroups = { facts: [], inferences: [], insufficient: [], unknown: [] };
  const ar = locale === "ar";
  const stores = rec.stores ?? [];
  // Headline verified fact: NAMED corroboration (not just a count).
  if (rec.comparison_available && stores.length >= 2) {
    g.facts.push(ar ? `مؤكَّد ومُقارَن في ${stores.length} متاجر: ${stores.join("، ")}` : `Corroborated across ${stores.length} stores: ${stores.join(", ")}`);
  }
  for (const f of rec.trust?.factors ?? []) {
    if (f.key === "corroboration" && rec.comparison_available && stores.length >= 2) continue; // already shown, named
    const ev = (ar ? f.evidence_ar : f.evidence_en) || f.evidence_ar;
    if (!ev) continue;
    if (f.status === "strong" || f.status === "ok") g.facts.push(ev);
    else if (f.status === "weak") g.insufficient.push(ev);
    else g.unknown.push(ev);
  }
  // Inferences — conclusions DERIVED from facts, not observed directly.
  if (hasTotalBeyondUnit(rec)) g.inferences.push(ar ? "التكلفة الكلية تقديرية (تشمل التركيب و/أو الكهرباء المقدّرة)" : "Total cost is an estimate (includes installation and/or est. electricity)");
  const fit = suitabilityPhrase(rec.suitability_score, locale);
  if (fit) g.inferences.push(fit);
  // Honest caveats join "insufficient evidence".
  for (const c of (ar ? rec.trust?.caveats_ar : (rec.trust?.caveats_en ?? rec.trust?.caveats_ar)) ?? []) g.insufficient.push(c);
  // Dedupe each group (stable order).
  g.facts = [...new Set(g.facts)];
  g.inferences = [...new Set(g.inferences)];
  g.insufficient = [...new Set(g.insufficient)];
  g.unknown = [...new Set(g.unknown)];
  return g;
}

export interface ProductAlternative {
  id: string;
  relation: "larger_storage" | "smaller_storage" | "newer" | "older";
  title_ar: string | null;
  title_en: string | null;
  price: number | null;
  price_delta: number | null;
  detail: string;
}

/** Localized one-liner for a knowledge-graph alternative (variant / generation). */
export function alternativeLabel(a: ProductAlternative, locale: Locale): string {
  const rel = locale === "ar"
    ? { larger_storage: "سعة أكبر", smaller_storage: "سعة أقل", newer: "الأحدث", older: "الجيل السابق" }
    : { larger_storage: "more storage", smaller_storage: "less storage", newer: "newer model", older: "previous model" };
  const d = a.price_delta;
  const money = d == null ? "" : d === 0 ? "" : d > 0
    ? (locale === "ar" ? ` (+${d} ريال)` : ` (+${d} SAR)`)
    : (locale === "ar" ? ` (−${Math.abs(d)} ريال)` : ` (−${Math.abs(d)} SAR)`);
  return `${rel[a.relation]}${money}`;
}

export interface DiscountIntel {
  verdict: "verified_drop" | "inflated_reference" | "stable";
  real_saving_pct: number | null;
  advertised_saving_pct: number | null;
  text: { ar: string; en: string };
}

/** Localized honest-discount line + tone; null when nothing worth showing. */
export function discountLine(rec: AdvisorRecommendation, locale: Locale): { text: string; tone: VerdictTone } | null {
  const d = rec.discount_intel;
  if (!d || d.verdict === "stable") return null;
  const text = (locale === "ar" ? d.text.ar : d.text.en) || d.text.ar || "";
  if (!text) return null;
  return { text, tone: d.verdict === "verified_drop" ? "great" : "warn" };
}

export interface ChoiceExplanation {
  alternative_title_ar: string | null;
  alternative_title_en: string | null;
  reasons_ar: string[];
  reasons_en: string[];
}

/** Localized comparison ("chosen over X because …"); null when not clearly better. */
export function choiceReasons(rec: AdvisorRecommendation, locale: Locale): { alt: string; reasons: string[] } | null {
  const c = rec.chosen_over;
  if (!c) return null;
  const reasons = locale === "ar" ? c.reasons_ar : (c.reasons_en?.length ? c.reasons_en : c.reasons_ar);
  if (!reasons?.length) return null;
  const alt = (locale === "ar" ? c.alternative_title_ar : c.alternative_title_en) || c.alternative_title_ar || c.alternative_title_en || "";
  return { alt, reasons };
}

export interface PriceIntel {
  verdict: "great_price" | "good_price" | "typical" | "elevated" | "building_history";
  confident: boolean;
  is_observed_low: boolean;
  days_tracked: number;
  distinct_days: number;
  current_best: number | null;
  typical: number | null;
  pct_vs_typical: number | null;
  trend: "rising" | "falling" | "stable";
  text: { ar: string; en: string };
}

export type VerdictTone = "great" | "good" | "neutral" | "warn" | "muted";

/** Deterministic tone for a price verdict (drives the badge colour). */
export function verdictTone(verdict: PriceIntel["verdict"]): VerdictTone {
  switch (verdict) {
    case "great_price": return "great";
    case "good_price": return "good";
    case "elevated": return "warn";
    case "building_history": return "muted";
    default: return "neutral"; // typical
  }
}

/** Localized verdict text (falls back to Arabic if an English string is absent). */
export function verdictText(pi: PriceIntel | null | undefined, locale: Locale): string {
  if (!pi) return "";
  return (locale === "ar" ? pi.text.ar : pi.text.en) || pi.text.ar || "";
}

export interface AdvisorParsed {
  category?: string;
  room_size_m2?: number;
  city?: string;
  budget_total?: number;
  priorities?: string[];
  unresolved?: string[];
}

export interface AdvisorResponse {
  version: string;
  task: Record<string, unknown> & { category?: string };
  parsed?: AdvisorParsed;
  supported: boolean;
  engine?: string;
  neutrality?: string;
  count: number;
  smart_pick?: AdvisorRecommendation | null;
  recommendations: AdvisorRecommendation[];
  note?: string;
  error?: string;
  /**
   * P2-8. Present ONLY when the engine proved a different answer would change the
   * recommendation (see `clarify.ts` → `shouldAsk`). Absent means "do not ask" — either the
   * field was already supplied or the answer could not move anything.
   */
  clarify?: {
    question: {
      field: string;
      question_ar: string;
      question_en: string;
      options: Array<{ value: number; label_ar: string; label_en: string }>;
    };
    reason: string;
  } | null;
  /** Why no question was asked. Carried so the choice is auditable, not inferred. */
  clarify_skipped_reason?: string | null;
}

export type Locale = "ar" | "en";

// ── Localized labels (deterministic maps; unknown slugs fall back to the raw slug) ──
const CATEGORY_LABELS: Record<string, [string, string]> = {
  air_conditioner: ["مكيف", "Air conditioner"], tv: ["تلفزيون", "TV"], tablet: ["تابلت", "Tablet"],
  mobile: ["جوال", "Phone"], laptop: ["لابتوب", "Laptop"], refrigerator: ["ثلاجة", "Refrigerator"],
  washing_machine: ["غسالة", "Washing machine"], dishwasher: ["غسالة صحون", "Dishwasher"],
  microwave: ["مايكرويف", "Microwave"], vacuum: ["مكنسة", "Vacuum"], air_purifier: ["منقي هواء", "Air purifier"],
  coffee_maker: ["صانعة قهوة", "Coffee maker"], kettle: ["غلاية", "Kettle"], air_fryer: ["قلاية هوائية", "Air fryer"],
  toaster: ["محمصة", "Toaster"], blender: ["خلاط", "Blender"], oven: ["فرن", "Oven"],
  audio: ["سماعات", "Audio"], camera: ["كاميرا", "Camera"],
};
const PRIORITY_LABELS: Record<string, [string, string]> = {
  quiet: ["هادئ", "Quiet"], low_electricity: ["موفر للكهرباء", "Energy-saving"], heating: ["تدفئة", "Heating"],
  gaming: ["ألعاب", "Gaming"], movies: ["أفلام", "Movies"], sports: ["رياضة", "Sports"],
  bright_room: ["غرفة مضيئة", "Bright room"], productivity: ["إنتاجية", "Productivity"], reading: ["قراءة", "Reading"],
  camera: ["تصوير", "Camera"], battery: ["بطارية", "Battery"], latest: ["الأحدث", "Latest"],
  portability: ["خفيف", "Portable"], large: ["حجم كبير", "Large size"], cellular: ["شريحة", "Cellular"],
};

export function categoryLabel(slug: string | undefined, locale: Locale): string {
  if (!slug) return "";
  const pair = CATEGORY_LABELS[slug];
  return pair ? pair[locale === "ar" ? 0 : 1] : slug.replace(/_/g, " ");
}
export function priorityLabel(slug: string, locale: Locale): string {
  const pair = PRIORITY_LABELS[slug];
  return pair ? pair[locale === "ar" ? 0 : 1] : slug.replace(/_/g, " ");
}

/** Title in the viewer's locale, with a graceful fallback to the other language. */
export function recTitle(rec: AdvisorRecommendation, locale: Locale): string {
  const primary = locale === "ar" ? rec.title_ar : rec.title_en;
  return (primary || rec.title_en || rec.title_ar || rec.brand || "").trim();
}

/** Trust badge text: verified ≥2-store comparison vs honest single-store. */
export function comparisonBadge(rec: AdvisorRecommendation, locale: Locale): { text: string; verified: boolean } {
  const n = rec.store_count ?? 0;
  if (rec.comparison_available && n >= 2) {
    return { text: locale === "ar" ? `مقارنة موثّقة في ${n} متاجر` : `Verified across ${n} stores`, verified: true };
  }
  return { text: locale === "ar" ? "متجر واحد — المقارنة غير متاحة" : "Single store — no comparison", verified: false };
}

/** Cost breakdown lines the engine supplied (only non-null parts; never fabricated). */
export function costLines(rec: AdvisorRecommendation, locale: Locale): { label: string; amount: number }[] {
  const b = rec.cost_breakdown ?? { unit: null, installation: null, annual_electricity: null };
  const lines: { label: string; amount: number }[] = [];
  if (b.unit != null) lines.push({ label: locale === "ar" ? "سعر الجهاز" : "Unit price", amount: b.unit });
  if (b.installation != null && b.installation > 0) lines.push({ label: locale === "ar" ? "تركيب" : "Installation", amount: b.installation });
  if (b.annual_electricity != null && b.annual_electricity > 0) lines.push({ label: locale === "ar" ? "كهرباء سنوية (تقديري)" : "Est. annual electricity", amount: b.annual_electricity });
  return lines;
}

/** Whether a total-cost figure adds anything beyond the unit price (install/electricity). */
export function hasTotalBeyondUnit(rec: AdvisorRecommendation): boolean {
  const b = rec.cost_breakdown;
  if (!b || rec.total_cost_estimate == null || rec.unit_price == null) return false;
  return rec.total_cost_estimate > rec.unit_price;
}

/** Chips summarizing how the free text was understood (category, size, budget, priorities). */
export function parsedSummary(parsed: AdvisorParsed | undefined, locale: Locale): string[] {
  if (!parsed) return [];
  const chips: string[] = [];
  if (parsed.category) chips.push(categoryLabel(parsed.category, locale));
  if (parsed.room_size_m2) chips.push(locale === "ar" ? `${parsed.room_size_m2} م²` : `${parsed.room_size_m2} m²`);
  if (parsed.budget_total) chips.push(locale === "ar" ? `تحت ${parsed.budget_total} ريال` : `under ${parsed.budget_total} SAR`);
  if (parsed.city) chips.push(parsed.city);
  for (const p of parsed.priorities ?? []) chips.push(priorityLabel(p, locale));
  return chips;
}

/** Fallback exit target when a recommendation has no measured-exit go_url yet. */
export function exitHref(rec: AdvisorRecommendation, locale: Locale): string {
  if (rec.go_url) return rec.go_url;
  return `/${locale}/compare/${encodeURIComponent(rec.tps_identity_key)}`;
}

/** POST the shopping task (free text or structured) to the deterministic agent. */
export async function askAdvisor(
  // `room_size_m2` doubles as the clarification answer: the surface re-asks the SAME text
  // with the field filled in, so an answered question takes the identical path a shopper
  // who had typed it themselves would have taken. No separate "clarified" code path.
  body: { text?: string } & Partial<{ category: string; room_size_m2: number; city: string; priorities: string[]; budget_total: number }>,
  opts?: { signal?: AbortSignal; limit?: number }
): Promise<AdvisorResponse> {
  const url = `/api/v1/agent/decide${opts?.limit ? `?limit=${opts.limit}` : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
  const json = (await res.json()) as AdvisorResponse;
  return json;
}
