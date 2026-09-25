import Link from 'next/link';
import { windowFromSearchParams } from '@/lib/founder/api';
import { buildOverview } from '@/lib/founder/overview';
import { COMMISSION_STATE_AR, type CommissionState } from '@/lib/founder/finance';
import { PARTNER_LABEL_AR } from '@/lib/founder/registry';
import { FCard, SectionTitle, WindowPicker, EmptyNote, Tag, KV, Sar } from '@/components/founder/ui';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string };

export default async function ReferralsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const o = await buildOverview(w, { includeDemand: false });
  const base = `/${locale}/admin/founder/referrals`;
  const r = o.referrals; const rev = o.money?.revenue ?? null;

  return (
    <div className="space-y-6">
      <FCard><WindowPicker current={w} basePath={base} sp={sp} /></FCard>
      <FCard tone="muted" className="text-xs leading-relaxed">
        <b>مراحل الإثبات منفصلة ولا تُجمع:</b> ضغطة مسجلة داخل توفيري (حدث واجهة) ← ضغطة مطابقة لسجل /go بالمعرّف نفسه (خروج مرتبط) ← وصول أبلغ عنه التاجر (<Tag>غير متاح</Tag> لا يُستخرج من /go) ← طلب أبلغ عنه الشريك ← عمولة معلقة / معتمدة / ملغاة / مدفوعة. الطلبات الخام (بما فيها الآلية وبلا معرّف) في العمود الأخير كجودة بيانات فقط.
      </FCard>

      <section>
        <SectionTitle sub={`${r.totals.linkedInteractions} خروج مرتبط · ${r.totals.recordedClicks} ضغطة مسجلة · ${r.totals.rawRows} طلب خام (${r.totals.rowsWithSession} منها بمعرّف)`}>المتاجر</SectionTitle>
        {!r.ok ? <EmptyNote>{r.reason ?? 'غير متاح'}</EmptyNote> : r.stores.length === 0 ? <EmptyNote>لا إحالات في الفترة</EmptyNote> : (
          <FCard className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-[#f8fcfa] text-[11px] font-black text-on-surface-variant dark:bg-white/5 dark:text-white/60">
                <tr>{['المتجر', 'ضغطة مسجلة (متصفحات)', 'خروج مرتبط (متصفحات)', 'منتجات', 'وصول التاجر', 'طلبات الشريك', 'عمولة الشريك', 'أعلى القنوات', 'خام / بمعرّف'].map((h) => <th key={h} className="px-3 py-2 text-start">{h}</th>)}</tr>
              </thead>
              <tbody>
                {r.stores.map((s) => {
                  const partner = rev && (s.slug === 'amazon' || s.slug === 'noon') ? rev : null;
                  const covered = partner?.coverage.find((c) => c.source.startsWith(s.slug))?.covered ?? false;
                  return (
                    <tr key={s.slug} className="border-t border-[#eef6f2] align-top tabular-nums dark:border-white/10">
                      <td className="px-3 py-2"><b>{s.nameAr}</b> {s.affiliate && <Tag tone="good">برنامج شريك</Tag>}<div className="mt-1"><Link className="text-[11px] underline decoration-dotted" href={`/${locale}/admin/founder/reports?kind=store&store=${s.slug}${sp.w ? `&w=${sp.w}` : ''}${sp.start && sp.end ? `&start=${sp.start}&end=${sp.end}` : ''}`}>تقرير المتجر ←</Link></div></td>
                      <td className="px-3 py-2">{s.recordedClicks} ({s.recordedClickBrowsers})</td>
                      <td className="px-3 py-2 font-black">{s.linkedInteractions} ({s.linkedBrowsers})</td>
                      <td className="px-3 py-2">{s.products}</td>
                      <td className="px-3 py-2"><Tag>غير متاح</Tag></td>
                      <td className="px-3 py-2">{!s.affiliate ? '—' : !covered ? <Tag>غير معلوم</Tag> : `${partner!.orders + partner!.items + partner!.aggregates}`}</td>
                      <td className="px-3 py-2">{!s.affiliate ? '—' : !covered ? <Tag>غير معلوم</Tag> : <Sar v={partner!.confirmedSar} />}</td>
                      <td className="px-3 py-2 text-[11px]">{s.channels.slice(0, 3).map((c) => `${c.channel}${c.campaign !== 'unknown' ? `/${c.campaign}` : ''}: ${c.linked}`).join(' · ') || '—'}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{s.rawRows} / {s.rowsWithSession}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </FCard>
        )}
        <p className="mt-2 text-[11px] text-on-surface-variant dark:text-white/50">طلبات/عمولات الشريك تُعرض على مستوى المصدر (أمازون، نون) وفق ما يتيحه تقريره؛ لا إسناد لكل نقرة إن لم يعطِ الشريك مفتاحًا. روابط الأفلييت وترتيب المقارنة غير مُعدّلة.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <FCard>
          <SectionTitle sub="utm_source على صف الخروج المطابق؛ unknown = لم تُسجل قناة.">القنوات</SectionTitle>
          {r.byChannel.length ? <KV rows={r.byChannel.map((c) => ({ k: c.channel, v: `${c.linked} خروج مرتبط · ${c.linkedBrowsers} متصفح`, note: `${c.raw} طلب خام` }))} /> : <EmptyNote>لا بيانات</EmptyNote>}
        </FCard>
        <FCard>
          <SectionTitle action={<Link href={`/${locale}/admin/affiliate`} className="text-xs font-black text-[#1f6f59] underline decoration-dotted">رفع تقرير شريك ←</Link>}>نتائج الشركاء للفترة</SectionTitle>
          {!rev ? <EmptyNote>غير متاح</EmptyNote> : (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-2">{rev.coverage.map((c) => <Tag key={c.source} tone={c.covered ? 'good' : 'muted'}>{PARTNER_LABEL_AR[c.source]}: {c.covered ? 'مغطى' : 'غير معلوم'}</Tag>)}</div>
              {rev.coverageState === 'coverage_missing' ? <EmptyNote>لا تقرير شريك مستورد ولا إدخال موثق يغطي الفترة — الطلبات والعمولات غير معلومة، ليست صفرًا.</EmptyNote> : (
                <KV rows={(Object.entries(rev.byState) as Array<[CommissionState, { sar: number; rows: number; units: number; unconverted: number }]>).filter(([, v]) => v.rows > 0).map(([k, v]) => ({ k: COMMISSION_STATE_AR[k], v: <><Sar v={v.sar} /> · {v.rows} صف · {v.units} وحدة</>, note: v.unconverted ? `${v.unconverted} بلا تحويل` : undefined }))} />
              )}
              <p className="text-[11px] text-on-surface-variant dark:text-white/50">التغطية تعني وجود تقرير أو إدخال يتقاطع مع النافذة، لا اكتمال كل أيامها. الوحدة كما يعرضها الشريك (طلب/بند/مجموع).</p>
            </div>
          )}
        </FCard>
      </div>
    </div>
  );
}
