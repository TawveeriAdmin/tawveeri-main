'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { track, initTestModeFromUrl } from '@/lib/analytics/track';
import { PriceAlertDialog } from '@/components/products/price-alert-dialog';
import { ExitLink } from '@/components/catalog/exit-link';
import type { CheckResult } from '@/lib/check/check-product';

const CONDITION = {
  NEW: ['جديد بحسب الوصف', 'New according to description'],
  RENEWED: ['مجدد بحسب الوصف', 'Renewed according to description'],
  REFURBISHED: ['مجدد بحسب الوصف', 'Refurbished according to description'],
  USED: ['مستعمل بحسب الوصف', 'Used according to description'],
  UNKNOWN: ['الحالة غير مؤكدة', 'Condition unconfirmed'],
};
const HISTORY = {
  insufficient: ['لا يوجد تاريخ كافٍ للحكم', 'Not enough history to judge'],
  lowest: ['أقل سعر رصدناه لهذا العرض', 'Lowest price we observed for this offer'],
  near_low: ['قريب من أقل سعر رصدناه', 'Near our lowest observed price'],
  above_typical: ['أعلى من المعتاد في سجلنا', 'Above typical in our records'],
  typical: ['قريب من السعر المعتاد في سجلنا', 'Around typical in our records'],
};

