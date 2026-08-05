import type { Metadata } from 'next';
import Link from 'next/link';
import { Lightbulb, ArrowLeft, ArrowRight } from 'lucide-react';
import { getCommandCenterData, type Period } from '@/lib/admin/command-center-queries';
import { computeOpportunities } from '@/lib/admin/opportunities';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  const isRTL = locale === 'ar';
  const sp = await searchParams;
  const period: Period = (sp.period as Period) || '30d';

  const data = await getCommandCenterData(period);
  const opportunities = computeOpportunities(data);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
        <Link href={`/${locale}/admin/command-center`} className="inline-flex items-center gap-1.5 text-xs font-black text-on-surface-variant hover:text-on-surface dark:text-white/60">
          <BackIcon className="h-3.5 w-3.5" /> {isRTL ? 'مركز القيادة' : 'Command Center'}
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-[#1f6f59] dark:text-[#9fe4d0]" />
          <h1 className="text-2xl font-black tracking-tight text-on-surface dark:text-white">{isRTL ? 'الفرص التجارية' : 'Commercial Opportunities'}</h1>
        </div>
        <p className="mt-2 text-sm text-on-surface-variant dark:text-white/60">
          {isRTL
            ? 'إشارات مبنية على الأدلة فقط — لا تخمين. كل فرصة تعرض دليلها وحجم العينة والإجراء المقترح.'
            : 'Evidence-based signals only — no guessing. Each opportunity shows its evidence, sample size, and recommended action.'}
        </p>
      </section>

      {opportunities.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-[#bfe7dc] bg-white p-10 text-center dark:border-[#315145] dark:bg-[#141c18]">
          <p className="font-black text-on-surface dark:text-white">{isRTL ? 'لا توجد فرص واضحة بعد' : 'No clear opportunities yet'}</p>
          <p className="mt-1 text-sm text-on-surface-variant dark:text-white/60">
            {isRTL ? 'العينة الحالية صغيرة جداً لاستخلاص إشارات موثوقة.' : 'The current sample is too small to draw reliable signals.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((o, i) => (
            <div key={i} className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-black text-on-surface dark:text-white">{isRTL ? o.titleAr : o.titleEn}</h2>
                {o.earlySignal && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {isRTL ? 'إشارة مبكرة' : 'EARLY SIGNAL'}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-on-surface-variant dark:text-white/60">{isRTL ? o.evidenceAr : o.evidenceEn}</p>
              <p className="mt-3 rounded-xl bg-[#f8fcfa] p-3 text-sm font-bold text-[#1f6f59] dark:bg-[#101713] dark:text-[#9fe4d0]">
                {isRTL ? 'الإجراء المقترح: ' : 'Recommended action: '}{isRTL ? o.recommendedActionAr : o.recommendedActionEn}
              </p>
              <p className="mt-2 text-[11px] text-on-surface-variant dark:text-white/40">{isRTL ? 'حجم العينة' : 'Sample size'}: {o.sampleSize}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
