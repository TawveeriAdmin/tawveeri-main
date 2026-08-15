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
  groupLegs, budgetBar, fitChip, evidenceChip, energyChip, ageLabel, diffLabel, fmt, parseDelta,
  type LegOut, type RecOut, type Mission, type Chip, type LegGroup,
} from "@/lib/agent/home-mission-view";

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

const STORAGE_KEY = "tw_home_mission_v2";
const STATE_TTL_MS = 45 * 60_000; // same TTL discipline as DecisionState

const T = (locale: Locale) => ({
  title: locale === "ar" ? "جهّز بيتك بذكاء" : "Equip your home",
  back: locale === "ar" ? "توفيري" : "Tawveeri",
  sub: locale === "ar"
    ? "صف بيتك بكلامك: الغرف ومساحاتها، أفراد الأسرة، الميزانية، وأولوياتك."
    : "Describe your home: rooms and sizes, household, budget, priorities.",
  placeholder: locale === "ar" ? EXAMPLE_AR : "New apartment, family of 4, bedroom 16m², living 28m², budget 20k SAR…",
  tryExample: locale === "ar" ? "جرّب المثال" : "Try the example",
  build: locale === "ar" ? "ابنِ الخطة" : "Build my plan",
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
  go: (store?: string) => (locale === "ar" ? `شوف العرض${store ? ` عند ${store}` : ""}` : `See the offer${store ? ` at ${store}` : ""}`),
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

export function HomeMissionClient({ locale }: { locale: Locale }) {
  const t = useMemo(() => T(locale), [locale]);
  const isAr = locale === "ar";
  const [text, setText] = useState("");
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
  const startedTracked = useRef(false);

  // ── Session persistence: refreshing the page must not lose the mission (45-min TTL,
  //    same discipline as DecisionState; sessionStorage — no account, no dossier). ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { plan: PlanResponse; excludedIds: string[]; pinnedIds: Record<string, string>; ts: number };
      if (Date.now() - saved.ts < STATE_TTL_MS && saved.plan?.understood) {
        setPlan(saved.plan); setExcludedIds(saved.excludedIds ?? []); setPinnedIds(saved.pinnedIds ?? {});
      }
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    try {
      if (plan) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ plan, excludedIds, pinnedIds, ts: Date.now() }));
    } catch { /* noop */ }
  }, [plan, excludedIds, pinnedIds]);

  const call = useCallback(async (body: Record<string, unknown>, step: string) => {
    setLoading(true); setError(false); setDeltaDismissed(false);
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

  const mission = plan?.understood ?? null;

  const rePlan = useCallback((m: Mission, step: string, over?: { excluded?: string[]; pinned?: Record<string, string> }) => {
    void call({ mission: m, excluded_ids: over?.excluded ?? excludedIds, pinned_ids: over?.pinned ?? pinnedIds }, step);
  }, [call, excludedIds, pinnedIds]);

  const start = useCallback(() => {
    if (!text.trim() || loading) return;
    if (!startedTracked.current) { track("home_mission", { meta: { step: "started" }, query_text: text.slice(0, 200) }); startedTracked.current = true; }
    setExcludedIds([]); setPinnedIds({}); setOpenWhy(null);
    void call({ text }, "plan");
  }, [text, loading, call]);

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
            <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-on-surface"><bdi dir="auto">{recName(r)}</bdi></p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-on-surface">
              {r.unit_price != null ? <>{fmt(r.unit_price)} <span className="text-xs font-semibold">{t.sar}</span></> : "—"}
              {leg.pinned && <span className="ms-2 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">{t.chosen}</span>}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">{chips.slice(0, 3).map((c, i) => <ChipEl key={i} chip={c} />)}</div>
            {age && <p className="mt-1 text-[11px] text-on-surface-variant">{age}</p>}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          {r.go_url && (
            <a href={r.go_url} target="_blank" rel="noopener nofollow"
              onClick={() => track("go_click", { canonical_id: r.canonical_id, store: r.stores[0] ?? null, category: leg.category, source: "home_mission" })}
              className="min-h-[44px] flex-1 rounded-lg bg-primary-600 px-3 py-2.5 text-center text-[13px] font-bold text-white">
              {t.go(r.stores[0])}
            </a>
          )}
          <button aria-expanded={whyOpen} onClick={() => setOpenWhy(whyOpen ? null : leg.leg_id)}
            className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-semibold text-on-surface-variant">
            {t.why}
          </button>
          <button onClick={() => { setAltsFor(leg.leg_id); track("home_mission", { meta: { step: "alts_open", leg: leg.leg_id } }); }}
            className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-semibold text-on-surface-variant"
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
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-surface-container-lowest text-on-surface">

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
        {/* ── Category anchor chips (sticky with header) ── */}
        {groups.length > 1 && (
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

      <main className="mx-auto max-w-2xl px-3 pb-28 pt-3">

        {/* ── COMPOSER (pre-plan first viewport is 100% mission) ── */}
        {!plan && (
          <section className="pt-4">
            <h1 className="text-2xl font-bold leading-9">{t.title}</h1>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">{t.sub}</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} rows={5}
              className="mt-4 w-full resize-y rounded-xl border border-outline-variant bg-white p-3 text-sm leading-6 outline-none focus:border-primary-500 dark:bg-gray-900" />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={start} disabled={loading || !text.trim()}
                className="min-h-[48px] flex-1 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                {loading ? t.building : t.build}
              </button>
              <button onClick={() => setText(EXAMPLE_AR)}
                className="min-h-[48px] rounded-xl border border-outline-variant px-4 py-3 text-sm text-on-surface-variant">
                {t.tryExample}
              </button>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-on-surface-variant">{t.ai}</p>
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
        {plan && plan.state !== "need_categories" && plan.allocation && (
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

        {/* ── DECISION DELTA ── */}
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

        {/* ── CATEGORY GROUPS ── */}
        {groups.map((g) => (
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

      {/* ── STICKY BOTTOM REFINE BAR ── */}
      {plan && plan.state !== "need_categories" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-white/95 p-3 backdrop-blur dark:bg-gray-950/95">
          <div className="mx-auto flex max-w-2xl gap-2">
            <input value={followup} onChange={(e) => setFollowup(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyFollowup(); }}
              placeholder={t.followup} aria-label={t.editPlan}
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-outline-variant bg-white px-3 text-sm dark:bg-gray-900" />
            <button onClick={followup.trim() ? applyFollowup : () => setRefineOpen(true)} disabled={loading}
              className="min-h-[44px] rounded-xl bg-primary-600 px-4 text-sm font-bold text-white disabled:opacity-50">
              {followup.trim() ? t.send : t.editPlan}
            </button>
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

      {/* ── REFINE BOTTOM SHEET ── */}
      {refineOpen && mission && (
        <div role="dialog" aria-modal="true" aria-label={t.editPlan} className="fixed inset-0 z-50">
          <button aria-label="close" onClick={() => setRefineOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-gray-950">
            <div className="mx-auto max-w-2xl">
              <p className="text-sm font-bold">{t.editPlan}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs text-on-surface-variant">
                  {t.budgetSar}
                  <input type="number" inputMode="numeric" min={1000} step={500} defaultValue={mission.budget_total ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== mission.budget_total) rePlan({ ...mission, budget_total: v }, "refined");
                    }}
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-white p-2.5 text-sm tabular-nums dark:bg-gray-900" />
                </label>
                <label className="text-xs text-on-surface-variant">
                  {t.household}
                  <input type="number" inputMode="numeric" min={1} max={20} defaultValue={mission.household_size ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== mission.household_size) rePlan({ ...mission, household_size: v }, "refined");
                    }}
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-white p-2.5 text-sm tabular-nums dark:bg-gray-900" />
                </label>
              </div>
              {mission.spaces.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-on-surface-variant">{isAr ? "الغرف" : "Rooms"}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {mission.spaces.map((s) => (
                      <label key={s.key} className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1.5 text-xs">
                        {isAr ? s.label_ar : s.label_en}
                        <input type="number" inputMode="numeric" min={5} max={200} defaultValue={s.area_m2 ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value ? Number(e.target.value) : null;
                            if (v !== s.area_m2) {
                              rePlan({ ...mission, spaces: mission.spaces.map((x) => (x.key === s.key ? { ...x, area_m2: v } : x)) }, "refined");
                            }
                          }}
                          className="w-14 rounded border border-outline-variant p-1 text-center text-xs tabular-nums" />
                        م²
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(mission.categories).filter(([, v]) => v !== "excluded").map(([cat]) => (
                  <button key={cat} disabled={loading}
                    onClick={() => rePlan({ ...mission, categories: { ...mission.categories, [cat]: "excluded" } }, "refined")}
                    className="min-h-[36px] rounded-full border border-outline-variant px-3 py-1.5 text-[11px] text-on-surface-variant">
                    {isAr ? `شيل ${plan?.legs?.find((l) => l.category === cat)?.label_ar ?? cat}` : `Drop ${cat}`}
                  </button>
                ))}
                <button disabled={loading}
                  onClick={() => { setPlan(null); setPrevPlan(null); setExcludedIds([]); setPinnedIds({}); setRefineOpen(false); try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ } }}
                  className="min-h-[36px] rounded-full border border-outline-variant px-3 py-1.5 text-[11px] font-semibold text-error-700 dark:text-error-300">
                  {t.newMission}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
