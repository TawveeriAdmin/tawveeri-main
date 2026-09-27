'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { House, Snowflake, Refrigerator, WashingMachine, ArrowLeft, ArrowRight } from 'lucide-react';
import { trackHome } from '@/lib/analytics/home-mission';
import type { HomeSource } from '@/lib/agent/home-mission-discovery';

export function HomeMissionEntry({ locale, source, compact = false }: { locale: string; source: HomeSource; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const ar = locale !== 'en';
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !seen.current) {
        seen.current = true;
        trackHome('entry_view', source);
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [source]);
  const Arrow = ar ? ArrowLeft : ArrowRight;
  if (source === 'navigation') return <div ref={ref} className="shrink-0"><Link prefetch={false} href={`/${locale}/home-mission?source=navigation`} onClick={() => trackHome('entry_click', source)} className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold text-primary-800 dark:text-primary-200"><House size={15} aria-hidden="true" />{ar ? 'جهّز بيتك' : 'Equip your home'}</Link></div>;
  return <div ref={ref} data-home-entry={source} className="my-5 rounded-3xl border border-primary-200 bg-primary-50 p-5 text-on-surface dark:border-primary-800 dark:bg-primary-950 sm:p-6">
    <div className="flex items-center gap-2 text-sm font-bold text-primary-800 dark:text-primary-200"><House size={19} aria-hidden="true" />{ar ? 'جهّز بيتك بذكاء' : 'Equip your home intelligently'}</div>
    <h2 className="mt-3 text-xl font-bold leading-8 sm:text-2xl">{compact
      ? (source === 'ac_results' ? (ar ? 'تحتاج أكثر من مكيف؟ خطّط لمكيفات الغرف وباقي أجهزة البيت حسب ميزانيتك.' : 'Need more than one AC? Plan your rooms and home appliances within your budget.') : (ar ? 'تجهّز البيت كامل؟ وزّع ميزانيتك على الأجهزة بخطة واحدة.' : 'Equipping your home? Plan your appliance budget in one place.'))
      : (ar ? 'تتزوج أو تنتقل لبيت جديد؟ جهّز أجهزتك بميزانيتك' : 'Getting married or moving? Plan your home appliances within your budget')}</h2>
    {!compact && <>
      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{ar ? 'حدّد غرفك ومساحاتها والأجهزة اللي تحتاجها، وخلّ توفيري تقترح لك الخيارات وتوزّع ميزانيتك عليها من متاجر السعودية.' : 'Tell us your rooms, sizes and appliance needs. Tawveeri suggests options and allocates your budget across Saudi stores.'}</p>
      <div className="mt-4 rounded-2xl bg-surface p-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
          {[[Snowflake, ar ? 'مكيفات الغرف' : 'Room ACs'], [Refrigerator, ar ? 'ثلاجة المطبخ' : 'Kitchen fridge'], [WashingMachine, ar ? 'غسالة الملابس' : 'Washing machine']].map(([Icon, label]) => {
            const Device = Icon as typeof House;
            return <div key={String(label)} className="flex flex-col items-center gap-2 rounded-xl bg-primary-50 px-1 py-3 text-primary-900 dark:bg-primary-950 dark:text-primary-100"><Device size={28} strokeWidth={1.5} aria-hidden="true" /><span>{String(label)}</span></div>;
          })}
        </div>
        <p className="mt-3 text-center text-xs text-on-surface-variant">{ar ? 'معاينة توضيحية لخطة أجهزة' : 'Illustrative appliance plan preview'}</p>
      </div>
      <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold" aria-label={ar ? 'خطوات الخطة' : 'Plan steps'}>
        {(ar ? ['احتياجاتك', 'ميزانيتك', 'خطة أجهزتك'] : ['Your needs', 'Your budget', 'Your appliance plan']).map((label, i) => <li key={label} className="flex items-center gap-2"><span className="rounded-full bg-surface px-3 py-2">{i + 1}. {label}</span>{i < 2 && <Arrow size={14} aria-hidden="true" />}</li>)}
      </ol>
    </>}
    <div className="mt-4 flex flex-wrap gap-2">
      <Link prefetch={false} href={`/${locale}/home-mission?source=${source}`} onClick={() => trackHome('entry_click', source)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary-700 px-5 py-3 text-sm font-bold text-white">{ar ? 'ابدأ خطة بيتك' : 'Start your home plan'}</Link>
      {!compact && <Link prefetch={false} href={`/${locale}/home-mission/example?source=${source}`} onClick={() => trackHome('entry_click', source, 'example')} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary-700 px-4 py-3 text-sm font-bold text-primary-900 dark:text-primary-100">{ar ? 'شوف مثال لخطة جاهزة' : 'Explore a sample plan'}</Link>}
    </div>
    {!compact && <p className="mt-3 text-xs leading-6 text-on-surface-variant">{ar ? 'شارك خطتك مع أهلك وخذ رأيهم قبل الشراء.' : 'Share your plan with family before buying.'}</p>}
  </div>;
}
