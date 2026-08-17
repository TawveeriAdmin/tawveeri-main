"use client";

// «جهّز بيتك بذكاء» — MISSION WORKSPACE client (Mobile Experience Pass, ADR-250).
// Research-derived architecture (US/China/UK convergence, 2026-08-15):
//   · the unit of output is a DECISION CARD, never a paragraph;
//   · shared mission state (budget / plan / remaining) is sticky and ambient;
//   · everything secondary (why, alternatives, evidence lineage) is ONE deliberate
//     tap away — bottom sheets and single-expansion, never expand-all;
//   · groups collapse to SUMMARIES (chosen model + price), never bare headers;
//   · one honest CTA per card (retailer exit) — no dual-CTA fake checkout;
//   · calm premium density: Amazon-level, generous Arabic line-height.
// The client remains a THIN edit-interface over the server's guarded payload: it
// renders sentences verbatim, mutates a typed mission object, and re-asks the server.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics/track";
import {
  groupLegs, groupByStore, storeProgress, nextExit, budgetBar, fitChip, evidenceChip, energyChip, ageLabel, diffLabel, fmt, parseDelta, setQuantity,
  type LegOut, type RecOut, type Mission, type Chip, type LegGroup, type StoreGroup,
} from "@/lib/agent/home-mission-view";
// ONE BRAIN (ADR-253): the card prefills through the SAME pure parser the server runs —
// the mission card and the API can never drift apart on what a sentence means.
import { parseHomeMission, CORE_MISSION_CATEGORIES, OPTIONAL_MISSION_CATEGORIES } from "@/lib/agent/home-mission";

type Locale = "ar" | "en";

interface PlanResponse {
  version: string;
  state: "ok" | "partial" | "insufficient" | "need_categories";
  understood: Mission;
  legs?: LegOut[];
  allocation?: { feasible: boolean; budget_total: number | null; total_allocated: number | null; remaining: number | null; min_total: number | null; shortfall: number | null };
  mission_notes?: { caveats_ar: string[]; caveats_en: string[] };
  clarify?: { field: string; question_ar: string; question_en: string } | null;
  note_ar?: string; note_en?: string;
}

const EXAMPLE_AR =
  "انتقلت لشقة جديدة. أسرتنا 4 أشخاص. غرفة النوم 16 متر، غرفة الأطفال 14 متر، الصالة 28 متر. ميزانيتي للأجهزة 20 ألف. أهم شيء المكيفات وما أبي أصرف على مواصفات ما أحتاجها.";

// ADR-255: an appliance mission is a multi-day purchase journey. localStorage with a
// 7-day TTL (the iOS ITP script-storage ceiling — longer would silently lie) replaces
// sessionStorage; a restore older than the price-trust window re-asks the server with
// the SAME mission so prices are never silently stale. Server-persisted shareable plan
// URLs are the named future boundary, not faked here.
const STORAGE_KEY = "tw_home_mission_v3";
const STATE_TTL_MS = 7 * 24 * 60 * 60_000;
const PRICE_FRESH_MS = 45 * 60_000; // same trust window as DecisionState
const RETURN_PROMPT_MS = 30 * 60_000; // welcome-back window after a /go exit

const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  air_conditioner: { ar: "التكييف", en: "AC" },
  refrigerator: { ar: "الثلاجة", en: "Fridge" },
  washing_machine: { ar: "الغسالة", en: "Washer" },
  tv: { ar: "التلفزيون", en: "TV" },
  vacuum: { ar: "المكنسة", en: "Vacuum" },
  microwave: { ar: "الميكروويف", en: "Microwave" },
  dishwasher: { ar: "غسالة الصحون", en: "Dishwasher" },
  oven: { ar: "فرن بلت إن", en: "Built-in oven" },
  air_fryer: { ar: "القلاية الهوائية", en: "Air fryer" },
};
const AREA_CHIPS = [12, 16, 20, 25, 30];

