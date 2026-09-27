'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HOME_DRAFT_KEY, HOME_PLAN_KEY } from '@/lib/agent/home-mission-discovery';
import { trackHome } from '@/lib/analytics/home-mission';
import { ageLabel, fmt, type LegOut, type Mission } from '@/lib/agent/home-mission-view';

type Example = {
  state: string; understood: Mission; generated_at: string; legs?: LegOut[];
  allocation?: { total_allocated: number | null; remaining: number | null };
  mission_notes?: { caveats_ar: string[]; caveats_en: string[] };
};
export function HomeMissionExample({ locale }: { locale: 'ar' | 'en' }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const [plan, setPlan] = useState<Example | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [viewedAt, setViewedAt] = useState(0);
  const viewed = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/agent/home-mission/example', { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        setPlan(data); setViewedAt(Date.now()); setError(false);
        if (!viewed.current) { viewed.current = true; trackHome('example_view', undefined, 'example'); }
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  const adopt = () => {
    if (!plan) return;
    try {
      if ((localStorage.getItem(HOME_PLAN_KEY) || localStorage.getItem(HOME_DRAFT_KEY)) && !window.confirm(ar
        ? 'لديك خطة أو مسودة محفوظة. هل تريد استبدالها بمسودة من المثال؟ يمكنك إلغاء العملية والعودة لخطتك.'
        : 'You have a saved plan or draft. Replace it with an editable copy of this example? Cancel to keep it.')) return;
      // Write successfully before removing the previous plan. A blocked/full store
      // must never erase it. Only needs are copied; picks will be freshly generated.
      localStorage.setItem(HOME_DRAFT_KEY, JSON.stringify({ draft: plan.understood, text: '', source: 'example', ts: Date.now() }));
      localStorage.removeItem(HOME_PLAN_KEY);
      router.push(`/${locale}/home-mission?source=example`);
    } catch { setError(true); }
  };
  const legs = plan?.legs ?? [];
  const selected = legs.filter(leg => leg.state === 'ok' && leg.picked);
  return <main dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-3xl px-4 py-8 text-on-surface">
    <Link href={`/${locale}/home-mission`} className="inline-flex min-h-11 items-center text-sm font-semibold underline">{ar ? 'العودة لخطتك' : 'Back to your plan'}</Link>
    <p className="mt-4 text-sm font-semibold text-primary-700">{ar ? 'جهّز بيتك بذكاء' : 'Equip your home intelligently'}</p>
    <h1 className="mt-2 text-2xl font-bold">{ar ? 'مثال قابل للتعديل: أجهزة شقة جديدة' : 'Editable example: a new apartment'}</h1>
    <p className="mt-2 text-sm leading-7 text-on-surface-variant">{ar ? 'ميزانية افتراضية، واختيارات وأسعار من بيانات توفيري الفعلية. الأسعار والتوفر قد يتغيران عند المتجر.' : 'An illustrative budget with picks and prices from Tawveeri data. Prices and availability may change at the store.'}</p>
    {!plan && !error && <p role="status" className="py-8">{ar ? 'نجهّز المثال من الأسعار المرصودة…' : 'Preparing the example from observed prices…'}</p>}
    {error && <div role="alert" className="my-4 rounded-xl border p-4"><p>{ar ? 'تعذر تحميل المثال أو حفظ المسودة. خطتك الحالية لم تُستبدل دون موافقتك. جرّب مرة أخرى.' : 'Could not load the example or save the draft. Your plan was not replaced without confirmation. Try again.'}</p><button onClick={() => { setError(false); setAttempt(n => n + 1); }} className="min-h-11 underline">{ar ? 'إعادة المحاولة' : 'Retry'}</button></div>}
    {plan && <>
      <section className="my-5 rounded-2xl bg-primary-50 p-5 dark:bg-primary-950">
        <h2 className="font-bold">{ar ? 'احتياجات المثال' : 'Example needs'}</h2>
        <p className="mt-2 text-sm leading-7">{ar ? 'شقة لشخصين · مكيفان · ثلاجة · غسالة · أسلوب صرف متوازن' : 'Apartment for two · two ACs · fridge · washer · balanced spending'}</p>
        <ul className="mt-2 space-y-1 text-sm">{plan.understood.spaces.map(space => <li key={space.key}>{ar ? space.label_ar : space.label_en}: {space.area_m2} {ar ? 'م²' : 'm²'}</li>)}</ul>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><dt>{ar ? 'الميزانية الافتراضية' : 'Illustrative budget'}</dt><dd className="mt-1 text-lg font-bold">{fmt(plan.understood.budget_total ?? 0)} {ar ? 'ر.س' : 'SAR'}</dd></div>
          <div><dt>{ar ? 'إجمالي الأجهزة المختارة' : 'Selected appliance total'}</dt><dd className="mt-1 text-lg font-bold">{plan.allocation?.total_allocated == null ? '—' : fmt(plan.allocation.total_allocated)} {ar ? 'ر.س' : 'SAR'}</dd></div>
          <div><dt>{ar ? 'المتبقي من الميزانية' : 'Budget remaining'}</dt><dd className="mt-1 font-bold">{plan.allocation?.remaining == null ? '—' : fmt(plan.allocation.remaining)} {ar ? 'ر.س' : 'SAR'}</dd></div>
          <div><dt>{ar ? 'اكتمال الخطة' : 'Plan completeness'}</dt><dd className="mt-1 font-bold">{selected.length}/{legs.length} — {plan.state === 'ok' && selected.length === legs.length && legs.length > 0 ? (ar ? 'مكتملة' : 'Complete') : (ar ? 'جزئية' : 'Partial')}</dd></div>
        </dl>
        <p className="mt-3 text-xs leading-6">{ar ? 'المتبقي ليس توفيرًا مثبتًا. الشحن والتركيب غير محسوبين. لا يلزم إنفاق كامل الميزانية.' : 'Remaining budget is not verified savings. Shipping and installation are excluded. You do not need to spend the full budget.'}</p>
      </section>
      <p className="my-3 text-xs text-on-surface-variant">{ar ? 'تاريخ إعداد المثال: ' : 'Example prepared: '}{new Date(plan.generated_at).toLocaleString(ar ? 'ar-SA' : 'en-GB')}</p>
      <div className="space-y-3">{legs.map(leg => <article key={leg.leg_id} className="rounded-2xl border border-outline-variant p-4">
        <h2 className="font-bold">{ar ? leg.label_ar : leg.label_en}{leg.space && ` · ${ar ? leg.space.label_ar : leg.space.label_en}`}</h2>
        {leg.picked && leg.state === 'ok' ? <>
          <p className="mt-2 text-sm leading-6">{ar ? leg.picked.title_ar : leg.picked.title_en || leg.picked.title_ar}</p>
          <p className="mt-2 font-bold">{leg.picked.unit_price == null ? '—' : fmt(leg.picked.unit_price)} {ar ? 'ر.س' : 'SAR'}</p>
          <p className="mt-1 text-xs leading-6">{ar ? leg.picked.claim_ar : leg.picked.claim_en}</p>
          <p className="text-xs leading-6">{ageLabel(leg.picked.data_age_hours == null ? null : leg.picked.data_age_hours + Math.max(0, (viewedAt - Date.parse(plan.generated_at)) / 3600000), locale)}</p>
          <ul className="text-xs leading-6 text-on-surface-variant">{leg.picked.reasons_ar.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
        </> : <p className="mt-2 text-sm leading-6">{(ar ? leg.question_ar || leg.note_ar : leg.question_en || leg.note_en) || (ar ? 'لا تتوفر بيانات كافية لهذا الجهاز؛ لم نضف سعرًا تقديريًا.' : 'Insufficient data for this appliance; no estimated price was added.')}</p>}
      </article>)}</div>
      <ul className="my-4 space-y-2 text-xs leading-6 text-on-surface-variant">{(ar ? plan.mission_notes?.caveats_ar : plan.mission_notes?.caveats_en)?.map((note, i) => <li key={i}>{note}</li>)}</ul>
      <p className="my-4 text-sm leading-7">{ar ? 'بعد مراجعة احتياجاتك، ابنِ خطتك وافتح قائمة مشتريات حسب المتجر. الشراء يتم لدى كل متجر.' : 'Review your needs, build your plan, then open a shopping list by store. Checkout happens at each store.'}</p>
      <button onClick={adopt} className="min-h-12 rounded-xl bg-primary-700 px-6 py-3 font-bold text-white">{ar ? 'سوِّ خطة لبيتك' : 'Make a plan for your home'}</button>
    </>}
  </main>;
}
