// src/lib/agent/home-mission-view.ts
// PURE presentation helpers for the Home mission workspace (Mobile Experience Pass).
// Everything here is display arithmetic/derivation over the server's guarded payload —
// no new claims are composed, no figures invented (the route declares every number).
// Kept out of the client component so the grouping/labeling logic is unit-testable.

export type Emphasis = "high" | "normal" | "deprioritized" | "excluded";
export type ClaimKind = "compared" | "availability" | "single";
export type LegState = "ok" | "needs_area" | "insufficient";

export interface SpaceOut { key: string; label_ar: string; label_en: string; area_m2: number | null }
export interface RecOut {
  canonical_id: string;
  title_ar: string | null; title_en: string | null; brand: string | null;
  image_url: string | null;
  unit_price: number | null;
  store_count: number; stores: string[];
  data_age_hours: number | null;
  claim_kind: ClaimKind;
  claim_ar: string; claim_en: string;
  reasons_ar: string[]; reason_kinds: string[]; headline_reasons: number[];
  trust: { score: number; tier: "high" | "medium" | "low" } | null;
  dna?: Record<string, unknown>;
  go_url: string | null;
  tv_size?: number | null;
}
export interface TradeOut {
  next_upgrade: { extra_cost: number; title_ar: string | null; title_en: string | null; canonical_id: string } | null;
  downgrade_saving: number | null;
  cheapest_id: string | null;
}
export interface LegOut {
  leg_id: string; category: string; label_ar: string; label_en: string;
  emphasis: Emphasis;
  state: LegState;
  space?: SpaceOut | null;
  btu_required?: number | null;
  picked?: RecOut;
  pinned?: boolean;
  alternative?: RecOut | null;
  alternatives?: RecOut[];
  trade?: TradeOut;
  question_ar?: string; question_en?: string;
  note_ar?: string; note_en?: string;
}

// ── Grouping: legs of the same category form ONE group (the "3 ACs are one mission
//    section, not three unrelated searches" rule). Group order follows leg order. ──
export interface LegGroup {
  key: string;                 // category
  label_ar: string; label_en: string;
  legs: LegOut[];
  decided: number;             // legs in state "ok"
  subtotal: number | null;     // sum of decided picks' prices; null if any decided leg unpriced
  /** Worst-child rollup so a collapsed group can never look healthier than its contents. */
  worst: "ok" | "needs_input" | "insufficient" | "stale_or_single";
}

const GROUP_LABELS: Record<string, { ar: string; en: string }> = {
  air_conditioner: { ar: "التكييف", en: "Cooling" },
  refrigerator: { ar: "الثلاجة", en: "Refrigerator" },
  washing_machine: { ar: "الغسالة", en: "Washing machine" },
  tv: { ar: "التلفزيون", en: "TV" },
};

export function groupLegs(legs: LegOut[]): LegGroup[] {
  const byCat = new Map<string, LegOut[]>();
  for (const l of legs) {
    const arr = byCat.get(l.category) ?? [];
    arr.push(l);
    byCat.set(l.category, arr);
  }
  return [...byCat.entries()].map(([cat, ls]) => {
    const decidedLegs = ls.filter((l) => l.state === "ok" && l.picked);
    let subtotal: number | null = 0;
    for (const l of decidedLegs) {
      if (l.picked!.unit_price == null) { subtotal = null; break; }
      subtotal += l.picked!.unit_price;
    }
    const worst: LegGroup["worst"] = ls.some((l) => l.state === "insufficient")
      ? "insufficient"
      : ls.some((l) => l.state === "needs_area")
        ? "needs_input"
        : decidedLegs.some((l) => l.picked!.claim_kind === "single" || (l.picked!.data_age_hours ?? 0) > 72)
          ? "stale_or_single"
          : "ok";
    return {
      key: cat,
      label_ar: GROUP_LABELS[cat]?.ar ?? ls[0].label_ar,
      label_en: GROUP_LABELS[cat]?.en ?? ls[0].label_en,
      legs: ls,
      decided: decidedLegs.length,
      subtotal: decidedLegs.length ? subtotal : null,
      worst,
    };
  });
}

