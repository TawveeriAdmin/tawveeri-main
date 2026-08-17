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

export const GROUP_LABELS_PUBLIC: Record<string, { ar: string; en: string }> = {
  air_conditioner: { ar: "التكييف", en: "Cooling" },
  refrigerator: { ar: "الثلاجة", en: "Refrigerator" },
  washing_machine: { ar: "الغسالة", en: "Washing machine" },
  tv: { ar: "التلفزيون", en: "TV" },
  vacuum: { ar: "المكنسة", en: "Vacuum" },
  microwave: { ar: "الميكروويف", en: "Microwave" },
  dishwasher: { ar: "غسالة الصحون", en: "Dishwasher" },
  oven: { ar: "فرن بلت إن", en: "Built-in oven" },
  air_fryer: { ar: "القلاية الهوائية", en: "Air fryer" },
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
      label_ar: GROUP_LABELS_PUBLIC[cat]?.ar ?? ls[0].label_ar,
      label_en: GROUP_LABELS_PUBLIC[cat]?.en ?? ls[0].label_en,
      legs: ls,
      decided: decidedLegs.length,
      subtotal: decidedLegs.length ? subtotal : null,
      worst,
    };
  });
}

// ── Purchase handoff (ADR-255): the plan regrouped by EXIT RETAILER. One checkout per
//    merchant is the purchase's real granularity — «اكسترا: جهازان · 4,398» beats six
//    scattered exits. stores[0] IS the /go exit store (both derive from the newest
//    observation in the route), so this grouping introduces no new claim: it re-arranges
//    picks the plan already shows, and subtotals are sums of the same shown prices. ──
export interface StoreGroup {
  store: string;               // display name of the exit retailer (stores[0])
  legs: LegOut[];              // ok legs whose picked exit goes to this store
  subtotal: number | null;     // null if any leg's pick is unpriced
}

export function groupByStore(legs: LegOut[]): StoreGroup[] {
  const byStore = new Map<string, LegOut[]>();
  for (const l of legs) {
    if (l.state !== "ok" || !l.picked?.go_url) continue;
    const store = l.picked.stores[0] ?? "—";
    const arr = byStore.get(store) ?? [];
    arr.push(l);
    byStore.set(store, arr);
  }
  const groups = [...byStore.entries()].map(([store, ls]) => {
    let subtotal: number | null = 0;
    for (const l of ls) {
      if (l.picked!.unit_price == null) { subtotal = null; break; }
      subtotal += l.picked!.unit_price;
    }
    return { store, legs: ls, subtotal };
  });
  // Most-items first (fewest handoffs completed soonest); stable name tie-break.
  return groups.sort((a, b) => b.legs.length - a.legs.length || a.store.localeCompare(b.store, "ar"));
}

/** Per-retailer completion over client purchase marks. The RETAILER is the UX completion
 *  unit («خلصت نجم الأجهزة»); per-item marks stay the data truth underneath (ADR-256). */
export function storeProgress(group: StoreGroup, purchased: Record<string, true>): { done: number; total: number; complete: boolean } {
  const done = group.legs.filter((l) => purchased[l.leg_id]).length;
  return { done, total: group.legs.length, complete: group.legs.length > 0 && done === group.legs.length };
}

/** The retailer CTA's destination: the first UNPURCHASED item's /go exit (never fabricates
 *  a cart — one honest merchant handoff at a time). Null when the retailer is complete. */
export function nextExit(group: StoreGroup, purchased: Record<string, true>): LegOut | null {
  return group.legs.find((l) => !purchased[l.leg_id] && l.picked?.go_url) ?? null;
}

// ── Feedback grouping (founder close, 2026-08-17): one submission posts one row per
//    reacted item with the SAME name+note — the inbox shows the person once, the note
//    once, then the item opinions. Grouping key = (name, note) within a 5-minute
//    window, so two submissions by the same person at different times — or different
//    people — are never merged. Pure derivation: reaction/note/association untouched. ──
export interface FeedbackRowIn {
  leg_id: string; reaction: string; note: string | null; reviewer_name: string | null; created_at?: string;
}
export interface FeedbackGroup {
  reviewer_name: string | null;
  note: string | null;
  items: Array<{ leg_id: string; reaction: string }>;
}
const SUBMISSION_WINDOW_MS = 5 * 60_000;