const T = (locale: Locale) => ({
  title: locale === "ar" ? "جهّز بيتك بذكاء" : "Equip your home",
  back: locale === "ar" ? "توفيري" : "Tawveeri",
  sub: locale === "ar"
    ? "صف بيتك بكلامك: الغرف ومساحاتها، أفراد الأسرة، الميزانية، وأولوياتك."
    : "Describe your home: rooms and sizes, household, budget, priorities.",
  placeholder: locale === "ar" ? EXAMPLE_AR : "New apartment, family of 4, bedroom 16m², living 28m², budget 20k SAR…",
  tryExample: locale === "ar" ? "جرّب المثال" : "Try the example",
  build: locale === "ar" ? "ابنِ الخطة" : "Build my plan",
  review: locale === "ar" ? "راجع المهمة" : "Review mission",
  startByTapping: locale === "ar" ? "أو ابدأ بالاختيار مباشرة" : "or start by tapping",
  missionCardTitle: locale === "ar" ? "مهمتك" : "Your mission",
  missionCardSub: locale === "ar" ? "عدّل الأعداد والتفاصيل قبل بناء الخطة — الصفر يعني «ما أحتاجه»." : "Adjust counts and details before the plan — zero means \"don't need it\".",
  property: locale === "ar" ? "وش تجهّز؟" : "What are you equipping?",
  propertyOpts: {
    apartment: locale === "ar" ? "شقة" : "Apartment",
    villa: locale === "ar" ? "فيلا" : "Villa",
    partial: locale === "ar" ? "جزء من البيت" : "Part of home",
  } as Record<string, string>,
  addMore: locale === "ar" ? "أجهزة أخرى" : "More appliances",
  acSpaces: locale === "ar" ? "مساحات المكيفات" : "AC spaces",
  acSpacesHint: locale === "ar" ? "كل مكيف له مساحة الغرفة اللي يبرّدها — منها نحسب السعة المناسبة." : "Each AC gets the area it cools — capacity is computed from it.",
  applyAll: locale === "ar" ? "طبّق على الكل" : "Apply to all",
  posture: locale === "ar" ? "أسلوب الصرف" : "Spending style",
  postureOpts: {
    economic: locale === "ar" ? "اقتصادي" : "Economic",
    balanced: locale === "ar" ? "متوازن" : "Balanced",
    premium: locale === "ar" ? "أفضل مواصفات" : "Best specs",
  } as Record<string, string>,
  postureHint: locale === "ar" ? "يغيّر توزيع نفس الميزانية — لا يغيّر الأسعار." : "Redistributes the same budget — never changes prices.",
  cookerNote: locale === "ar"
    ? "الطباخ الغازي (البوتاجاز) غير متوفر في بياناتنا بعد — نغطي أفران البلت إن فقط."
    : "Freestanding gas cookers are not in our data yet — we cover built-in ovens only.",
  building: locale === "ar" ? "نبني خطتك…" : "Building your plan…",
  budget: locale === "ar" ? "الميزانية" : "Budget",
  planCost: locale === "ar" ? "الأجهزة" : "Devices",
  remaining: locale === "ar" ? "المتبقي" : "Left",
  sar: locale === "ar" ? "ر.س" : "SAR",
  edit: locale === "ar" ? "عدّل" : "Edit",
  editPlan: locale === "ar" ? "عدّل الخطة" : "Refine plan",
  decided: (n: number, m: number) => (locale === "ar" ? `${n} من ${m} محسوم` : `${n} of ${m} decided`),
  overviewNotes: (n: number) => (locale === "ar" ? `ملاحظات الدقة (${n})` : `Accuracy notes (${n})`),
  why: locale === "ar" ? "ليش؟" : "Why?",
  alts: locale === "ar" ? "البدائل" : "Alternatives",
  swap: locale === "ar" ? "غيّره" : "Swap",
  chooseThis: locale === "ar" ? "اختر هذا بدلًا" : "Choose this instead",
  chosen: locale === "ar" ? "اخترته أنت" : "your choice",
  // ADR-255 CTA research: fixed short verb label; the retailer is NAMED adjacent to the
  // button (meta line / group header), never inside it — variable-width Arabic labels
  // with store names were the horizontal-overflow class the founder hit on iPhone.
  go: locale === "ar" ? "شوف العرض" : "See the offer",
  at: (store: string) => (locale === "ar" ? `عند ${store}` : `at ${store}`),
  startBuying: locale === "ar" ? "ابدأ الشراء" : "Start buying",
  backToPlan: locale === "ar" ? "رجوع للخطة" : "Back to plan",
  // ADR-256 wording (research-verified against live Saudi UIs): «أكمل الشراء» — the
  // «إتمام» family is the ecosystem's checkout verb; «تابع الشراء» means CONTINUE
  // BROWSING in real Saudi carts (Jarir) and is the wrong connotation. «تم» — never
  // «اشتريت» — because a self-marked purchase is not an observed fact. MSA-warm
  // prompts (dialect lives in marketing, not transactional trust surfaces).
  buyTitle: locale === "ar" ? "خطة مشترياتك" : "Your purchase plan",
  buySub: locale === "ar"
    ? "رتبنا مشترياتك حسب المتاجر. افتح العرض، أكمل شراءك عند المتجر، وارجع نكمل معك."
    : "Your purchases, arranged by store. Open the offer, complete checkout at the store, and come back — we pick up where you left off.",
  storeCta: (store: string) => (locale === "ar" ? `أكمل الشراء من ${store}` : `Complete your purchase at ${store}`),
  bought: locale === "ar" ? "تم" : "Done",
  boughtChip: locale === "ar" ? "تم الشراء ✓" : "Purchased ✓",
  boughtProgress: (n: number, m: number) => (locale === "ar" ? `تم ${n} من ${m}` : `${n} of ${m} done`),
  storesProgress: (n: number, m: number) => (locale === "ar" ? `أنهيت ${n} من ${m} متاجر` : `${n} of ${m} stores finished`),
  storeDone: (n: number, m: number) => (locale === "ar" ? `تم ${n} من ${m}` : `${n} of ${m} done`),
  storeItems: (n: number) => (locale === "ar" ? (n === 1 ? "جهاز واحد" : n === 2 ? "جهازان" : `${n} أجهزة`) : `${n} item${n === 1 ? "" : "s"}`),
  welcomeBack: (store: string) => (locale === "ar" ? `رجعت من ${store}؟ هل أتممت الشراء؟` : `Back from ${store}? Did you complete the purchase?`),
  allBought: locale === "ar" ? "تمت كلها ✓" : "All bought ✓",
  notYet: locale === "ar" ? "ليس بعد" : "Not yet",
  missionDone: locale === "ar" ? "تمت كل مشتريات الخطة ✓" : "All plan purchases done ✓",
  refreshedNote: locale === "ar" ? "حدّثنا الأسعار — خطتك محفوظة." : "Prices refreshed — your plan is saved.",
  allEvidence: (n: number) => (locale === "ar" ? `كل الأدلة (${n})` : `All evidence (${n})`),
  saveDown: (x: number) => (locale === "ar" ? `وفّر ${fmt(x)} ر.س — الأرخص المؤهل` : `Save ${fmt(x)} SAR — cheapest eligible`),
  payUp: (x: number) => (locale === "ar" ? `‏+${fmt(x)} ر.س — وش يتحسن؟` : `+${fmt(x)} SAR — what improves?`),
  followup: locale === "ar" ? "غيّر أي شيء… (خلها 16 ألف · شيل التلفزيون)" : "Change anything… (make it 16k · drop the TV)",
  send: locale === "ar" ? "طبّق" : "Apply",
  area: locale === "ar" ? "المساحة م²" : "Area m²",
  update: locale === "ar" ? "تحديث" : "Update",
  household: locale === "ar" ? "أفراد الأسرة" : "Household",
  budgetSar: locale === "ar" ? "الميزانية (ر.س)" : "Budget (SAR)",
  delta: locale === "ar" ? "وش تغيّر؟" : "What changed?",
  raiseBy: (x: number) => (locale === "ar" ? `زد الميزانية ${fmt(x)}` : `Raise budget by ${fmt(x)}`),
  newMission: locale === "ar" ? "مهمة جديدة" : "New mission",
  errorMsg: locale === "ar" ? "صار خطأ — جرّب مرة ثانية." : "Something went wrong — try again.",
  ai: locale === "ar"
    ? "الترتيب محرّك حتمي يقرأ أدلة أسعارنا الموثقة — لا ذكاء اصطناعي يقرر أو يخترع أسعارًا، ولا عمولة تؤثر على الترتيب."
    : "Ranking is a deterministic engine over documented price evidence — no AI decides or invents prices; no commission affects ranking.",
  emphasisLabel: {
    high: locale === "ar" ? "أولوية عالية" : "high priority",
    deprioritized: locale === "ar" ? "أقل أهمية" : "lower priority",
  } as Record<string, string>,
  worst: {
    needs_input: locale === "ar" ? "يحتاج معلومة" : "needs input",
    insufficient: locale === "ar" ? "أدلة غير كافية" : "insufficient evidence",
    stale_or_single: locale === "ar" ? "تحقّق من الأدلة" : "check evidence",
  } as Record<string, string>,
});

const chipCls = (tone: Chip["tone"]) =>
  tone === "good"
    ? "bg-success-50 text-success-800 dark:bg-success-950 dark:text-success-300"
    : tone === "warn"
      ? "bg-warning-50 text-warning-800 dark:bg-warning-950 dark:text-warning-300"
      : "bg-surface-container text-on-surface-variant";