// ── Budget bar: fraction spent + tone. RTL mirroring is the layout's job (the bar
//    fills from the inline-start automatically); numerals stay Latin (never mirrored). ──
export function budgetBar(budget: number | null, allocated: number | null): { pct: number; tone: "ok" | "tight" | "over" } | null {
  if (budget == null || allocated == null || budget <= 0) return null;
  const pct = Math.max(0, Math.min(100, Math.round((allocated / budget) * 100)));
  const tone = allocated > budget ? "over" : budget - allocated < budget * 0.1 ? "tight" : "ok";
  return { pct, tone };
}

// ── Chips (max ~3 per card; text always, never color-only) ──
export interface Chip { text: string; tone: "good" | "info" | "warn" }

export function fitChip(leg: LegOut, locale: "ar" | "en"): Chip | null {
  const dna = (leg.picked?.dna ?? {}) as Record<string, unknown>;
  if (leg.category === "air_conditioner" && leg.space?.area_m2 != null && dna.capacity_btu != null) {
    return { text: locale === "ar" ? `${dna.capacity_btu} وحدة لـ${leg.space.area_m2}م²` : `${dna.capacity_btu} BTU for ${leg.space.area_m2}m²`, tone: "good" };
  }
  if (leg.category === "refrigerator" && dna.capacity_liters != null) {
    return { text: locale === "ar" ? `${dna.capacity_liters} لتر` : `${dna.capacity_liters} L`, tone: "info" };
  }
  if (leg.category === "washing_machine" && dna.capacity_kg != null) {
    return { text: locale === "ar" ? `${dna.capacity_kg} كجم` : `${dna.capacity_kg} kg`, tone: "info" };
  }
  if (leg.category === "tv" && leg.picked?.tv_size != null) {
    return { text: locale === "ar" ? `${leg.picked.tv_size} بوصة` : `${leg.picked.tv_size}"`, tone: "info" };
  }
  return null;
}

/** Evidence chip from the server's claim kind — compresses the claim line to chip size
 *  WITHOUT strengthening it (compared > availability > single, wording preserved in the
 *  expandable claim line the card also renders). */
export function evidenceChip(rec: RecOut, locale: "ar" | "en"): Chip {
  if (rec.claim_kind === "compared") {
    return { text: locale === "ar" ? `${rec.store_count} عروض موثقة` : `${rec.store_count} verified offers`, tone: "good" };
  }
  if (rec.claim_kind === "availability") {
    return { text: locale === "ar" ? `${rec.store_count} متاجر — بدون تأكيد الموديل` : `${rec.store_count} stores — model unconfirmed`, tone: "info" };
  }
  return { text: locale === "ar" ? "متجر واحد" : "one store", tone: "warn" };
}

/** Neutral technology chip (§18): states WHAT inverter is, claims nothing about bills. */
export function energyChip(rec: RecOut | undefined, locale: "ar" | "en"): Chip | null {
  const dna = (rec?.dna ?? {}) as Record<string, unknown>;
  if (dna.inverter === true || dna.technology === "Inverter") {
    return { text: locale === "ar" ? "إنفرتر (تقنية الضاغط)" : "Inverter (compressor tech)", tone: "info" };
  }
  return null;
}

export function ageLabel(hours: number | null, locale: "ar" | "en"): string | null {
  if (hours == null) return null;
  if (locale === "ar") return hours < 48 ? `آخر رصد قبل ${Math.max(1, Math.round(hours))} ساعة` : `آخر رصد قبل ${Math.round(hours / 24)} يوم`;
  return hours < 48 ? `observed ${Math.max(1, Math.round(hours))}h ago` : `observed ${Math.round(hours / 24)}d ago`;
}

/** Alternative diff framing — «أرخص بـX» / «أغلى بـX» from the two shown prices only. */
export function diffLabel(altPrice: number | null, pickedPrice: number | null, locale: "ar" | "en"): Chip | null {
  if (altPrice == null || pickedPrice == null || altPrice === pickedPrice) return null;
  const d = Math.abs(Math.round(altPrice - pickedPrice));
  if (altPrice < pickedPrice) return { text: locale === "ar" ? `أرخص بـ${d.toLocaleString("en-US")} ر.س` : `${d.toLocaleString("en-US")} SAR cheaper`, tone: "good" };
  return { text: locale === "ar" ? `أغلى بـ${d.toLocaleString("en-US")} ر.س` : `+${d.toLocaleString("en-US")} SAR`, tone: "info" };
}

