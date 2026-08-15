"use client";

// «جهّز بيتك بذكاء» — Home Mission pilot client (AUDIT_REPORT_HOME §20).
// The client is a THIN edit-interface over the server's deterministic plan:
// it renders the guarded payload verbatim, mutates a typed mission object
// (never free-text re-interpretation of history), and re-asks the server.
// Decision Delta is a client-side diff of two server plans — no new claims.
import { useCallback, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";

type Locale = "ar" | "en";

interface Space { key: string; label_ar: string; label_en: string; area_m2: number | null }
type Emphasis = "high" | "normal" | "deprioritized" | "excluded";
interface Mission {
  spaces: Space[];
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
interface RecOut {
  canonical_id: string;
  title_ar: string | null; title_en: string | null; brand: string | null;
  image_url: string | null;
  unit_price: number | null;
  store_count: number; stores: string[];
  data_age_hours: number | null;
  claim_kind: "compared" | "availability" | "single";
  claim_ar: string; claim_en: string;
  reasons_ar: string[]; reason_kinds: string[]; headline_reasons: number[];
  trust: { score: number; tier: "high" | "medium" | "low" } | null;
  go_url: string | null;
}
interface LegOut {
  leg_id: string; category: string; label_ar: string; label_en: string;
  emphasis: Emphasis;
  state: "ok" | "needs_area" | "insufficient";
  space?: Space | null;
  btu_required?: number | null;
  picked?: RecOut; alternative?: RecOut | null;
  trade?: { next_upgrade: { extra_cost: number; title_ar: string | null; title_en: string | null } | null; downgrade_saving: number | null };
  question_ar?: string; question_en?: string;
  note_ar?: string; note_en?: string;
}
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
  "انتقلت لشقة جديدة. أسرتنا 4 أشخاص. غرفة النوم 16 متر، غرفة الأطفال 14 متر، الصالة 28 متر. ميزانيتي للأجهزة 20 ألف. أهم شيء المكيفات تكون ممتازة وما أبي أصرف على مواصفات ما أحتاجها.";

const T = (locale: Locale) => ({
  title: locale === "ar" ? "جهّز بيتك بذكاء" : "Equip your home, intelligently",
  sub: locale === "ar"
    ? "صف بيتك بكلامك: الغرف ومساحاتها، عدد أفراد الأسرة، ميزانيتك، وأولوياتك — ونحوّلها إلى خطة أجهزة بأدلة أسعار حقيقية."
    : "Describe your home in your own words — rooms and sizes, household, budget, priorities — and we turn it into an appliance plan backed by real price evidence.",
  placeholder: locale === "ar" ? EXAMPLE_AR : "We moved to a new apartment, family of 4, bedroom 16m², kids room 14m², living 28m², budget 20k SAR…",
  tryExample: locale === "ar" ? "جرّب المثال" : "Try the example",
  build: locale === "ar" ? "ابنِ الخطة" : "Build my plan",
  building: locale === "ar" ? "نحلل بيتك ونبني الخطة…" : "Analyzing your home and building the plan…",
  understood: locale === "ar" ? "فهمنا منك" : "What we understood",
  update: locale === "ar" ? "حدّث الخطة" : "Update plan",
  household: locale === "ar" ? "أفراد الأسرة" : "Household",
  budget: locale === "ar" ? "الميزانية (ريال)" : "Budget (SAR)",
  rooms: locale === "ar" ? "الغرف" : "Rooms",
  area: locale === "ar" ? "المساحة م²" : "Area m²",
  addRoom: locale === "ar" ? "+ غرفة" : "+ room",
  plan: locale === "ar" ? "خطة الأجهزة" : "The appliance plan",
  total: locale === "ar" ? "مجموع أسعار الأجهزة" : "Device-price total",
  remaining: locale === "ar" ? "المتبقي من الميزانية" : "Remaining budget",
  sar: locale === "ar" ? "ريال" : "SAR",
  why: locale === "ar" ? "ليش هذا الاختيار؟" : "Why this pick?",
  alt: locale === "ar" ? "البديل" : "Alternative",
  upgrade: (x: number) => (locale === "ar" ? `زيادة ${x.toLocaleString("en-US")} ريال تعطيك:` : `+${x.toLocaleString("en-US")} SAR buys:`),
  downgrade: (x: number) => (locale === "ar" ? `النزول للأرخص المؤهل يوفر ${x.toLocaleString("en-US")} ريال` : `Dropping to the cheapest eligible saves ${x.toLocaleString("en-US")} SAR`),
  goto: locale === "ar" ? "اذهب للمتجر" : "Go to store",
  reject: locale === "ar" ? "غيّره" : "Swap it",
  freshness: (h: number) => (locale === "ar"
    ? h < 48 ? `آخر رصد للسعر قبل ${Math.max(1, Math.round(h))} ساعة` : `آخر رصد للسعر قبل ${Math.round(h / 24)} يوم`
    : h < 48 ? `price observed ${Math.max(1, Math.round(h))}h ago` : `price observed ${Math.round(h / 24)}d ago`),
  delta: locale === "ar" ? "وش تغيّر؟" : "What changed?",
  followup: locale === "ar" ? "مثال: خليها 16 ألف · شيل التلفزيون · عدد الأسرة 6" : "e.g. make it 16k · drop the TV · household of 6",
  refine: locale === "ar" ? "عدّل" : "Refine",
  emphasisLabel: { high: locale === "ar" ? "أولوية عالية" : "high priority", deprioritized: locale === "ar" ? "أقل أهمية" : "lower priority" } as Record<string, string>,
  errorMsg: locale === "ar" ? "صار خطأ غير متوقع — جرّب مرة ثانية." : "Something went wrong — please try again.",
  ai: locale === "ar"
    ? "الترشيح والترتيب محرّك حتمي يقرأ أدلة أسعارنا الموثقة — لا يوجد ذكاء اصطناعي يقرر أو يخترع أسعارًا، ولا عمولة تؤثر على الترتيب."
    : "Ranking is a deterministic engine over our documented price evidence — no AI decides or invents prices, and no commission affects ranking.",
});

function asciiDigits(t: string): string {
  return t.replace(/[٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

/** Deterministic follow-up delta parser (typed mutations only — never re-interprets
 *  the whole conversation). Recognized: absolute/relative budget, category removal/
 *  re-add, household change. Anything else → null (the input then explains itself). */
export function parseDelta(raw: string, mission: Mission): { next: Mission; label: string } | null {
  const x = asciiDigits(raw.toLowerCase()).replace(/٬/g, "");
  const thousands = (s: string) => {
    const k = s.match(/(\d{1,3}(?:\.\d+)?)\s*(?:ألف|الف|آلاف|k\b)/);
    if (k) return Math.round(Number(k[1]) * 1000);
    const n = s.match(/(\d{4,6})/);
    return n ? Number(n[1]) : null;
  };
  // absolute: «خليها 16 ألف» «الميزانية 15000» «make it 16k»
  if (/خليها|خلها|اجعلها|make it|set (?:it|budget)|الميزاني[ةه]/.test(x)) {
    const v = thousands(x);
    if (v && v >= 1000 && v <= 500000) return { next: { ...mission, budget_total: v }, label: `budget→${v}` };
  }
  // relative: «زد 3000» «نقص 2000»
  const rel = x.match(/(زد|ارفع|زيد|increase|raise|نقص|قلل|انقص|reduce|lower)\s*(?:الميزاني[ةه])?\s*(?:ب)?\s*(\d{3,6}|\d{1,3}\s*(?:ألف|الف|k))/);
  if (rel && mission.budget_total) {
    const amt = thousands(rel[2]) ?? 0;
    const sign = /زد|ارفع|زيد|increase|raise/.test(rel[1]) ? 1 : -1;
    const v = mission.budget_total + sign * amt;
    if (amt && v >= 1000 && v <= 500000) return { next: { ...mission, budget_total: v }, label: `budget${sign > 0 ? "+" : "-"}${amt}` };
  }
  // category removal / re-add
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
  // household
  const hh = x.match(/(?:عدد )?(?:ال)?([أا]سر[ةه]|عائل[ةه]|household|أفراد|اشخاص|أشخاص)\D{0,8}(\d{1,2})/) || x.match(/(\d{1,2})\s*([أا]فراد|[أا]شخاص|people)/);
  if (hh) {
    const n = Number(hh[2] ?? hh[1]);
    if (n >= 1 && n <= 20) return { next: { ...mission, household_size: n }, label: `household→${n}` };
  }
  return null;
}

export function HomeMissionClient({ locale }: { locale: Locale }) {
  const t = useMemo(() => T(locale), [locale]);
  const isAr = locale === "ar";
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [prevPlan, setPrevPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [followup, setFollowup] = useState("");
  const excludedIds = useRef<string[]>([]);
  const startedTracked = useRef(false);

  const call = useCallback(async (body: Record<string, unknown>, step: string) => {
    setLoading(true); setError(false);
    try {
      const res = await fetch("/api/v1/agent/home-mission", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as PlanResponse;
      setPlan((old) => { setPrevPlan(old); return data; });
      track("home_mission", { meta: { step, state: data.state, legs: data.legs?.length ?? 0, feasible: data.allocation?.feasible ?? null } });
    } catch {
      setError(true);
      track("error", { source: "home_mission", meta: { step } });
    } finally { setLoading(false); }
  }, []);

  const start = useCallback(() => {
    if (!text.trim() || loading) return;
    if (!startedTracked.current) { track("home_mission", { meta: { step: "started" }, query_text: text.slice(0, 200) }); startedTracked.current = true; }
    excludedIds.current = [];
    void call({ text }, "plan");
  }, [text, loading, call]);

  const rePlan = useCallback((mission: Mission, step: string) => {
    void call({ mission, excluded_ids: excludedIds.current }, step);
  }, [call]);

  const mission = plan?.understood ?? null;

  const applyFollowup = useCallback(() => {
    if (!mission || !followup.trim()) return;
    const delta = parseDelta(followup, mission);
    if (delta) {
      setFollowup("");
      track("home_mission", { meta: { step: "refined", delta: delta.label } });
      rePlan(delta.next, "refined");
    } else {
      // Not a recognized mutation → treat as a brand-new mission description.
      setText(followup); setFollowup("");
      excludedIds.current = [];
      void call({ text: followup }, "new_mission");
    }
  }, [mission, followup, rePlan, call]);

  const reject = useCallback((canonicalId: string) => {
    if (!mission) return;
    excludedIds.current = [...excludedIds.current, canonicalId];
    track("home_mission", { canonical_id: canonicalId, meta: { step: "rejected" } });
    rePlan(mission, "rejected");
  }, [mission, rePlan]);

  // ── Decision Delta: diff the previous plan's picks against the new one (client-side
  //    arithmetic over two server-guarded plans — no new claims are composed here). ──
  const delta = useMemo(() => {
    if (!plan?.legs || !prevPlan?.legs) return null;
    const prevBy = new Map(prevPlan.legs.map((l) => [l.leg_id, l]));
    const changes: string[] = [];
    for (const l of plan.legs) {
      const p = prevBy.get(l.leg_id);
      if (!p) continue;
      const a = p.state === "ok" ? p.picked : null;
      const b = l.state === "ok" ? l.picked : null;
      const name = (r: RecOut | null | undefined) => (isAr ? r?.title_ar ?? r?.title_en : r?.title_en ?? r?.title_ar) ?? "—";
      if ((a?.canonical_id ?? null) !== (b?.canonical_id ?? null)) {
        changes.push(isAr
          ? `${l.label_ar}: ${name(a)} ← أصبح → ${name(b)}${a?.unit_price != null && b?.unit_price != null ? ` (${(b.unit_price - a.unit_price) >= 0 ? "+" : ""}${(b.unit_price - a.unit_price).toLocaleString("en-US")} ريال)` : ""}`
          : `${l.label_en}: ${name(a)} → ${name(b)}${a?.unit_price != null && b?.unit_price != null ? ` (${(b.unit_price - a.unit_price) >= 0 ? "+" : ""}${(b.unit_price - a.unit_price).toLocaleString("en-US")} SAR)` : ""}`);
      }
    }
    const t0 = prevPlan.allocation?.total_allocated, t1 = plan.allocation?.total_allocated;
    if (t0 != null && t1 != null && t0 !== t1) {
      changes.push(isAr
        ? `المجموع: ${t0.toLocaleString("en-US")} ← ${t1.toLocaleString("en-US")} ريال`
        : `Total: ${t0.toLocaleString("en-US")} → ${t1.toLocaleString("en-US")} SAR`);
    }
    return changes.length ? changes : null;
  }, [plan, prevPlan, isAr]);

  const legTitle = (l: LegOut) => (isAr ? l.label_ar : l.label_en);
  const recName = (r: RecOut) => (isAr ? r.title_ar ?? r.title_en : r.title_en ?? r.title_ar) ?? "";
  const headline = (r: RecOut) => r.headline_reasons.map((i) => r.reasons_ar[i]).filter(Boolean);

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-on-surface sm:text-3xl">{t.title}</h1>
      <p className="mt-2 text-sm text-on-surface-variant sm:text-base">{t.sub}</p>

      {/* Composer */}
      <div className="mt-5 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
          rows={4}
          className="w-full resize-y rounded-xl border border-outline-variant bg-white p-3 text-sm text-on-surface outline-none focus:border-primary-500 dark:bg-gray-900"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={start} disabled={loading || !text.trim()}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? t.building : t.build}
          </button>
          <button onClick={() => setText(EXAMPLE_AR)} className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm text-on-surface-variant">
            {t.tryExample}
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">{t.ai}</p>
      </div>

      {error && <p className="mt-4 rounded-xl bg-error-50 p-3 text-sm text-error-700 dark:bg-error-950 dark:text-error-300">{t.errorMsg}</p>}

      {plan?.state === "need_categories" && (
        <p className="mt-4 rounded-xl bg-warning-50 p-3 text-sm text-warning-800 dark:bg-warning-950 dark:text-warning-200">
          {isAr ? plan.note_ar : plan.note_en}
        </p>
      )}

      {/* Understood + editable context */}
      {mission && plan && plan.state !== "need_categories" && (
        <div className="mt-6 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <h2 className="text-sm font-bold text-on-surface">{t.understood}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs text-on-surface-variant">
              {t.household}
              <input type="number" min={1} max={20} value={mission.household_size ?? ""}
                onChange={(e) => setPlan({ ...plan, understood: { ...mission, household_size: e.target.value ? Number(e.target.value) : null } })}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-white p-2 text-sm dark:bg-gray-900" />
            </label>
            <label className="text-xs text-on-surface-variant">
              {t.budget}
              <input type="number" min={1000} step={500} value={mission.budget_total ?? ""}
                onChange={(e) => setPlan({ ...plan, understood: { ...mission, budget_total: e.target.value ? Number(e.target.value) : null } })}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-white p-2 text-sm tabular-nums dark:bg-gray-900" />
            </label>
          </div>
          {mission.spaces.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-semibold text-on-surface-variant">{t.rooms}</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {mission.spaces.map((s, i) => (
                  <span key={s.key} className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-1 text-xs dark:bg-gray-900">
                    {isAr ? s.label_ar : s.label_en}
                    <input type="number" min={5} max={200} value={s.area_m2 ?? ""} placeholder={t.area}
                      onChange={(e) => {
                        const spaces = mission.spaces.map((x, j) => (j === i ? { ...x, area_m2: e.target.value ? Number(e.target.value) : null } : x));
                        setPlan({ ...plan, understood: { ...mission, spaces } });
                      }}
                      className="w-14 rounded border border-outline-variant p-1 text-center text-xs tabular-nums" />
                    م²
                  </span>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => rePlan(mission, "refined")} disabled={loading}
            className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {t.update}
          </button>
        </div>
      )}

      {/* Clarify — the ONE highest-information question */}
      {plan?.clarify && (
        <p className="mt-4 rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">
          {isAr ? plan.clarify.question_ar : plan.clarify.question_en}
        </p>
      )}

      {/* Budget bar */}
      {plan?.allocation && plan.legs && plan.legs.some((l) => l.state === "ok") && (
        <div className="mt-6 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-on-surface">{t.plan}</span>
            {plan.allocation.total_allocated != null && (
              <span className="text-sm tabular-nums text-on-surface">
                {t.total}: <b>{plan.allocation.total_allocated.toLocaleString("en-US")}</b> {t.sar}
                {plan.allocation.budget_total != null && plan.allocation.remaining != null && (
                  <span className="text-on-surface-variant"> · {t.remaining}: {plan.allocation.remaining.toLocaleString("en-US")} {t.sar}</span>
                )}
              </span>
            )}
          </div>
          {plan.mission_notes && (
            <ul className="mt-2 space-y-1">
              {(isAr ? plan.mission_notes.caveats_ar : plan.mission_notes.caveats_en).map((c, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-on-surface-variant">— {c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Legs */}
      {plan?.legs?.map((l) => (
        <div key={l.leg_id} className="mt-4 rounded-2xl border border-outline-variant bg-white p-4 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-on-surface">
              {legTitle(l)}
              {l.space?.area_m2 != null && <span className="text-on-surface-variant"> · {l.space.area_m2}م²</span>}
              {l.btu_required != null && <span className="text-on-surface-variant"> · ~{l.btu_required.toLocaleString("en-US")} BTU</span>}
            </h3>
            {t.emphasisLabel[l.emphasis] && (
              <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant">{t.emphasisLabel[l.emphasis]}</span>
            )}
          </div>

          {l.state === "needs_area" && (
            <p className="mt-2 text-sm text-warning-800 dark:text-warning-200">{isAr ? l.question_ar : l.question_en}</p>
          )}
          {l.state === "insufficient" && (
            <p className="mt-2 text-sm text-on-surface-variant">{isAr ? l.note_ar : l.note_en}</p>
          )}

          {l.state === "ok" && l.picked && (
            <div className="mt-3">
              <div className="flex items-start gap-3">
                {l.picked.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.picked.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">{recName(l.picked)}</p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-primary-700 dark:text-primary-300">
                    {l.picked.unit_price != null ? `${l.picked.unit_price.toLocaleString("en-US")} ${t.sar}` : "—"}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    {isAr ? l.picked.claim_ar : l.picked.claim_en}
                    {l.picked.data_age_hours != null && <> · {t.freshness(l.picked.data_age_hours)}</>}
                  </p>
                </div>
              </div>
              {headline(l.picked).length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {headline(l.picked).map((r, i) => (
                    <li key={i} className="text-xs leading-relaxed text-on-surface-variant">• {r}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {l.picked.go_url && (
                  <a href={l.picked.go_url} target="_blank" rel="noopener nofollow"
                    onClick={() => track("go_click", { canonical_id: l.picked!.canonical_id, store: l.picked!.stores[0] ?? null, category: l.category, source: "home_mission" })}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white">
                    {t.goto}
                  </a>
                )}
                <button onClick={() => reject(l.picked!.canonical_id)} disabled={loading}
                  className="rounded-lg border border-outline-variant px-3 py-2 text-xs text-on-surface-variant disabled:opacity-50">
                  {t.reject}
                </button>
              </div>
              {(l.trade?.next_upgrade || l.trade?.downgrade_saving != null || l.alternative) && (
                <div className="mt-3 rounded-xl bg-surface-container-lowest p-3">
                  {l.trade?.next_upgrade && (
                    <p className="text-[11px] text-on-surface-variant">
                      ↑ {t.upgrade(l.trade.next_upgrade.extra_cost)}{" "}
                      <b>{isAr ? l.trade.next_upgrade.title_ar ?? l.trade.next_upgrade.title_en : l.trade.next_upgrade.title_en ?? l.trade.next_upgrade.title_ar}</b>
                    </p>
                  )}
                  {l.trade?.downgrade_saving != null && l.trade.downgrade_saving > 0 && (
                    <p className="mt-1 text-[11px] text-on-surface-variant">↓ {t.downgrade(l.trade.downgrade_saving)}</p>
                  )}
                  {l.alternative && (
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      {t.alt}: {recName(l.alternative)}{l.alternative.unit_price != null ? ` — ${l.alternative.unit_price.toLocaleString("en-US")} ${t.sar}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Decision Delta */}
      {delta && (
        <div className="mt-4 rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950">
          <h3 className="text-sm font-bold text-primary-900 dark:text-primary-100">{t.delta}</h3>
          <ul className="mt-2 space-y-1">
            {delta.map((d, i) => <li key={i} className="text-xs text-primary-900 dark:text-primary-100">• {d}</li>)}
          </ul>
        </div>
      )}

      {/* Follow-up */}
      {plan && plan.state !== "need_categories" && (
        <div className="mt-5 flex gap-2">
          <input
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFollowup(); }}
            placeholder={t.followup}
            className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-white p-3 text-sm dark:bg-gray-900"
          />
          <button onClick={applyFollowup} disabled={loading || !followup.trim()}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {t.refine}
          </button>
        </div>
      )}
    </div>
  );
}