function ChipEl({ chip }: { chip: Chip }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] leading-4 ${chipCls(chip.tone)}`}>{chip.text}</span>;
}

// ── Quantity stepper (module scope so typing never remounts the input / loses focus):
//    hybrid text-field stepper, ≥44pt targets, digits LTR always. DOM order [−][value][+]
//    → LTR renders − left / + right; RTL renders + left / − right (the localization
//    mirroring the intake research mandates). ──
function Stepper({ value, onChange, max }: { value: number; onChange: (v: number) => void; max: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" aria-label="−" disabled={value <= 0}
        onClick={() => onChange(value - 1)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-outline-variant text-lg font-bold text-on-surface disabled:opacity-30">−</button>
      <input type="text" inputMode="numeric" dir="ltr" value={value}
        onChange={(e) => { const n = Number(e.target.value.replace(/[^0-9]/g, "")); if (Number.isFinite(n)) onChange(Math.min(max, n)); }}
        className="h-11 w-11 rounded-lg border border-outline-variant bg-white text-center text-sm font-bold tabular-nums dark:bg-gray-900"
        aria-label="quantity" />
      <button type="button" aria-label="+" disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-outline-variant text-lg font-bold text-on-surface disabled:opacity-30">+</button>
    </div>
  );
}

// ── The mission card (ADR-253): ONE editable structured mission — used both as the
//    pre-plan intake stage and inside the refine sheet. Purely mutates a Mission object;
//    the single CTA is the generate gate. Module scope: its inputs must keep focus. ──
function MissionCard({ m, onChange, onSubmit, submitLabel, t, isAr, loading }: {
  m: Mission; onChange: (m: Mission) => void; onSubmit: () => void; submitLabel: string;
  t: ReturnType<typeof T>; isAr: boolean; loading: boolean;
}) {
  const qty = (cat: string) => m.quantities[cat] ?? (m.categories[cat] && m.categories[cat] !== "excluded" ? 1 : 0);
  const activeOptional = OPTIONAL_MISSION_CATEGORIES.filter((c) => qty(c) > 0);
  const inactiveOptional = OPTIONAL_MISSION_CATEGORIES.filter((c) => qty(c) === 0);
  const needsHousehold = qty("refrigerator") > 0 || qty("washing_machine") > 0 || qty("dishwasher") > 0;
  const acQty = qty("air_conditioner");
  const [applyAllArea, setApplyAllArea] = useState("");
  const mentionsCooker = m.unsupported_mentions.some((u) => /فرن|بوتاجاز/.test(u));

  const qtyRow = (cat: string) => (
    <div key={cat} className="flex min-h-[52px] items-center justify-between gap-3 py-1">
      <p className="text-sm font-semibold text-on-surface">{isAr ? CATEGORY_LABELS[cat].ar : CATEGORY_LABELS[cat].en}</p>
      <Stepper value={qty(cat)} max={cat === "air_conditioner" ? 8 : 4} onChange={(v) => onChange(setQuantity(m, cat, v))} />
    </div>
  );

  return (
    <section className="mt-3 rounded-2xl border border-outline-variant bg-white p-4 dark:bg-gray-900">
      <p className="text-sm font-bold">{t.missionCardTitle}</p>
      <p className="mt-0.5 text-[11px] leading-5 text-on-surface-variant">{t.missionCardSub}</p>

      {/* property — context only, never a quantity source */}
      <p className="mt-3 text-xs font-semibold text-on-surface-variant">{t.property}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {(["apartment", "villa", "partial"] as const).map((p) => (
          <button key={p} type="button"
            onClick={() => onChange({ ...m, property_type: m.property_type === p ? null : p })}
            className={`min-h-[40px] rounded-full border px-4 py-2 text-xs font-semibold ${m.property_type === p ? "border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300" : "border-outline-variant text-on-surface-variant"}`}>
            {t.propertyOpts[p]}
          </button>
        ))}
      </div>

      {/* core quantity rows — zero valid */}
      <div className="mt-3 divide-y divide-outline-variant/50">
        {CORE_MISSION_CATEGORIES.map((cat) => qtyRow(cat))}
        {activeOptional.map((cat) => qtyRow(cat))}
      </div>

      {/* optional add-chips (disclosure-tier categories — never auto-added) */}
      {inactiveOptional.length > 0 && (
        <>
          <p className="mt-2 text-xs font-semibold text-on-surface-variant">{t.addMore}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {inactiveOptional.map((cat) => (
              <button key={cat} type="button" onClick={() => onChange(setQuantity(m, cat, 1))}
                className="min-h-[40px] rounded-full border border-dashed border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
                + {isAr ? CATEGORY_LABELS[cat].ar : CATEGORY_LABELS[cat].en}
              </button>
            ))}
          </div>
        </>
      )}
      {mentionsCooker && (
        <p className="mt-2 rounded-lg bg-warning-50 p-2 text-[11px] leading-5 text-warning-800 dark:bg-warning-950 dark:text-warning-200">{t.cookerNote}</p>
      )}

      {/* AC target spaces — one per purchase unit (room ≠ device) */}
      {acQty > 0 && (
        <div className="mt-3 rounded-xl bg-surface-container-lowest p-3">
          <p className="text-xs font-bold text-on-surface">{t.acSpaces}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">{t.acSpacesHint}</p>
          {acQty > 1 && (
            <div className="mt-2 flex items-center gap-2">
              <input type="text" inputMode="numeric" dir="ltr" value={applyAllArea} placeholder="م²"
                onChange={(e) => setApplyAllArea(e.target.value.replace(/[^0-9]/g, ""))}
                className="h-10 w-16 rounded-lg border border-outline-variant bg-white text-center text-sm tabular-nums dark:bg-gray-900" />
              <button type="button" disabled={!applyAllArea}
                onClick={() => {
                  const a = Number(applyAllArea);
                  if (a >= 5 && a <= 200) onChange({ ...m, spaces: m.spaces.map((s) => ({ ...s, area_m2: a })) });
                }}
                className="min-h-[40px] rounded-lg bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700 disabled:opacity-40 dark:bg-primary-950 dark:text-primary-300">
                {t.applyAll}
              </button>
            </div>
          )}
          <div className="mt-2 space-y-2">
            {m.spaces.map((s, i) => (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-on-surface">{isAr ? s.label_ar : s.label_en}</p>
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {AREA_CHIPS.map((a) => (
                    <button key={a} type="button"
                      onClick={() => onChange({ ...m, spaces: m.spaces.map((x, j) => (j === i ? { ...x, area_m2: a } : x)) })}
                      className={`h-9 min-w-[36px] rounded-lg border px-1 text-[11px] tabular-nums ${s.area_m2 === a ? "border-primary-600 bg-primary-50 font-bold text-primary-700 dark:bg-primary-950 dark:text-primary-300" : "border-outline-variant text-on-surface-variant"}`}>
                      {a}
                    </button>
                  ))}
                  <input type="text" inputMode="numeric" dir="ltr" aria-label={t.area}
                    value={s.area_m2 != null && !AREA_CHIPS.includes(s.area_m2) ? s.area_m2 : ""}
                    placeholder="م²"
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, "");
                      const a = v ? Number(v) : null;
                      onChange({ ...m, spaces: m.spaces.map((x, j) => (j === i ? { ...x, area_m2: a != null && a >= 5 && a <= 200 ? a : a != null && a > 0 && a < 5 ? x.area_m2 : null } : x)) });
                    }}
                    className="h-9 w-12 rounded-lg border border-outline-variant bg-white text-center text-[11px] tabular-nums dark:bg-gray-900" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* household (asked ONCE, only when a capacity-sized category is in the mission) */}
      {needsHousehold && (
        <label className="mt-3 block text-xs font-semibold text-on-surface-variant">
          {t.household}
          <input type="text" inputMode="numeric" dir="ltr" value={m.household_size ?? ""}
            onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); onChange({ ...m, household_size: v ? Math.min(20, Number(v)) : null }); }}
            className="mt-1 h-11 w-24 rounded-lg border border-outline-variant bg-white px-3 text-center text-sm tabular-nums dark:bg-gray-900" />
        </label>
      )}

      {/* budget + posture (posture redistributes the SAME budget — never invents prices) */}
      <label className="mt-3 block text-xs font-semibold text-on-surface-variant">
        {t.budgetSar}
        <input type="text" inputMode="numeric" dir="ltr" value={m.budget_total ?? ""}
          onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); onChange({ ...m, budget_total: v ? Math.min(500000, Number(v)) : null }); }}
          className="mt-1 h-11 w-36 rounded-lg border border-outline-variant bg-white px-3 text-center text-sm tabular-nums dark:bg-gray-900" />
      </label>
      <p className="mt-3 text-xs font-semibold text-on-surface-variant">{t.posture}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {(["economic", "balanced", "premium"] as const).map((p) => (
          <button key={p} type="button"
            onClick={() => onChange({ ...m, posture: m.posture === p ? null : p })}
            className={`min-h-[40px] rounded-full border px-4 py-2 text-xs font-semibold ${m.posture === p ? "border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300" : "border-outline-variant text-on-surface-variant"}`}>
            {t.postureOpts[p]}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-on-surface-variant">{t.postureHint}</p>

      <button type="button" onClick={onSubmit} disabled={loading || Object.values(m.quantities).every((q) => !q)}
        className="mt-4 min-h-[48px] w-full rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
        {loading ? t.building : submitLabel}
      </button>
    </section>
  );
}


export function HomeMissionClient({ locale }: { locale: Locale }) {
  const t = useMemo(() => T(locale), [locale]);
  const isAr = locale === "ar";
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Mission | null>(null); // mission card stage (pre-plan)
  const [refineDraft, setRefineDraft] = useState<Mission | null>(null); // refine-sheet edits (applied on one CTA)
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [prevPlan, setPrevPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [followup, setFollowup] = useState("");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Record<string, string>>({});
  const [openWhy, setOpenWhy] = useState<string | null>(null);      // one expansion at a time
  const [altsFor, setAltsFor] = useState<string | null>(null);      // bottom sheet: leg_id
  const [refineOpen, setRefineOpen] = useState(false);
  const [deltaDismissed, setDeltaDismissed] = useState(false);
  // ── Purchase handoff (ADR-255) ──
  const [purchaseMode, setPurchaseMode] = useState(false);
  const [purchased, setPurchased] = useState<Record<string, true>>({});          // leg_id → done (per-item data truth)
  // ADR-256: the RETAILER is the completion unit — the return marker is store-scoped
  // («رجعت من نجم الأجهزة — وش تم؟» covers every open item at that store).
  const [exitMarker, setExitMarker] = useState<{ store: string; ts: number } | null>(null);
  const [refreshedNote, setRefreshedNote] = useState(false);
  const [planTs, setPlanTs] = useState<number>(0);                               // when current prices were fetched
  const startedTracked = useRef(false);
  const restoredRef = useRef(false);
  const completedStoresRef = useRef<Set<string>>(new Set());
  const missionCompleteRef = useRef(false);

  // ── Persistence (ADR-255): a purchase journey spans days — localStorage, 7-day TTL.
  //    A restore past the 45-min price-trust window re-asks the server with the SAME
  //    mission (checklist marks + pins survive; prices are never silently stale). ──
  useEffect(() => {
    // Arm the writer FIRST: the early no-saved-state return must never leave the save
    // effect disarmed (a fresh visitor's first plan has to persist).
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        plan: PlanResponse; excludedIds: string[]; pinnedIds: Record<string, string>;
        purchased?: Record<string, true>; purchaseMode?: boolean;
        exitMarker?: { store: string; ts: number } | null; ts: number;
      };
      if (Date.now() - saved.ts < STATE_TTL_MS && saved.plan?.understood) {
        setPlan(saved.plan); setExcludedIds(saved.excludedIds ?? []); setPinnedIds(saved.pinnedIds ?? {});
        setPurchased(saved.purchased ?? {}); setPurchaseMode(saved.purchaseMode ?? false);
        setPlanTs(saved.ts);
        track("home_mission", { meta: { step: "resumed", age_min: Math.round((Date.now() - saved.ts) / 60000) } });
        if (saved.exitMarker?.store && Date.now() - saved.exitMarker.ts < RETURN_PROMPT_MS) {
          setExitMarker({ store: saved.exitMarker.store, ts: saved.exitMarker.ts });
          track("home_mission", { meta: { step: "returned_from_retailer", store: saved.exitMarker.store, via: "reload" } });
        }
        if (Date.now() - saved.ts > PRICE_FRESH_MS) {
          setRefreshedNote(true);
          void call({ mission: saved.plan.understood, excluded_ids: saved.excludedIds ?? [], pinned_ids: saved.pinnedIds ?? {} }, "resume_refresh");
        }
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      if (plan) localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan, excludedIds, pinnedIds, purchased, purchaseMode, exitMarker, ts: Date.now() }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }
  }, [plan, excludedIds, pinnedIds, purchased, purchaseMode, exitMarker]);

  // ── Welcome-back moment: iOS restores the page via bfcache (pageshow persisted) or a
  //    cold reload (handled by the restore above). Either way, a recent /go exit that
  //    was not marked done resurfaces as a question, never an assumption. ──
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setExitMarker((m) => {
        if (m && Date.now() - m.ts < RETURN_PROMPT_MS) {
          track("home_mission", { meta: { step: "returned_from_retailer", store: m.store, via: "bfcache" } });
          return { ...m };
        }
        return null;
      });
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const call = useCallback(async (body: Record<string, unknown>, step: string) => {
    setLoading(true); setError(false); setDeltaDismissed(false);
    if (step !== "resume_refresh" && step !== "purchase_refresh") setRefreshedNote(false);
    try {
      const res = await fetch("/api/v1/agent/home-mission", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as PlanResponse;
      setPlan((old) => { setPrevPlan(old); return data; });
      setPlanTs(Date.now());
      track("home_mission", { meta: { step, state: data.state, legs: data.legs?.length ?? 0, feasible: data.allocation?.feasible ?? null } });
    } catch {
      setError(true);
      track("error", { source: "home_mission", meta: { step } });
    } finally { setLoading(false); }
  }, []);

  const mission = plan?.understood ?? null;

  const rePlan = useCallback((m: Mission, step: string, over?: { excluded?: string[]; pinned?: Record<string, string> }) => {
    void call({ mission: m, excluded_ids: over?.excluded ?? excludedIds, pinned_ids: over?.pinned ?? pinnedIds }, step);
  }, [call, excludedIds, pinnedIds]);

  // ── Intake (ADR-253): NL → SAME parser as the server → editable mission card →
  //    ONE generate gate. The card is the understanding-confirmation surface. ──
  const emptyMission = (): Mission => ({
    spaces: [], household_size: null, budget_total: null, posture: null, property_type: null,
    categories: {}, quantities: {}, priorities: [], deprioritized_priorities: [],
    excluded_priorities: [], whole_home: false, unsupported_mentions: [], parsed_from_text: "",
  });

  const review = useCallback((fromText: string | null) => {
    if (loading) return;
    if (!startedTracked.current) { track("home_mission", { meta: { step: "started" }, query_text: (fromText ?? "").slice(0, 200) }); startedTracked.current = true; }
    let m: Mission = fromText?.trim() ? (parseHomeMission(fromText) as unknown as Mission) : emptyMission();
    // Present categories default to quantity 1 on the card (AC follows its named spaces).
    for (const cat of Object.keys(m.categories)) {
      if (m.categories[cat] === "excluded") { m = setQuantity(m, cat, 0); continue; }
      if (m.quantities[cat] == null) m = setQuantity(m, cat, cat === "air_conditioner" ? Math.max(1, m.spaces.length || 1) : 1);
      else m = setQuantity(m, cat, m.quantities[cat]!); // normalizes AC spaces to the quantity
    }
    track("home_mission", { meta: { step: "reviewed", cats: Object.keys(m.quantities).length } });
    setDraft(m);
  }, [loading]);

  const generate = useCallback((m: Mission) => {
    setExcludedIds([]); setPinnedIds({}); setOpenWhy(null); setDraft(null);
    setPurchased({}); setPurchaseMode(false); setExitMarker(null);
    completedStoresRef.current = new Set(); missionCompleteRef.current = false;
    void call({ mission: m, excluded_ids: [], pinned_ids: {} }, "plan");
  }, [call]);

  // ── ADR-255/256: marking a leg purchased PINS its exact product (existing narrow
  //    pinned_ids capability — allocation treats it as fixed cost), so later refreshes
  //    can never swap a device the customer already bought. Unmarking releases the pin.
  //    The retailer is the UX completion unit; these per-item marks stay the data truth. ──
  const markPurchased = useCallback((legId: string, canonicalId: string, done: boolean) => {
    if (!mission) return;
    setPurchased((p) => { const n = { ...p }; if (done) n[legId] = true; else delete n[legId]; return n; });
    track("home_mission", { canonical_id: canonicalId, meta: { step: done ? "item_marked_purchased" : "item_unmarked", leg: legId } });
    if (done && pinnedIds[legId] !== canonicalId) {
      const nextPinned = { ...pinnedIds, [legId]: canonicalId };
      setPinnedIds(nextPinned);
      rePlan(mission, "purchased_pin", { pinned: nextPinned });
    }
  }, [mission, pinnedIds, rePlan]);

  /** «تمت كلها» — batch-complete a retailer: all its open items marked + pinned in ONE re-plan. */
  const markStorePurchased = useCallback((group: StoreGroup) => {
    if (!mission) return;
    const open = group.legs.filter((l) => !purchased[l.leg_id] && l.picked);
    if (!open.length) return;
    setPurchased((p) => { const n = { ...p }; for (const l of open) n[l.leg_id] = true; return n; });
    setExitMarker(null);
    const nextPinned = { ...pinnedIds };
    let changed = false;
    for (const l of open) { if (nextPinned[l.leg_id] !== l.picked!.canonical_id) { nextPinned[l.leg_id] = l.picked!.canonical_id; changed = true; } }
    track("home_mission", { meta: { step: "item_marked_purchased", store: group.store, batch: open.length } });
    if (changed) { setPinnedIds(nextPinned); rePlan(mission, "purchased_pin", { pinned: nextPinned }); }
  }, [mission, purchased, pinnedIds, rePlan]);

  const onGoExit = useCallback((leg: LegOut, r: RecOut, source: string) => {
    setExitMarker({ store: r.stores[0] ?? "—", ts: Date.now() });
    track("go_click", { canonical_id: r.canonical_id, store: r.stores[0] ?? null, category: leg.category, source });
  }, []);

  const applyFollowup = useCallback(() => {
    if (!mission || !followup.trim()) return;
    const delta = parseDelta(followup, mission);
    setFollowup(""); setRefineOpen(false);
    if (delta) {
      track("home_mission", { meta: { step: "refined", delta: delta.label } });
      rePlan(delta.next, "refined");
    } else {
      setText(followup); setExcludedIds([]); setPinnedIds({});
      void call({ text: followup }, "new_mission");
    }
  }, [mission, followup, rePlan, call]);

  const reject = useCallback((legId: string, canonicalId: string) => {
    if (!mission) return;
    const nextExcluded = [...excludedIds, canonicalId];
    const nextPinned = { ...pinnedIds }; delete nextPinned[legId];
    setExcludedIds(nextExcluded); setPinnedIds(nextPinned);
    track("home_mission", { canonical_id: canonicalId, meta: { step: "rejected" } });
    rePlan(mission, "rejected", { excluded: nextExcluded, pinned: nextPinned });
  }, [mission, excludedIds, pinnedIds, rePlan]);

  const pin = useCallback((legId: string, canonicalId: string) => {
    if (!mission) return;
    const nextPinned = { ...pinnedIds, [legId]: canonicalId };
    setPinnedIds(nextPinned); setAltsFor(null);
    track("home_mission", { canonical_id: canonicalId, meta: { step: "pinned", leg: legId } });
    rePlan(mission, "pinned", { pinned: nextPinned });
  }, [mission, pinnedIds, rePlan]);

  const groups: LegGroup[] = useMemo(() => (plan?.legs ? groupLegs(plan.legs) : []), [plan?.legs]);
  const okLegs = plan?.legs?.filter((l) => l.state === "ok") ?? [];
  const bar = budgetBar(plan?.allocation?.budget_total ?? null, plan?.allocation?.total_allocated ?? null);
  // ADR-255/256 purchase checklist: the same picks regrouped by exit retailer (no new claims).
  const storeGroups: StoreGroup[] = useMemo(() => (plan?.legs ? groupByStore(plan.legs) : []), [plan?.legs]);
  const buyableCount = storeGroups.reduce((n, g) => n + g.legs.length, 0);
  const boughtCount = storeGroups.reduce((n, g) => n + g.legs.filter((l) => purchased[l.leg_id]).length, 0);
  const storesDoneCount = storeGroups.filter((g) => storeProgress(g, purchased).complete).length;
  // The return prompt covers every still-open item at the store the customer exited to.
  const markerGroup = exitMarker ? storeGroups.find((g) => g.store === exitMarker.store) ?? null : null;
  const markerOpenLegs = markerGroup ? markerGroup.legs.filter((l) => !purchased[l.leg_id]) : [];

  // ── Completion telemetry (ADR-256): retailer_completed fires once per store per plan;
  //    mission_completed once when every buyable item is marked. Never equates
  //    opened-retailer with purchased — marks come only from the customer's hand. ──
  useEffect(() => {
    for (const g of storeGroups) {
      if (storeProgress(g, purchased).complete && !completedStoresRef.current.has(g.store)) {
        completedStoresRef.current.add(g.store);
        track("home_mission", { meta: { step: "retailer_completed", store: g.store, items: g.legs.length } });
      }
    }
    if (buyableCount > 0 && boughtCount === buyableCount && !missionCompleteRef.current) {
      missionCompleteRef.current = true;
      track("home_mission", { meta: { step: "mission_completed", items: buyableCount, stores: storeGroups.length } });
    }
    // A fully-answered return question dismisses itself.
    setExitMarker((m) => {
      if (!m) return m;
      const g = storeGroups.find((x) => x.store === m.store);
      return g && g.legs.every((l) => purchased[l.leg_id]) ? null : m;
    });
  }, [purchased, storeGroups, boughtCount, buyableCount]);

  // Decision Delta (client-side diff of two guarded server plans — no new claims).
  const delta = useMemo(() => {
    if (!plan?.legs || !prevPlan?.legs) return null;
    const prevBy = new Map(prevPlan.legs.map((l) => [l.leg_id, l]));
    const name = (r?: RecOut | null) => (isAr ? r?.title_ar ?? r?.title_en : r?.title_en ?? r?.title_ar) ?? "—";
    const changes: string[] = [];
    for (const l of plan.legs) {
      const p = prevBy.get(l.leg_id);
      if (!p) continue;
      const a = p.state === "ok" ? p.picked : null;
      const b = l.state === "ok" ? l.picked : null;
      if ((a?.canonical_id ?? null) !== (b?.canonical_id ?? null)) {
        const d = a?.unit_price != null && b?.unit_price != null ? b.unit_price - a.unit_price : null;
        changes.push(`${isAr ? l.label_ar : l.label_en}: ${name(a)} ← ${name(b)}${d != null ? ` (${d >= 0 ? "+" : "−"}${fmt(Math.abs(d))} ${t.sar})` : ""}`);
      }
    }
    const t0 = prevPlan.allocation?.total_allocated, t1 = plan.allocation?.total_allocated;
    if (t0 != null && t1 != null && t0 !== t1) changes.push(`${t.planCost}: ${fmt(t0)} ← ${fmt(t1)} ${t.sar}`);
    return changes.length ? changes : null;
  }, [plan, prevPlan, isAr, t]);

  const recName = (r: RecOut) => (isAr ? r.title_ar ?? r.title_en : r.title_en ?? r.title_ar) ?? "";

  const scrollToGroup = (key: string) => {
    document.getElementById(`grp-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    track("home_mission", { meta: { step: "nav_group", group: key } });
  };

  // ── The decision card (compact by default; WHY expands one-at-a-time) ──
  const LegCard = ({ leg, grouped }: { leg: LegOut; grouped: boolean }) => {
    if (leg.state === "needs_area") {
      return (
        <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 dark:border-warning-800 dark:bg-warning-950">
          <p className="text-[13px] font-semibold text-on-surface">{isAr ? leg.label_ar : leg.label_en}</p>
          <p className="mt-1 text-xs leading-5 text-warning-800 dark:text-warning-200">{isAr ? leg.question_ar : leg.question_en}</p>
          <AreaFix leg={leg} />
        </div>
      );
    }
    if (leg.state === "insufficient" || !leg.picked) {
      return (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
          <p className="text-[13px] font-semibold text-on-surface">{isAr ? leg.label_ar : leg.label_en}</p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">{isAr ? leg.note_ar : leg.note_en}</p>
        </div>
      );
    }
    const r = leg.picked;
    const chips = [fitChip(leg, locale), evidenceChip(r, locale), energyChip(r, locale)].filter(Boolean) as Chip[];
    const age = ageLabel(r.data_age_hours, locale);
    const whyOpen = openWhy === leg.leg_id;
    return (
      <div className="rounded-xl border border-outline-variant bg-white p-3 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-surface-container-lowest">
            {r.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {grouped && leg.space && (
              <p className="text-[11px] font-semibold text-on-surface-variant">
                {isAr ? leg.space.label_ar : leg.space.label_en}
                {leg.space.area_m2 != null && ` · ${leg.space.area_m2}م²`}
              </p>
            )}
            <p className="line-clamp-2 min-w-0 text-[13px] font-semibold leading-5 text-on-surface [overflow-wrap:anywhere]"><bdi dir="auto">{recName(r)}</bdi></p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-on-surface">
              {r.unit_price != null ? <>{fmt(r.unit_price)} <span className="text-xs font-semibold">{t.sar}</span></> : "—"}
              {leg.pinned && !purchased[leg.leg_id] && <span className="ms-2 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">{t.chosen}</span>}
              {purchased[leg.leg_id] && <span className="ms-2 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-800 dark:bg-success-950 dark:text-success-300">{t.boughtChip}</span>}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">{chips.slice(0, 3).map((c, i) => <ChipEl key={i} chip={c} />)}</div>
            {/* The retailer is NAMED here, adjacent to the fixed-label CTA (ADR-255) */}
            {(r.stores[0] || age) && (
              <p className="mt-1 min-w-0 truncate text-[11px] text-on-surface-variant">
                {[r.stores[0] ? t.at(r.stores[0]) : null, age].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          {r.go_url && (
            <a href={r.go_url} rel="noopener nofollow"
              onClick={() => onGoExit(leg, r, "home_mission")}
              className="min-h-[44px] min-w-0 flex-1 rounded-lg bg-primary-600 px-3 py-2.5 text-center text-[13px] font-bold text-white">
              {t.go}
            </a>
          )}
          <button aria-expanded={whyOpen} onClick={() => setOpenWhy(whyOpen ? null : leg.leg_id)}
            className="min-h-[44px] shrink-0 rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-semibold text-on-surface-variant">
            {t.why}
          </button>
          <button onClick={() => { setAltsFor(leg.leg_id); track("home_mission", { meta: { step: "alts_open", leg: leg.leg_id } }); }}
            className="min-h-[44px] shrink-0 rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-semibold text-on-surface-variant"
            disabled={!leg.alternatives?.length}>
            {t.alts}
          </button>
        </div>

        {whyOpen && (
          <div className="mt-3 rounded-lg bg-surface-container-lowest p-3">
            <p className="text-[11px] font-semibold text-on-surface-variant">{isAr ? r.claim_ar : r.claim_en}</p>
            <ul className="mt-2 space-y-1">
              {r.headline_reasons.map((i) => r.reasons_ar[i]).filter(Boolean).map((reason, i) => (
                <li key={i} className="text-xs leading-5 text-on-surface">• {reason}</li>
              ))}
            </ul>
            {r.reasons_ar.length > r.headline_reasons.length && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary-700 dark:text-primary-300">{t.allEvidence(r.reasons_ar.length)}</summary>
                <ul className="mt-1 space-y-1">
                  {r.reasons_ar.map((reason, i) => (
                    <li key={i} className="text-[11px] leading-5 text-on-surface-variant">• {reason}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {leg.trade?.downgrade_saving != null && leg.trade.downgrade_saving > 0 && leg.trade.cheapest_id && (
                <button onClick={() => pin(leg.leg_id, leg.trade!.cheapest_id!)} disabled={loading}
                  className="min-h-[36px] rounded-lg bg-success-50 px-3 py-1.5 text-[11px] font-semibold text-success-800 dark:bg-success-950 dark:text-success-300">
                  ↓ {t.saveDown(leg.trade.downgrade_saving)}
                </button>
              )}
              {leg.trade?.next_upgrade && (
                <button onClick={() => pin(leg.leg_id, leg.trade!.next_upgrade!.canonical_id)} disabled={loading}
                  className="min-h-[36px] rounded-lg bg-surface-container px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant">
                  ↑ {t.payUp(leg.trade.next_upgrade.extra_cost)}
                </button>
              )}
              <button onClick={() => reject(leg.leg_id, r.canonical_id)} disabled={loading}
                className="min-h-[36px] rounded-lg border border-outline-variant px-3 py-1.5 text-[11px] text-on-surface-variant">
                {t.swap}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const AreaFix = ({ leg }: { leg: LegOut }) => {
    const [v, setV] = useState("");
    return (
      <div className="mt-2 flex items-center gap-2">
        <input type="number" inputMode="numeric" min={5} max={200} value={v} onChange={(e) => setV(e.target.value)}
          placeholder={t.area} aria-label={t.area}
          className="w-24 rounded-lg border border-outline-variant bg-white p-2 text-sm tabular-nums dark:bg-gray-900" />
        <button disabled={!v || loading}
          onClick={() => {
            if (!mission || !leg.space) return;
            const spaces = mission.spaces.map((s) => (s.key === leg.space!.key ? { ...s, area_m2: Number(v) } : s));
            track("home_mission", { meta: { step: "clarified", field: "room_area" } });
            rePlan({ ...mission, spaces }, "clarified");
          }}
          className="min-h-[40px] rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {t.update}
        </button>
      </div>
    );
  };

  const altsLeg = altsFor ? plan?.legs?.find((l) => l.leg_id === altsFor) : null;

  return (
    // overflow-x-clip: iOS Safari lets users rubber-band INTO sub-pixel horizontal
    // overflow (RTL spills LEFT); clip on the page wrapper removes the class entirely.
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen overflow-x-clip bg-surface-container-lowest text-on-surface">

      {/* ── MISSION HEADER — compact, sticky, mission-mode (no global nav) ── */}
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-white/95 backdrop-blur dark:bg-gray-950/95">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2">
          <Link href={`/${locale}`} aria-label={t.back}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant">
            {isAr ? "→" : "←"}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{t.title}</p>
            {plan?.allocation && okLegs.length > 0 && (
              <p className="truncate text-[11px] tabular-nums text-on-surface-variant">
                {plan.allocation.budget_total != null && <>{t.budget} {fmt(plan.allocation.budget_total)} · </>}
                {plan.allocation.total_allocated != null && <>{t.planCost} <b className="text-on-surface">{fmt(plan.allocation.total_allocated)}</b></>}
                {plan.allocation.remaining != null && <> · {t.remaining} {fmt(plan.allocation.remaining)}</>}
              </p>
            )}
          </div>
          {plan && plan.state !== "need_categories" && (
            <button onClick={() => setRefineOpen(true)}
              className="min-h-[40px] rounded-lg bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
              {t.edit}
            </button>
          )}
        </div>
        {/* ── Category anchor chips (sticky with header; hidden in purchase mode) ── */}
        {!purchaseMode && groups.length > 1 && (
          <nav aria-label={isAr ? "أقسام الخطة" : "Plan sections"} className="mx-auto max-w-2xl overflow-x-auto px-3 pb-2">
            <div className="flex w-max gap-2">
              {groups.map((g) => (
                <button key={g.key} onClick={() => scrollToGroup(g.key)}
                  className="min-h-[36px] whitespace-nowrap rounded-full border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface dark:bg-gray-900">
                  {isAr ? g.label_ar : g.label_en}
                  {g.legs.length > 1 && ` ${g.legs.length}`}
                  {g.worst === "ok" ? " ✓" : g.worst === "needs_input" ? " ؟" : " ⚠"}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3">

        {/* ── WELCOME BACK (ADR-256): the RETURN QUESTION is retailer-scoped — «رجعت من
            نجم الأجهزة؟ هل أتممت الشراء؟» covering every open item at that store.
            «تمت كلها» / per-item marks / «ليس بعد». Purchase is never assumed. ── */}
        {markerGroup && markerOpenLegs.length > 0 && (
          <div className="mt-2 rounded-xl border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-950">
            <p className="text-[13px] font-bold text-success-900 dark:text-success-100">{t.welcomeBack(markerGroup.store)}</p>
            {markerOpenLegs.length > 1 && (
              <div className="mt-1 space-y-1">
                {markerOpenLegs.map((l) => (
                  <button key={l.leg_id} onClick={() => markPurchased(l.leg_id, l.picked!.canonical_id, true)}
                    className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg border border-success-200 bg-white px-3 py-1.5 text-start dark:border-success-800 dark:bg-gray-900">
                    <span className="line-clamp-1 min-w-0 flex-1 text-[11px] text-on-surface"><bdi dir="auto">{recName(l.picked!)}</bdi></span>
                    <span className="shrink-0 text-[11px] font-bold text-success-700 dark:text-success-300">{t.bought} ✓</span>
                  </button>
                ))}
              </div>
            )}
            {markerOpenLegs.length === 1 && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-success-800 dark:text-success-200"><bdi dir="auto">{recName(markerOpenLegs[0].picked!)}</bdi></p>
            )}
            <div className="mt-2 flex gap-2">
              <button onClick={() => { markStorePurchased(markerGroup); }}
                className="min-h-[40px] rounded-lg bg-success-600 px-4 py-2 text-xs font-bold text-white">
                {markerOpenLegs.length > 1 ? t.allBought : `${t.bought} ✓`}
              </button>
              <button onClick={() => setExitMarker(null)}
                className="min-h-[40px] rounded-lg border border-success-300 px-4 py-2 text-xs font-semibold text-success-800 dark:border-success-700 dark:text-success-200">
                {t.notYet}
              </button>
            </div>
          </div>
        )}
        {refreshedNote && plan && (
          <p className="mt-2 rounded-lg bg-primary-50 p-2 text-center text-[11px] text-primary-800 dark:bg-primary-950 dark:text-primary-200">{t.refreshedNote}</p>
        )}

        {/* ── COMPOSER (pre-plan first viewport is 100% mission) — ADR-253 intake:
            NL → same-parser prefill → editable mission card → ONE generate gate ── */}
        {!plan && !draft && (
          <section className="pt-4">
            <h1 className="text-2xl font-bold leading-9">{t.title}</h1>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">{t.sub}</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} rows={5}
              className="mt-4 w-full resize-y rounded-xl border border-outline-variant bg-white p-3 text-sm leading-6 outline-none focus:border-primary-500 dark:bg-gray-900" />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => review(text)} disabled={loading || !text.trim()}
                className="min-h-[48px] flex-1 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                {t.review}
              </button>
              <button onClick={() => setText(EXAMPLE_AR)}
                className="min-h-[48px] rounded-xl border border-outline-variant px-4 py-3 text-sm text-on-surface-variant">
                {t.tryExample}
              </button>
            </div>
            <button onClick={() => review(null)}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-dashed border-outline-variant px-4 py-2.5 text-xs font-semibold text-on-surface-variant">
              {t.startByTapping}
            </button>
            <p className="mt-4 text-[11px] leading-5 text-on-surface-variant">{t.ai}</p>
          </section>
        )}

        {/* ── MISSION CARD (draft stage — the understanding-confirmation surface) ── */}
        {!plan && draft && (
          <section className="pt-2">
            <button onClick={() => setDraft(null)} className="text-xs font-semibold text-on-surface-variant underline">
              {isAr ? "→ عدّل الوصف" : "← Edit description"}
            </button>
            <MissionCard m={draft} onChange={setDraft} onSubmit={() => generate(draft)} submitLabel={t.build}
              t={t} isAr={isAr} loading={loading} />
            <p className="mt-3 text-[11px] leading-5 text-on-surface-variant">{t.ai}</p>
          </section>
        )}

        {loading && plan && (
          <p role="status" className="mt-2 rounded-lg bg-primary-50 p-2 text-center text-xs text-primary-800 dark:bg-primary-950 dark:text-primary-200">{t.building}</p>
        )}
        {error && <p className="mt-3 rounded-xl bg-error-50 p-3 text-sm text-error-700 dark:bg-error-950 dark:text-error-300">{t.errorMsg}</p>}

        {plan?.state === "need_categories" && (
          <div className="mt-3 rounded-xl bg-warning-50 p-3 text-sm leading-6 text-warning-800 dark:bg-warning-950 dark:text-warning-200">
            {isAr ? plan.note_ar : plan.note_en}
            <button onClick={() => { setPlan(null); setPrevPlan(null); }} className="mt-2 block text-xs font-bold underline">{t.newMission}</button>
          </div>
        )}

        {/* ── PLAN OVERVIEW — the whole plan in seconds ── */}
        {!purchaseMode && plan && plan.state !== "need_categories" && plan.allocation && (
          <section className="mt-1 rounded-2xl border border-outline-variant bg-white p-3 dark:bg-gray-900">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-bold">
                {groups.map((g) => `${isAr ? g.label_ar : g.label_en}${g.legs.length > 1 ? ` ×${g.legs.length}` : ""}`).join(" · ")}
              </p>
              <p className="shrink-0 text-[11px] font-semibold text-on-surface-variant">{t.decided(okLegs.length, plan.legs?.length ?? 0)}</p>
            </div>
            {bar && (
              <div className="mt-2" aria-hidden>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                  <div
                    className={`h-full rounded-full ${bar.tone === "over" ? "bg-error-500" : bar.tone === "tight" ? "bg-warning-500" : "bg-primary-500"}`}
                    style={{ width: `${bar.pct}%` }}
                  />
                </div>
              </div>
            )}
            {plan.allocation.feasible === false && plan.allocation.shortfall != null && (
              <button
                onClick={() => mission && rePlan({ ...mission, budget_total: (mission.budget_total ?? 0) + plan.allocation!.shortfall! }, "refined")}
                className="mt-2 min-h-[40px] rounded-lg bg-warning-100 px-3 py-2 text-xs font-bold text-warning-900 dark:bg-warning-900 dark:text-warning-100">
                {t.raiseBy(plan.allocation.shortfall)}
              </button>
            )}
            {plan.clarify && (
              <p className="mt-2 rounded-lg bg-primary-50 p-2 text-xs leading-5 text-primary-900 dark:bg-primary-950 dark:text-primary-100">
                {isAr ? plan.clarify.question_ar : plan.clarify.question_en}
              </p>
            )}
            {(plan.mission_notes?.caveats_ar?.length ?? 0) > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-on-surface-variant">
                  {t.overviewNotes(plan.mission_notes!.caveats_ar.length)}
                </summary>
                <ul className="mt-1 space-y-1">
                  {(isAr ? plan.mission_notes!.caveats_ar : plan.mission_notes!.caveats_en).map((c, i) => (
                    <li key={i} className="text-[11px] leading-5 text-on-surface-variant">— {c}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {/* ── DECISION DELTA (also shown in purchase mode: a pre-handoff refresh must
            EXPLAIN what changed, never silently swap figures — ADR-256 §6) ── */}
        {delta && !deltaDismissed && (
          <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-950">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-primary-900 dark:text-primary-100">{t.delta}</p>
              <button aria-label="close" onClick={() => setDeltaDismissed(true)} className="min-h-[32px] min-w-[32px] text-primary-700 dark:text-primary-300">×</button>
            </div>
            <ul className="mt-1 space-y-1">
              {delta.map((d, i) => <li key={i} className="text-xs leading-5 text-primary-900 dark:text-primary-100">• {d}</li>)}
            </ul>
          </div>
        )}

        {/* ── PURCHASE CHECKLIST (ADR-255): the SAME picks regrouped by exit retailer —
            one checkout per merchant is the journey's real granularity. Every exit goes
            through /go (same tab; re-entries re-route through /go so attribution lands
            as late as possible). No cart capability is faked: one product link per item. ── */}
        {purchaseMode && plan && (
          <section className="mt-1">
            <div className="rounded-2xl border border-outline-variant bg-white p-3 dark:bg-gray-900">
              <p className="text-[13px] font-bold">{t.buyTitle}</p>
              <p className="mt-0.5 text-[11px] leading-5 text-on-surface-variant">{t.buySub}</p>
              <p className="mt-1 text-[12px] font-semibold tabular-nums text-on-surface">
                {t.boughtProgress(boughtCount, buyableCount)}
                {storeGroups.length > 1 && <span className="text-on-surface-variant"> · {t.storesProgress(storesDoneCount, storeGroups.length)}</span>}
              </p>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden>
                <div className="h-full rounded-full bg-success-500" style={{ width: `${buyableCount ? Math.round((boughtCount / buyableCount) * 100) : 0}%` }} />
              </div>
              {buyableCount > 0 && boughtCount === buyableCount && (
                <p className="mt-2 rounded-lg bg-success-50 p-2 text-center text-[12px] font-bold text-success-800 dark:bg-success-950 dark:text-success-300">{t.missionDone}</p>
              )}
            </div>
            {/* RETAILER = the completion unit (ADR-256): one primary handoff per store —
                «أكمل الشراء من X» exits to the first OPEN item's /go (no cart is faked);
                per-item «شوف العرض» stays as a secondary link, per-item «تم» stays the truth. */}
            {storeGroups.map((g) => {
              const prog = storeProgress(g, purchased);
              const next = nextExit(g, purchased);
              return (
                <div key={g.store} className={`mt-3 rounded-2xl border bg-white p-3 dark:bg-gray-900 ${prog.complete ? "border-success-300 dark:border-success-800" : "border-outline-variant"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold">
                      {prog.complete && <span className="text-success-700 dark:text-success-300">✓ </span>}
                      {g.store}
                      <span className="ms-2 text-[11px] font-semibold text-on-surface-variant">{t.storeItems(g.legs.length)}</span>
                    </p>
                    <p className="shrink-0 text-[12px] font-semibold tabular-nums text-on-surface-variant">
                      {/* «·» separator is load-bearing: two adjacent digit runs in RTL
                          («…من 3» + «6,808») visually merge into one wrong number. */}
                      {g.legs.length > 1 && <>{t.storeDone(prog.done, prog.total)}{g.subtotal != null && " · "}</>}
                      {g.subtotal != null && <>{fmt(g.subtotal)} {t.sar}</>}
                    </p>
                  </div>
                  <div className="mt-2 space-y-2">
                    {g.legs.map((leg) => {
                      const r = leg.picked!;
                      const isDone = !!purchased[leg.leg_id];
                      return (
                        <div key={leg.leg_id} className={`flex items-center gap-2 rounded-xl border border-outline-variant p-2 ${isDone ? "opacity-60" : ""}`}>
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-container-lowest">
                            {r.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-[12px] font-semibold leading-5 [overflow-wrap:anywhere]"><bdi dir="auto">{recName(r)}</bdi></p>
                            <p className="text-[13px] font-bold tabular-nums">{r.unit_price != null ? `${fmt(r.unit_price)} ${t.sar}` : "—"}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              <ChipEl chip={evidenceChip(r, locale)} />
                              {ageLabel(r.data_age_hours, locale) && <span className="text-[10px] text-on-surface-variant">{ageLabel(r.data_age_hours, locale)}</span>}
                              {r.go_url && !isDone && (
                                <a href={r.go_url} rel="noopener nofollow"
                                  onClick={() => onGoExit(leg, r, "home_mission_checklist")}
                                  className="text-[11px] font-semibold text-primary-700 underline dark:text-primary-300">
                                  {t.go}
                                </a>
                              )}
                            </div>
                          </div>
                          <button aria-pressed={isDone}
                            onClick={() => markPurchased(leg.leg_id, r.canonical_id, !isDone)} disabled={loading}
                            className={`min-h-[40px] shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold ${isDone ? "bg-success-50 text-success-800 dark:bg-success-950 dark:text-success-300" : "border border-outline-variant text-on-surface-variant"}`}>
                            {isDone ? t.boughtChip : `${t.bought} ✓`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {next?.picked?.go_url && (
                    <a href={next.picked.go_url} rel="noopener nofollow"
                      onClick={() => onGoExit(next, next.picked!, "home_mission_retailer_cta")}
                      className="mt-2 block min-h-[44px] w-full truncate rounded-xl bg-primary-600 px-4 py-3 text-center text-[13px] font-bold text-white">
                      {t.storeCta(g.store)}
                    </a>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* ── CATEGORY GROUPS ── */}
        {!purchaseMode && groups.map((g) => (
          <section key={g.key} id={`grp-${g.key}`} className="mt-4 scroll-mt-28">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-bold">
                {isAr ? g.label_ar : g.label_en}
                {g.legs.length > 1 && <span className="text-on-surface-variant"> — {g.legs.length} {isAr ? "أجهزة" : "units"}</span>}
              </h2>
              <p className="text-[12px] font-semibold tabular-nums text-on-surface-variant">
                {g.subtotal != null && <>{fmt(g.subtotal)} {t.sar}</>}
                {g.worst !== "ok" && t.worst[g.worst] && (
                  <span className="ms-2 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] text-warning-800 dark:bg-warning-950 dark:text-warning-300">{t.worst[g.worst]}</span>
                )}
              </p>
            </div>
            <div className="space-y-2">
              {g.legs.map((leg) => (
                <div key={leg.leg_id}>
                  {t.emphasisLabel[leg.emphasis] && (
                    <p className="mb-1 px-1 text-[10px] font-semibold text-on-surface-variant">{t.emphasisLabel[leg.emphasis]}</p>
                  )}
                  <LegCard leg={leg} grouped={g.legs.length > 1} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* ── STICKY BOTTOM BAR (ADR-255): plan-level actions, not a persistent open text
          field (the open composer + keyboard was the research-flagged harmful case; the
          free-text refine lives at the top of the «عدّل» sheet, one tap away). ── */}
      {plan && plan.state !== "need_categories" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:bg-gray-950/95">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            {purchaseMode ? (
              <>
                <p className="min-w-0 flex-1 truncate text-[13px] font-bold tabular-nums">{t.boughtProgress(boughtCount, buyableCount)}</p>
                <button onClick={() => setPurchaseMode(false)}
                  className="min-h-[44px] shrink-0 rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface">
                  {t.backToPlan}
                </button>
              </>
            ) : (
              <>
                {buyableCount > 0 && (
                  <button
                    onClick={() => {
                      setPurchaseMode(true); window.scrollTo({ top: 0 });
                      track("home_mission", { meta: { step: "purchase_plan_opened", stores: storeGroups.length, items: buyableCount } });
                      // Price revalidation (ADR-256): never hand off on prices older than the
                      // trust window — refresh the SAME mission (marks+pins survive; the
                      // Decision Delta explains any change; the rest of the plan is preserved).
                      if (mission && planTs > 0 && Date.now() - planTs > PRICE_FRESH_MS) {
                        setRefreshedNote(true);
                        rePlan(mission, "purchase_refresh");
                      }
                    }}
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white">
                    {t.startBuying}{boughtCount > 0 ? ` (${boughtCount}/${buyableCount})` : ""}
                  </button>
                )}
                <button onClick={() => setRefineOpen(true)} disabled={loading}
                  className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 ${buyableCount > 0 ? "border border-outline-variant text-on-surface" : "flex-1 bg-primary-600 font-bold text-white"}`}>
                  {t.editPlan}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ALTERNATIVES BOTTOM SHEET ── */}
      {altsLeg && altsLeg.state === "ok" && (
        <div role="dialog" aria-modal="true" aria-label={t.alts} className="fixed inset-0 z-50">
          <button aria-label="close" onClick={() => setAltsFor(null)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-gray-950">
            <div className="mx-auto max-w-2xl">
              <p className="text-sm font-bold">{t.alts} — {isAr ? altsLeg.label_ar : altsLeg.label_en}</p>
              <div className="mt-3 space-y-2">
                {(altsLeg.alternatives ?? []).map((a) => {
                  const d = diffLabel(a.unit_price, altsLeg.picked?.unit_price ?? null, locale);
                  return (
                    <div key={a.canonical_id} className="flex items-start gap-3 rounded-xl border border-outline-variant p-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-lowest">
                        {a.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] font-semibold leading-5"><bdi dir="auto">{recName(a)}</bdi></p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">{a.unit_price != null ? `${fmt(a.unit_price)} ${t.sar}` : "—"}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {d && <ChipEl chip={d} />}
                          <ChipEl chip={evidenceChip(a, locale)} />
                        </div>
                      </div>
                      <button onClick={() => pin(altsLeg.leg_id, a.canonical_id)} disabled={loading}
                        className="min-h-[44px] shrink-0 self-center rounded-lg bg-primary-600 px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50">
                        {t.chooseThis}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REFINE BOTTOM SHEET — the SAME mission card as intake (one brain, one UI) ── */}
      {refineOpen && mission && (
        <div role="dialog" aria-modal="true" aria-label={t.editPlan} className="fixed inset-0 z-50">
          <button aria-label="close" onClick={() => { setRefineOpen(false); setRefineDraft(null); }} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-gray-950">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t.editPlan}</p>
                <button disabled={loading}
                  onClick={() => { setPlan(null); setPrevPlan(null); setExcludedIds([]); setPinnedIds({}); setPurchased({}); setPurchaseMode(false); setExitMarker(null); setRefineOpen(false); setRefineDraft(null); setDraft(null); try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ } }}
                  className="min-h-[36px] rounded-full border border-outline-variant px-3 py-1.5 text-[11px] font-semibold text-error-700 dark:text-error-300">
                  {t.newMission}
                </button>
              </div>
              {/* Free-text refine (the ADR-253 delta brain) — one tap inside the sheet,
                  never a persistent open field competing with the plan (ADR-255). */}
              <div className="mt-3 flex gap-2">
                <input value={followup} onChange={(e) => setFollowup(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyFollowup(); }}
                  placeholder={t.followup} aria-label={t.editPlan}
                  className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-outline-variant bg-white px-3 text-sm dark:bg-gray-900" />
                <button onClick={applyFollowup} disabled={loading || !followup.trim()}
                  className="min-h-[44px] shrink-0 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white disabled:opacity-50">
                  {t.send}
                </button>
              </div>
              <MissionCard m={refineDraft ?? mission} onChange={setRefineDraft}
                onSubmit={() => {
                  const next = refineDraft ?? mission;
                  setRefineOpen(false); setRefineDraft(null);
                  track("home_mission", { meta: { step: "refined", delta: "card" } });
                  rePlan(next, "refined");
                }}
                submitLabel={t.send} t={t} isAr={isAr} loading={loading} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