export function CheckClient({ locale }: { locale: 'ar' | 'en' }) {
  const ar = locale === 'ar'; const language = ar ? 0 : 1;
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [watch, setWatch] = useState(false);
  const [watchMessage, setWatchMessage] = useState(false);
  const attempt = useRef('');
  const lock = useRef(false);
  const emit = (step: string, meta: Record<string, unknown> = {}) => track('product_check', {
    source: `check_${step}`, canonical_id: step === 'submit' || step === 'error' ? undefined : result?.canonicalId,
    meta: { step, attempt_id: attempt.current, ...meta },
  });
  useEffect(() => {
    initTestModeFromUrl();
    try {
      const previous = Number(localStorage.getItem('tw_check_visit'));
      if (previous && Date.now() - previous >= 30 * 60 * 1000) track('product_check', { source: 'check_return', meta: { step: 'return' } });
      localStorage.setItem('tw_check_visit', String(Date.now()));
    } catch { /* Storage is optional. */ }
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setResult(null); setError(false); setWatchMessage(false);
    attempt.current = crypto.randomUUID(); emit('submit');
    try {
      const response = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, locale }), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('unavailable');
      const data: CheckResult = await response.json(); setResult(data);
      track('product_check', { source: 'check_result', canonical_id: data.canonicalId, meta: {
        step: 'result', attempt_id: attempt.current, state: data.state,
        cheaper_count: data.cheaperCount ?? 0, condition_difference: data.conditionDifference ?? false,
        condition_disclosed: data.offers?.some(o => ['RENEWED', 'REFURBISHED', 'USED'].includes(o.condition)) ?? false,
        offer_count: data.offers?.length ?? 0,
      } });
    } catch { setError(true); emit('error'); }
    finally { lock.current = false; setBusy(false); }
  };
  const source = result?.offers?.find(o => o.source);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12" dir={ar ? 'rtl' : 'ltr'}>
      <p className="text-sm font-semibold text-primary-700">TAWVEERI CHECK</p>
      <h1 className="mt-2 text-3xl font-bold leading-snug">{ar ? 'لقيت المنتج؟ افحص رابطه قبل تدفع.' : 'Found a product? Check its link before paying.'}</h1>
      <p className="mt-3 leading-7 text-on-surface-variant">{ar ? 'حط رابطه بتوفيري وشوف إذا نفسه أرخص بمكان ثاني. نعرض ما رصدناه، ونوضح متى لا نستطيع إثبات التطابق.' : 'Paste its link to check other Saudi offers. We show our observations and say when an exact match is unconfirmed.'}</p>
      <form onSubmit={submit} className="mt-6 rounded-2xl border border-outline-variant bg-surface p-4">
        <label htmlFor="check-url" className="block text-sm font-semibold">{ar ? 'رابط المنتج' : 'Product link'}</label>
        <input id="check-url" type="url" dir="ltr" required maxLength={2048} autoComplete="off" autoCapitalize="none" spellCheck={false} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-outline-variant bg-transparent px-3 text-base" />
        <p className="mt-2 text-xs leading-6 text-on-surface-variant">{ar ? 'رابط صفحة المنتج الكامل من أمازون السعودية، نون السعودية، جرير أو إكسترا. الروابط المختصرة غير مدعومة حاليًا.' : 'Full product-page links from Amazon.sa, Noon Saudi, Jarir or eXtra. Short links are not supported yet.'}</p>
        <button disabled={busy} className="mt-3 min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? (ar ? 'نفحص سجلنا…' : 'Checking our records…') : (ar ? 'افحص الرابط' : 'Check link')}</button>
      </form>
      <div aria-live="polite" aria-busy={busy} className="mt-6">
        {error && <p role="alert">{ar ? 'تعذر الفحص مؤقتًا. حاول مرة أخرى؛ لم نحكم على المنتج.' : 'Check temporarily unavailable. Please retry; no product verdict was made.'}</p>}
        {result && result.state !== 'matched' && <section className="rounded-xl border border-outline-variant p-4">
          <h2 className="font-bold">{ar ? 'لم نثبت هوية المنتج من هذا الرابط' : 'We could not confirm the product from this link'}</h2>
          <p className="mt-2 leading-7">{result.state === 'unsupported'
            ? (ar ? 'استخدم رابط صفحة المنتج الكامل من المتاجر المدعومة، دون خيارات تغيّر النسخة. افتح الرابط المختصر في المتجر ثم انسخ عنوان الصفحة.' : 'Use a full supported product-page link without variant selectors. Open short links at the store first, then copy the page address.')
            : (ar ? 'الرابط غير مغطى أو الأدلة غير كافية. لن نستبدله بمنتج مشابه أو نخترع مقارنة.' : 'The link is not covered or evidence is insufficient. We will not substitute a similar product or invent a comparison.')}</p>
          <Link className="mt-3 inline-block underline" href={`/${locale}/search`}>{ar ? 'ابحث باسم الموديل' : 'Search by model name'}</Link>
        </section>}
        {result?.state === 'matched' && <section className="space-y-5">
          <div>
            <h2 className="text-xl font-bold">{ar ? 'عرفنا رابط العرض في سجلنا' : 'We found the offer link in our records'}</h2>
            <p className="mt-2 font-semibold">{result.title}</p>
            <p className="mt-2 text-sm leading-6">{ar ? 'العروض التالية مرتبطة بالموديل نفسه في سجلنا. تطابق اللون والضمان والملحقات غير مضمون؛ اقرأ وصف كل عرض.' : 'These offers share the model in our records. Colour, warranty and bundles may differ; read each description.'}</p>
            <p className="mt-3 font-semibold">{result.cheaperCount
              ? (ar ? `وجدنا ${result.cheaperCount} عرضًا أقل سعرًا بنفس الوصف والحالة المرصودين؛ تأكد من الشروط لدى المتجر.` : `Found ${result.cheaperCount} lower-priced offers with the same observed description and condition; confirm retailer terms.`)
              : (ar ? 'لم نثبت عرضًا أرخص بنفس الوصف والحالة حاليًا.' : 'We have not confirmed a cheaper offer with the same description and condition.')}</p>
          </div>
          <ul className="space-y-3">{result.offers?.map(offer => <li key={offer.store} className="rounded-xl border border-outline-variant p-4">
            <p className="font-bold leading-7">{offer.storeName}: {offer.price.toLocaleString(ar ? 'ar-SA' : 'en-SA', { maximumFractionDigits: 2 })} {ar ? 'ريال' : 'SAR'} — {CONDITION[offer.condition][language]}</p>
            {offer.source && <p className="mt-1 text-xs font-semibold">{ar ? 'العرض الذي أرسلت رابطه' : 'The offer you linked'}</p>}
            <p dir="auto" className="mt-2 whitespace-normal break-words text-sm leading-6 [overflow-wrap:anywhere]">{offer.title}</p>
            <p className="mt-2 text-xs leading-6">{ar ? 'آخر رصد: ' : 'Last observed: '}{offer.observedAt ? new Date(offer.observedAt).toLocaleString(ar ? 'ar-SA' : 'en-GB', { calendar: 'gregory', year: 'numeric', month: 'short', day: 'numeric' }) : (ar ? 'غير مؤكد' : 'unconfirmed')}. {offer.availability === 'in_stock' ? (ar ? 'متوفر عند الرصد' : 'In stock when observed') : offer.availability === 'out_of_stock' ? (ar ? 'غير متوفر عند الرصد' : 'Out of stock when observed') : (ar ? 'التوفر الحالي غير مؤكد' : 'Current availability unconfirmed')}</p>
            {offer.stale && <p className="mt-1 text-sm text-orange-800">{ar ? 'رصد قديم — قد يكون السعر أو التوفر تغيّر.' : 'Old observation — price or availability may have changed.'}</p>}
            {offer.href ? <ExitLink href={offer.href} canonicalId={result.canonicalId!} store={offer.store} surface={offer.source ? 'check_source' : 'check_other'} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">{ar ? 'تحقق من السعر والشروط بالمتجر' : 'Check price and terms at retailer'}</ExitLink> : <p className="mt-3 text-sm">{ar ? 'لم نثبت رابط خروج مطابقًا لهذا الرصد.' : 'No verified exit link for this observation.'}</p>}
          </li>)}</ul>
          <section className="rounded-xl bg-primary-50 p-4 text-on-surface">
            <h3 className="font-bold">{ar ? 'السعر المرصود مقارنة بسجل توفيري' : 'Observed price compared with Tawveeri history'}</h3>
            <p className="mt-2">{HISTORY[result.history?.label ?? 'insufficient'][language]}</p>
            <p className="mt-2 text-xs leading-6">{ar ? `يعتمد على سجل العرض الذي أرسلته فقط (${result.history?.days ?? 0} أيام رصد مختلفة)، وليس كل السوق. السعر النهائي والتوصيل والشروط لدى المتجر.` : `Based only on the linked offer (${result.history?.days ?? 0} distinct observed days), not the whole market. Confirm final price, shipping and terms at the retailer.`}</p>
          </section>
          <button onClick={() => { emit('watch'); setWatchMessage(true); if (user && result.alertProductId) setWatch(true); }} className="min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 font-bold text-white">{ar ? 'راقبه لي' : 'Watch it for me'}</button>
          {watchMessage && (!user || !result.alertProductId) && <p className="text-sm leading-7">{!result.alertProductId
            ? (ar ? 'لم نتمكن من ربط هذا العرض بتنبيه موثوق. لم يُحفظ تنبيه؛ يمكنك العودة بالرابط لفحصه مجددًا.' : 'We could not link this offer to a reliable alert. No alert was saved; return with the link to check again.')
            : <>{ar ? 'لحفظ تنبيه السعر، سجّل الدخول ثم افحص الرابط مجددًا. لم يُحفظ تنبيه بعد. ' : 'Sign in, then check the link again to save an alert. No alert has been saved yet. '}<Link href={`/${locale}/login`} className="underline">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></>}</p>}
          {result.alertProductId && user && <PriceAlertDialog open={watch} onOpenChange={setWatch} locale={locale} productId={result.alertProductId} productName={source?.title ?? result.title} currentPrice={source?.price} onSaved={() => emit('watch_saved')} />}
        </section>}
      </div>
      <p className="mt-8 text-xs leading-6 text-on-surface-variant">{ar ? 'Check يرتب الأسعار المرصودة من الأقل، دون تفضيل متجر بسبب العمولة. قد نحصل على عمولة عند الشراء. الفحص ليس ضمان سعر لحظي أو تطابق جميع شروط العروض.' : 'Check sorts observed prices lowest first, without commission-based preference. We may earn a commission on purchases. This is not a live-price guarantee or confirmation of identical offer terms.'}</p>
    </main>
  );
}
