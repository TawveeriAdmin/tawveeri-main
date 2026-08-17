"use client";

// Shared-plan viewer client (ADR-257). Renders the immutable snapshot with drift
// honesty («الأسعار كما رُصدت وقت المشاركة») and collects lightweight opinion:
// per-item مناسب 👍 / اقترح تغييره + one optional note with a name — no account.
// The viewer can NEVER mutate the owner's plan; opinions land in the owner's
// feedback inbox only. Prices/names/stores here are server-derived facts.

import { useMemo, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics/track";
import { fmt } from "@/lib/agent/home-mission-view";
import type { ShareSnapshot } from "@/lib/agent/home-mission-share";
import { useEffect } from "react";

const T = (isAr: boolean) => ({
  title: isAr ? "خطة مشتريات" : "A purchase plan",
  via: isAr ? "معدّة عبر توفيري — مقارنة أسعار بالأدلة" : "Prepared with Tawveeri — evidence-based price comparison",
  gone: isAr ? "هذه الخطة لم تعد متاحة — انتهت صلاحية الرابط أو أُلغيت مشاركته." : "This plan is no longer available — the link expired or was revoked.",
  buildYours: isAr ? "ابنِ خطتك أنت" : "Build your own plan",
  budget: isAr ? "الميزانية" : "Budget",
  total: isAr ? "إجمالي الخطة" : "Plan total",
  household: (n: number) => (isAr ? `أسرة من ${n}` : `household of ${n}`),
  property: { apartment: isAr ? "شقة" : "Apartment", villa: isAr ? "فيلا" : "Villa", partial: isAr ? "جزء من البيت" : "Part of home" } as Record<string, string>,
  sar: isAr ? "ر.س" : "SAR",
  at: (s: string) => (isAr ? `عند ${s}` : `at ${s}`),
  stores: (n: number) => (isAr ? (n === 1 ? "متجر واحد" : `${n} متاجر`) : `${n} store${n === 1 ? "" : "s"}`),
  bought: isAr ? "تم الشراء ✓" : "Purchased ✓",
  sharedAgo: (txt: string) => (isAr ? `الأسعار كما رُصدت وقت المشاركة ${txt} — قد تتغير.` : `Prices as observed when shared ${txt} — they may change.`),
  ago: (h: number) => (isAr ? (h < 1 ? "قبل أقل من ساعة" : h < 48 ? `قبل ${Math.round(h)} ساعة` : `قبل ${Math.round(h / 24)} يوم`) : h < 1 ? "less than an hour ago" : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`),
  opinionTitle: isAr ? "أعط رأيك في الخطة" : "Give your opinion",
  opinionSub: isAr ? "رأيك يصل لصاحب الخطة — ولا يغيّر الخطة بنفسه." : "Your opinion goes to the plan owner — it never edits the plan itself.",
  up: isAr ? "مناسب 👍" : "Good 👍",
  change: isAr ? "اقترح تغييره" : "Suggest changing",
  namePh: isAr ? "اسمك (اختياري)" : "Your name (optional)",
  notePh: isAr ? "ملاحظة قصيرة (اختياري)…" : "A short note (optional)…",
  send: isAr ? "أرسل رأيك" : "Send",
  sent: isAr ? "وصل رأيك لصاحب الخطة ✓" : "Your opinion was sent ✓",
  sendFailed: isAr ? "تعذر إرسال رأيك — جرّب مرة ثانية." : "Sending failed — try again.",
  pickOne: isAr ? "اختر رأيك على جهاز واحد على الأقل" : "React to at least one item",
});

export function SharedPlanView({ locale, token, snapshot }: { locale: "ar" | "en"; token: string; snapshot: ShareSnapshot | null }) {
  const isAr = locale === "ar";
  const t = useMemo(() => T(isAr), [isAr]);
  const [reactions, setReactions] = useState<Record<string, "up" | "change">>({});
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);

  useEffect(() => {
    if (snapshot) track("home_share", { meta: { step: "opened", legs: snapshot.legs.length } });
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-surface-container-lowest px-4 py-16 text-center text-on-surface">
        <p className="text-sm leading-6 text-on-surface-variant">{t.gone}</p>
        <Link href={`/${locale}/home-mission`} className="mt-4 inline-block min-h-[44px] rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white">{t.buildYours}</Link>
      </div>
    );
  }

  const sharedHours = Math.max(0, (Date.now() - new Date(snapshot.shared_at).getTime()) / 3_600_000);
  const context = [
    snapshot.property_type ? t.property[snapshot.property_type] : null,
    snapshot.household_size != null ? t.household(snapshot.household_size) : null,
  ].filter(Boolean).join(" · ");

  const submit = async () => {
    const entries = Object.entries(reactions);
    if (!entries.length || sending) return;
    setSending(true);
    setSendError(false);
    try {
      // ADR-258 (incident): «وصل رأيك ✓» used to render without checking the server's
      // answer — a rejected write looked identical to a delivered one. Success is now
      // claimed only when EVERY row was accepted.
      let allOk = true;
      for (const [legId, reaction] of entries) {
        const res = await fetch(`/api/v1/agent/home-mission/share/${token}/feedback`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ leg_id: legId, reaction, note: note || null, reviewer_name: name || null }),
        });
        if (!res.ok) allOk = false;
      }
      if (!allOk) { setSendError(true); return; }
      track("home_share", { meta: { step: "feedback", reactions: entries.length, has_note: !!note } });
      setSent(true);
    } catch { setSendError(true); } finally { setSending(false); }
  };

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen overflow-x-clip bg-surface-container-lowest pb-16 text-on-surface">
      <div className="mx-auto max-w-2xl px-3 pt-6">
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="mt-1 text-[12px] text-on-surface-variant">{t.via}</p>

        <section className="mt-4 rounded-2xl border border-outline-variant bg-white p-3 dark:bg-gray-900">
          {context && <p className="text-[12px] font-semibold text-on-surface-variant">{context}</p>}
          <p className="mt-1 text-sm font-bold tabular-nums">
            {snapshot.budget_total != null && <>{t.budget} {fmt(snapshot.budget_total)} {t.sar}</>}
            {snapshot.budget_total != null && snapshot.total != null && " · "}
            {snapshot.total != null && <>{t.total} {fmt(snapshot.total)} {t.sar}</>}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-on-surface-variant">{t.sharedAgo(t.ago(sharedHours))}</p>
        </section>

        <div className="mt-3 space-y-2">
          {snapshot.legs.map((leg) => {
            const title = isAr ? leg.title_ar ?? leg.title_en : leg.title_en ?? leg.title_ar;
            const r = reactions[leg.leg_id];
            return (
              <div key={leg.leg_id} className={`rounded-xl border border-outline-variant bg-white p-3 dark:bg-gray-900 ${leg.purchased ? "opacity-70" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-lowest">
                    {leg.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={leg.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-on-surface-variant">
                      {isAr ? leg.label_ar : leg.label_en}
                      {leg.space_label_ar && ` — ${leg.space_label_ar}`}
                      {leg.area_m2 != null && ` · ${leg.area_m2}م²`}
                    </p>
                    <p className="line-clamp-2 min-w-0 text-[13px] font-semibold leading-5 [overflow-wrap:anywhere]"><bdi dir="auto">{title}</bdi></p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums">
                      {leg.price != null ? `${fmt(leg.price)} ${t.sar}` : "—"}
                      {leg.purchased && <span className="ms-2 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-800 dark:bg-success-950 dark:text-success-300">{t.bought}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">
                      {[leg.store ? t.at(leg.store) : null, leg.store_count > 0 ? t.stores(leg.store_count) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                {!sent && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => setReactions((x) => ({ ...x, [leg.leg_id]: "up" }))}
                      className={`min-h-[40px] flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold ${r === "up" ? "border-success-600 bg-success-50 text-success-800 dark:bg-success-950 dark:text-success-300" : "border-outline-variant text-on-surface-variant"}`}>
                      {t.up}
                    </button>
                    <button onClick={() => setReactions((x) => ({ ...x, [leg.leg_id]: "change" }))}
                      className={`min-h-[40px] flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold ${r === "change" ? "border-warning-600 bg-warning-50 text-warning-800 dark:bg-warning-950 dark:text-warning-300" : "border-outline-variant text-on-surface-variant"}`}>
                      {t.change}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <section className="mt-4 rounded-2xl border border-outline-variant bg-white p-3 dark:bg-gray-900">
          <p className="text-sm font-bold">{t.opinionTitle}</p>
          <p className="mt-0.5 text-[11px] leading-5 text-on-surface-variant">{t.opinionSub}</p>
          {sent ? (
            <p className="mt-2 rounded-lg bg-success-50 p-2 text-center text-[12px] font-bold text-success-800 dark:bg-success-950 dark:text-success-300">{t.sent}</p>
          ) : (
            <>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder={t.namePh}
                className="mt-2 min-h-[44px] w-full rounded-xl border border-outline-variant bg-white px-3 text-sm dark:bg-gray-900" />
              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} placeholder={t.notePh} rows={2}
                className="mt-2 w-full resize-none rounded-xl border border-outline-variant bg-white p-3 text-sm dark:bg-gray-900" />
              {sendError && (
                <p className="mt-2 rounded-lg bg-error-50 p-2 text-center text-[12px] font-semibold text-error-700 dark:bg-error-950 dark:text-error-300">{t.sendFailed}</p>
              )}
              <button onClick={submit} disabled={sending || Object.keys(reactions).length === 0}
                className="mt-2 min-h-[44px] w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {Object.keys(reactions).length === 0 ? t.pickOne : t.send}
              </button>
            </>
          )}
        </section>

        <Link href={`/${locale}/home-mission`}
          className="mt-4 block min-h-[44px] rounded-xl border border-primary-600 px-5 py-3 text-center text-sm font-bold text-primary-700 dark:text-primary-300">
          {t.buildYours}
        </Link>
      </div>
    </div>
  );
}
