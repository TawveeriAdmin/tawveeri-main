import type { SummaryRecord } from '@/lib/founder/summary';
import { formatRiyadh } from '@/lib/founder/windows';
import { FCard, Tag } from './ui';

function Block({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[11px] font-black text-[#1f6f59] dark:text-[#9fe4d0]">{title}</p>
      <ul className="mt-1 list-disc space-y-1 ps-4 text-sm leading-relaxed">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

export function SummaryView({ s }: { s: SummaryRecord }) {
  const d = s.deterministic;
  return (
    <FCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-black">{d.titleAr}</p>
          <p className="text-[11px] text-on-surface-variant dark:text-white/55">القطع: {d.cutoffAr} · وُلّد {formatRiyadh(s.generatedAt)} · التعريف {s.definitionVersion}</p>
        </div>
        <div className="flex gap-1"><Tag tone={s.partial ? 'warn' : 'good'}>{s.partial ? 'نافذة جزئية' : 'نافذة مكتملة'}</Tag><Tag tone={s.aiStatus === 'ok' ? 'good' : 'muted'}>{s.aiStatus === 'ok' ? 'تفسير AI موثق' : s.aiStatus === 'disabled' ? 'AI معطل' : s.aiStatus === 'rejected' ? 'AI مرفوض' : 'AI غير متاح'}</Tag></div>
      </div>
      <Block title="ماذا حدث؟" items={d.whatHappenedAr} />
      <Block title="ما الذي تغير مقارنة بالفترة السابقة المساوية؟" items={d.changedAr} />
      <Block title="أهم المنتجات والاحتياجات المطلوبة" items={d.topNeedsAr} />
      <Block title="ما الذي يخدمه النظام جيدًا؟" items={d.servingWellAr} />
      <Block title="عوائق مثبتة أو احتمالات تحتاج اختبارًا" items={d.blockersAr} />
      <Block title="كم صرفنا وكم ثبت وكم استلمنا؟" items={d.moneyAr} />
      <Block title="ما لا نعرفه" items={d.unknownsAr} />
      <div className="rounded-xl bg-[#eef8f4] p-3 dark:bg-white/5"><Block title="القرارات الأهم اليوم" items={d.decisionsAr} /></div>
      {s.ai ? (
        <div className="rounded-xl border border-dashed border-[#bfe3d6] p-3 dark:border-[#2c4a3f]">
          <p className="text-[11px] font-black text-on-surface-variant dark:text-white/60">تفسير الذكاء الاصطناعي — فرضيات فقط، لا أرقام جديدة (استند إلى: {s.ai.facts_used.join('، ')})</p>
          <Block title="تفسيرات ممكنة" items={s.ai.possible_explanations} />
          <Block title="ما يبقى مجهولًا" items={s.ai.unknowns} />
          {s.ai.one_experiment && <div className="mt-2 text-sm"><b>تجربة الأسبوع المقترحة:</b> {s.ai.one_experiment.title_ar} — <Tag>عدد مقترح: {s.ai.one_experiment.proposed_target}</Tag> — يُقاس بـ{s.ai.one_experiment.measure_ar}</div>}
        </div>
      ) : (
        <p className="text-[11px] text-on-surface-variant dark:text-white/50">{s.aiStatus === 'disabled' ? 'تفسير الذكاء الاصطناعي معطل (ENABLE_FOUNDER_AI_BRIEF). الملخص الحتمي أعلاه كامل ومستقل.' : `تعذر تحديث التفسير (${s.aiReason ?? 'بلا سبب'}). هذه آخر أرقام موثوقة حتى ${d.cutoffAr}.`}</p>
      )}
      <details className="text-[11px] text-on-surface-variant dark:text-white/55">
        <summary className="cursor-pointer font-bold">الحقائق المرجعية ({d.facts.length})</summary>
        <ul className="mt-1 space-y-0.5 tabular-nums">{d.facts.map((f, i) => <li key={i}>[{f.metricId}] {f.textAr} · السابق {f.previous ?? '—'} · {f.coverage}</li>)}</ul>
      </details>
    </FCard>
  );
}