export const fmt = (n: number) => n.toLocaleString("en-US");

// ── Client mission state + deterministic follow-up delta parser (typed mutations only —
//    never re-interprets conversation history). Moved here from the old client so it is
//    unit-testable alongside the rest of the view logic. ──
export interface Mission {
  spaces: SpaceOut[];
  household_size: number | null;
  budget_total: number | null;
  categories: Partial<Record<string, Emphasis>>;
  priorities: string[];
  deprioritized_priorities: string[];
  excluded_priorities: string[];
  whole_home: boolean;
  unsupported_mentions: string[];
  parsed_from_text: string;
}

const toAsciiDigits = (t: string): string =>
  t.replace(/[٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });

export function parseDelta(raw: string, mission: Mission): { next: Mission; label: string } | null {
  const x = toAsciiDigits(raw.toLowerCase()).replace(/٬/g, "");
  const thousands = (s: string) => {
    const k = s.match(/(\d{1,3}(?:\.\d+)?)\s*(?:ألف|الف|آلاف|k\b)/);
    if (k) return Math.round(Number(k[1]) * 1000);
    const n = s.match(/(\d{4,6})/);
    return n ? Number(n[1]) : null;
  };
  // RELATIVE before ABSOLUTE — «زد الميزانية 3000» contains «الميزانية», so testing the
  // absolute branch first read it as "set budget TO 3000" (caught by the view test suite).
  const rel = x.match(/(زد|ارفع|زيد|increase|raise|نقص|قلل|انقص|reduce|lower)\s*(?:الميزاني[ةه])?\s*(?:ب)?\s*(\d{3,6}|\d{1,3}\s*(?:ألف|الف|k))/);
  if (rel && mission.budget_total) {
    const amt = thousands(rel[2]) ?? 0;
    const sign = /زد|ارفع|زيد|increase|raise/.test(rel[1]) ? 1 : -1;
    const v = mission.budget_total + sign * amt;
    if (amt && v >= 1000 && v <= 500000) return { next: { ...mission, budget_total: v }, label: `budget${sign > 0 ? "+" : "-"}${amt}` };
  }
  if (/خليها|خلها|اجعلها|make it|set (?:it|budget)|الميزاني[ةه]/.test(x)) {
    const v = thousands(x);
    if (v && v >= 1000 && v <= 500000) return { next: { ...mission, budget_total: v }, label: `budget→${v}` };
  }
  const cats: [string, RegExp][] = [
    ["tv", /تلفزيون|شاش[ةه]|tv/], ["washing_machine", /غسال[ةه]|washer/],
    ["refrigerator", /ثلاج|fridge/], ["air_conditioner", /مكيف|تكييف|ac\b/],
  ];
  for (const [cat, re] of cats) {
    if (re.test(x)) {
      if (/شيل|احذف|بدون|ما ابي|ما أبي|remove|drop|without/.test(x))
        return { next: { ...mission, categories: { ...mission.categories, [cat]: "excluded" } }, label: `exclude:${cat}` };
      if (/رجع|اضف|أضف|ضيف|add|bring back/.test(x))
        return { next: { ...mission, categories: { ...mission.categories, [cat]: "normal" } }, label: `add:${cat}` };
    }
  }
  const hh = x.match(/(?:عدد )?(?:ال)?([أا]سر[ةه]|عائل[ةه]|household|أفراد|اشخاص|أشخاص)\D{0,8}(\d{1,2})/) || x.match(/(\d{1,2})\s*([أا]فراد|[أا]شخاص|people)/);
  if (hh) {
    const n = Number(hh[2] ?? hh[1]);
    if (n >= 1 && n <= 20) return { next: { ...mission, household_size: n }, label: `household→${n}` };
  }
  return null;
}
