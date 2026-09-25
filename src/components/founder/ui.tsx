// src/components/founder/ui.tsx — server-renderable primitives for the Founder Operating Center.
// Every number rendered through MetricCard carries its definition, window, coverage and
// "proves / does not prove" boundary. Visual grammar: documented (green), estimated/partial
// (amber), unavailable/unknown (grey, never a zero).
import Link from 'next/link';
import { METRICS } from '@/lib/founder/registry';
import { deltaText, ratioText, type CoverageState, type MetricValue } from '@/lib/founder/metrics';
import { formatRiyadh, type MetricWindow, type WindowKind } from '@/lib/founder/windows';

export function FCard({ children, className = '', tone = 'default', id }: { children: React.ReactNode; className?: string; tone?: 'default' | 'accent' | 'warn' | 'critical' | 'muted'; id?: string }) {
  const tones = {
    default: 'border-[#d7ece5] bg-white dark:border-[#263b33] dark:bg-[#141c18]',
    accent: 'border-[#bfe3d6] bg-[#eef8f4] dark:border-[#2c4a3f] dark:bg-[#15221d]',
    warn: 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
    critical: 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10',
    muted: 'border-[#e6eeea] bg-[#f8fbfa] dark:border-[#263b33] dark:bg-[#101713]',
  } as const;
  return <div id={id} className={`rounded-[1.25rem] border p-4 md:p-5 ${tones[tone]} ${className}`}>{children}</div>;
}

export function SectionTitle({ children, sub, action }: { children: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-black text-on-surface dark:text-white">{children}</h2>
        {sub && <p className="mt-0.5 text-xs text-on-surface-variant dark:text-white/55">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const COVERAGE_STYLE: Record<CoverageState, string> = {
  complete: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  coverage_missing: 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-white/60',
  unavailable: 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-white/60',
};
const COVERAGE_LABEL: Record<CoverageState, string> = { complete: 'موثق', partial: 'نافذة جزئية', coverage_missing: 'غير معلوم', unavailable: 'غير متاح' };

export function Pill({ state, text }: { state: CoverageState; text?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${COVERAGE_STYLE[state]}`}>{text ?? COVERAGE_LABEL[state]}</span>;
}

export function Tag({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'good' | 'warn' | 'bad' }) {
  const t = { muted: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/60', good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300', warn: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', bad: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300' }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${t}`}>{children}</span>;
}

export function MetricCard({ metric, previous, hint }: { metric: MetricValue; previous?: MetricValue | null; hint?: string }) {
  const def = METRICS[metric.id];
  const unavailable = metric.numerator == null;
  const n = metric.numerator ?? 0;
  const value = unavailable ? (metric.coverage === 'coverage_missing' ? 'غير معلوم' : 'غير متاح')
    : metric.denominator != null ? `${n}/${metric.denominator}` : metric.unit === 'sar' ? `${n.toLocaleString('en-US')} ر.س` : n.toLocaleString('en-US');
  const pct = metric.numerator != null && metric.denominator ? `${((metric.numerator / metric.denominator) * 100).toFixed(1)}% من ${METRICS[def.denominatorKey === 'search_sessions' ? 'S01' : metric.id]?.shortAr ?? 'المقام'}` : null;
  const d = previous ? deltaText(metric.numerator, previous.numerator) : null;
  return (
    <FCard className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black text-on-surface-variant dark:text-white/60">{def.nameAr}</p>
        <Pill state={metric.coverage} />
      </div>
      <p className={`text-3xl font-black tabular-nums tracking-tight ${unavailable ? 'text-gray-500 dark:text-white/50' : 'text-on-surface dark:text-white'}`}>{value}</p>
      <p className="text-[11px] text-on-surface-variant dark:text-white/55">{unavailable ? (metric.reason ?? hint ?? def.definitionAr) : (pct ?? hint ?? `وحدة العد: ${unitAr(metric.unit)}`)}</p>
      {d && !unavailable && (
        <p className="text-[11px] text-on-surface-variant dark:text-white/55">
          الفترة السابقة المساوية: <span className="font-bold tabular-nums">{previous?.denominator != null ? ratioText(previous.numerator, previous.denominator) : d.previous}</span>
          {' '}<span className={d.absolute > 0 ? 'text-emerald-700 dark:text-emerald-300' : d.absolute < 0 ? 'text-amber-700 dark:text-amber-300' : ''}>({d.absolute >= 0 ? '+' : '−'}{Math.abs(d.absolute)}{d.previous > 0 ? `، ${d.pctText}` : ''})</span>
        </p>
      )}
      {previous && unavailable === false && !d && <p className="text-[11px] text-gray-500">الفترة السابقة: غير متاحة</p>}
      <details className="mt-1 text-[11px] text-on-surface-variant dark:text-white/55">
        <summary className="cursor-pointer select-none font-bold">التعريف والمصدر والحدود</summary>
        <div className="mt-1 space-y-1 leading-relaxed">
          <p><b>التعريف:</b> {def.definitionAr}</p>
          <p><b>يثبت:</b> {def.provesAr}</p>
          <p><b>لا يثبت:</b> {def.notProvesAr}</p>
          <p><b>المصدر:</b> {def.source} · <b>الإصدار:</b> {metric.version} · <b>الثقة الدلالية:</b> {def.confidence === 'high' ? 'عالية' : def.confidence === 'medium' ? 'متوسطة' : 'منخفضة'}</p>
          <p><b>النافذة:</b> {metric.window.labelAr} · <b>الحساب:</b> {formatRiyadh(metric.computedAt)} · <b>آخر حدث:</b> {formatRiyadh(metric.lastEventAt)}</p>
        </div>
      </details>
    </FCard>
  );
}

export function unitAr(unit: string): string {
  return ({ browsers: 'معرّفات متصفح', visits: 'زيارات', events: 'أحداث', rows: 'صفوف', interactions: 'تفاعلات', products: 'منتجات', sar: 'ريال', orders: 'طلبات/بنود', items: 'بنود', ratio: 'نسبة' } as Record<string, string>)[unit] ?? unit;
}

export function KV({ rows }: { rows: Array<{ k: React.ReactNode; v: React.ReactNode; note?: React.ReactNode }> }) {
  return (
    <dl className="divide-y divide-[#eef6f2] dark:divide-white/10">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
          <dt className="text-xs text-on-surface-variant dark:text-white/60">{r.k}</dt>
          <dd className="text-sm font-black tabular-nums text-on-surface dark:text-white">{r.v}</dd>
          {r.note && <p className="w-full text-[11px] text-on-surface-variant dark:text-white/50">{r.note}</p>}
        </div>
      ))}
    </dl>
  );
}