export function groupFeedback(rows: FeedbackRowIn[]): FeedbackGroup[] {
  // Oldest-first so items keep submission order; groups are returned newest-first.
  const asc = [...rows].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  const groups: Array<FeedbackGroup & { lastTs: number }> = [];
  for (const r of asc) {
    const ts = r.created_at ? new Date(r.created_at).getTime() : 0;
    const g = groups.find((x) =>
      (x.reviewer_name ?? "") === (r.reviewer_name ?? "") &&
      (x.note ?? "") === (r.note ?? "") &&
      (ts === 0 || x.lastTs === 0 || ts - x.lastTs < SUBMISSION_WINDOW_MS));
    if (g) {
      g.items.push({ leg_id: r.leg_id, reaction: r.reaction });
      g.lastTs = ts || g.lastTs;
    } else {
      groups.push({ reviewer_name: r.reviewer_name, note: r.note, items: [{ leg_id: r.leg_id, reaction: r.reaction }], lastTs: ts });
    }
  }
  return groups.reverse().map(({ reviewer_name, note, items }) => ({ reviewer_name, note, items }));
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
  // ADR-253 disclosure-tier categories: decideAppliance publishes {capacity, capacity_unit,
  // appliance_type} in dna — render the verified capacity, never anything inferred.
  if (dna.capacity != null && Number.isFinite(Number(dna.capacity))) {
    const unit = String(dna.capacity_unit ?? "");
    const unitAr: Record<string, string> = { W: "واط", L: "لتر", "place-settings": "مكان", cm: "سم" };
    const u = locale === "ar" ? (unitAr[unit] ?? unit) : unit;
    if (u) return { text: `${dna.capacity} ${u}`, tone: "info" };
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
  posture: "economic" | "balanced" | "premium" | null;
  property_type: "apartment" | "villa" | "partial" | null;
  categories: Partial<Record<string, Emphasis>>;
  /** Purchase quantity per category — ZERO VALID (= excluded). ADR-253. */
  quantities: Partial<Record<string, number>>;
  priorities: string[];
  deprioritized_priorities: string[];
  excluded_priorities: string[];
  whole_home: boolean;
  unsupported_mentions: string[];
  parsed_from_text: string;
}

/** One coherent quantity mutation: quantities and categories move together
 *  (qty 0 ⇔ excluded), and AC target spaces stay sized to the AC quantity. */
export function setQuantity(mission: Mission, cat: string, qty: number): Mission {
  const q = Math.max(0, Math.min(cat === "air_conditioner" ? 8 : 4, Math.floor(qty)));
  const categories = { ...mission.categories, [cat]: q === 0 ? ("excluded" as Emphasis) : mission.categories[cat] === "excluded" || !mission.categories[cat] ? ("normal" as Emphasis) : mission.categories[cat]! };
  let spaces = mission.spaces;
  if (cat === "air_conditioner") {
    spaces = mission.spaces.slice(0, q);
    for (let i = spaces.length; i < q; i++) {
      spaces = [...spaces, { key: `space_${i + 1}`, label_ar: `مكيف ${i + 1}`, label_en: `AC ${i + 1}`, area_m2: null }];
    }
  }
  return { ...mission, categories, quantities: { ...mission.quantities, [cat]: q }, spaces };
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
  // Dishwasher/oven MUST precede washer/التلفزيون-class words they overlap with.
  const cats: [string, RegExp][] = [
    ["dishwasher", /جلاي[ةه]|غسال[ةه]\s*(?:ال)?(?:صحون|أطباق|اطباق)|dishwasher/],
    ["oven", /فرن\s*(?:ال)?(?:بلت|مدمج)|بلت\s*[إا]ن|built.?in oven/],
    ["vacuum", /مكنس[ةه]|vacuum/],
    ["microwave", /مي?كرو ?وي?ف|مايكرويف|microwave/],
    ["air_fryer", /قلاي[ةه]|air ?fryer/],
    ["tv", /تلفزيون|شاش[ةه]|tv/], ["washing_machine", /غسال[ةه]|washer/],
    ["refrigerator", /ثلاج|fridge/], ["air_conditioner", /مكيف|تكييف|ac\b/],
  ];
  const DUAL: Record<string, RegExp> = {
    air_conditioner: /مكيفين/, refrigerator: /ثلاجتين/, tv: /تلفزيونين|شاشتين/,
    washing_machine: /غسالتين(?!\s*(?:ال)?(?:صحون|أطباق))/, vacuum: /مكنستين/,
  };
  for (const [cat, re] of cats) {
    if (re.test(x)) {
      // «خل المكيفات 4» / «ابي 3 تلفزيونات» / «مكيفين» → quantity mutation (0 handled below)
      const qm = x.match(new RegExp(`(\\d{1,2})\\s*(?:${re.source})`)) || x.match(new RegExp(`(?:${re.source})[^0-9]{0,12}?(\\d{1,2})(?!\\d)\\s*(?:منها|وحدات|أجهزة|units)?(?:\\s|$)`));
      const dualHit = DUAL[cat]?.test(x) ? 2 : null;
      const wantsRemove = /شيل|احذف|بدون|ما ابي|ما أبي|remove|drop|without/.test(x);
      const wantsAdd = /رجع|اضف|أضف|ضيف|ابي|أبي|add|bring back|خل/.test(x);
      if (wantsRemove)
        return { next: setQuantity(mission, cat, 0), label: `exclude:${cat}` };
      const q = dualHit ?? (qm ? Number(qm[1] ?? qm[2]) : null);
      if (q != null && q >= 0 && q <= 20 && (wantsAdd || q !== (mission.quantities[cat] ?? null)))
        return { next: setQuantity(mission, cat, q), label: `qty:${cat}→${q}` };
      if (wantsAdd)
        return { next: setQuantity(mission, cat, Math.max(1, mission.quantities[cat] ?? 0)), label: `add:${cat}` };
    }
  }
  const hh = x.match(/(?:عدد )?(?:ال)?([أا]سر[ةه]|عائل[ةه]|household|أفراد|اشخاص|أشخاص)\D{0,8}(\d{1,2})/) || x.match(/(\d{1,2})\s*([أا]فراد|[أا]شخاص|people)/);
  if (hh) {
    const n = Number(hh[2] ?? hh[1]);
    if (n >= 1 && n <= 20) return { next: { ...mission, household_size: n }, label: `household→${n}` };
  }
  return null;
}
