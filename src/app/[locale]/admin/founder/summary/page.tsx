import { windowFromSearchParams } from '@/lib/founder/api';
import { listSummaries } from '@/lib/founder/summary';
import { getSetting } from '@/lib/founder/ledger';
import { formatRiyadh } from '@/lib/founder/windows';
import { FCard, SectionTitle, WindowPicker, EmptyNote } from '@/components/founder/ui';
import { SummaryView } from '@/components/founder/summary-view';
import { GenerateSummaryButton } from '@/components/founder/forms';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string; id?: string };

export default async function SummaryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const base = `/${locale}/admin/founder/summary`;
  const [summaries, hour] = await Promise.all([listSummaries(40), getSetting<number>('summary_hour_riyadh')]);
  const selected = sp.id ? summaries.find((s) => s.id === sp.id) : summaries[0];
  const daily = summaries.filter((s) => s.kind === 'daily'); const monthly = summaries.filter((s) => s.kind === 'monthly');

  return (
    <div className="space-y-6">
      <FCard className="space-y-3">
        <WindowPicker current={w} basePath={base} sp={sp} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-on-surface-variant dark:text-white/55">الملخص اليومي يُولَّد تلقائيًا لليوم المكتمل السابق بعد الساعة {hour ?? 8}:00 صباحًا بتوقيت السعودية (عامل الخلفية)، والتقرير الشهري أول كل شهر. التوليد اليدوي يخص النافذة المختارة أعلاه.</p>
          <GenerateSummaryButton sp={sp} />
        </div>
      </FCard>
      {selected ? <SummaryView s={selected} /> : <EmptyNote>لا ملخص بعد — ولّد واحدًا الآن أو انتظر تشغيل الصباح.</EmptyNote>}
      <div className="grid gap-4 md:grid-cols-2">
        <FCard><SectionTitle>الملخصات اليومية</SectionTitle>{daily.length ? <ul className="space-y-1 text-xs">{daily.map((s) => <li key={s.id}><a className="underline decoration-dotted" href={`${base}?id=${s.id}`}>{s.deterministic.titleAr}</a> · {formatRiyadh(s.generatedAt)}</li>)}</ul> : <EmptyNote>لا شيء بعد</EmptyNote>}</FCard>
        <FCard><SectionTitle>التقارير الشهرية وعند الطلب</SectionTitle>{monthly.length + summaries.filter((s) => s.kind === 'on_demand').length ? <ul className="space-y-1 text-xs">{[...monthly, ...summaries.filter((s) => s.kind === 'on_demand')].map((s) => <li key={s.id}><a className="underline decoration-dotted" href={`${base}?id=${s.id}`}>{s.deterministic.titleAr}</a> · {formatRiyadh(s.generatedAt)}</li>)}</ul> : <EmptyNote>لا شيء بعد</EmptyNote>}</FCard>
      </div>
    </div>
  );
}