export function Sar({ v }: { v: number | null | undefined }) {
  return <span className="tabular-nums">{v == null ? 'غير متاح' : `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ر.س`}</span>;
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[#d7ece5] p-4 text-center text-xs text-on-surface-variant dark:border-[#263b33] dark:text-white/50">{children}</p>;
}

const WINDOWS: Array<{ kind: WindowKind; label: string }> = [
  { kind: 'day', label: 'أمس' }, { kind: '7d', label: '7 أيام' }, { kind: '30d', label: '30 يومًا' }, { kind: 'month', label: 'هذا الشهر' },
];

export function WindowPicker({ current, basePath, sp }: { current: MetricWindow; basePath: string; sp: { w?: string; start?: string; end?: string } }) {
  const activeKind = sp.start && sp.end ? 'custom' : (sp.w ?? 'month');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((w) => (
          <Link key={w.kind} href={`${basePath}?w=${w.kind}`} className={`rounded-full px-3 py-1.5 text-xs font-black ${activeKind === w.kind ? 'bg-[#1f6f59] text-white' : 'border border-[#d7ece5] text-on-surface-variant hover:bg-[#f8fcfa] dark:border-[#263b33] dark:text-white/60'}`}>{w.label}</Link>
        ))}
        <form method="get" className="flex flex-wrap items-center gap-1.5 text-xs">
          <input type="date" name="start" defaultValue={sp.start} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]" />
          <input type="date" name="end" defaultValue={sp.end} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]" />
          <button type="submit" className="rounded-lg bg-[#1f6f59] px-3 py-1 font-black text-white">تطبيق</button>
        </form>
      </div>
      <p className="text-[11px] text-on-surface-variant dark:text-white/55">
        <b>{current.labelAr}</b> · من {formatRiyadh(current.start)} إلى {formatRiyadh(current.end)} بتوقيت السعودية{current.partial ? ' · نافذة جزئية حتى وقت القراءة' : ' · نافذة مكتملة'}
      </p>
    </div>
  );
}

export function qs(sp: { w?: string; start?: string; end?: string }): string {
  const p = new URLSearchParams();
  if (sp.start && sp.end) { p.set('start', sp.start); p.set('end', sp.end); } else if (sp.w) p.set('w', sp.w);
  const s = p.toString();
  return s ? `?${s}` : '';
}
