import type { Metadata } from 'next';
import Link from 'next/link';
import { getCommandCenterData } from '@/lib/admin/command-center-queries';
import { fetchGrowthContent, GROWTH_STATUS_LABEL_AR, SOCIAL_STATUS } from '@/lib/admin/growth-queries';
import { GrowthReviewActions } from '@/components/admin/growth-review-actions';
import { fetchRadarSurface, OPPORTUNITY_STATUS_LABEL_AR } from '@/lib/admin/demand-radar-queries';
import { RadarOpportunityActions } from '@/components/admin/radar-opportunity-actions';
import { categoryNameAr } from '@/lib/growth/demand-radar/saudi-lexicon';

// Founder Growth surface (ADR-244 Gates D/E/F). The smallest useful review
// experience: trustworthy measurement, the distribution diagnosis, the content
// queue with WATCHABLE creatives + اعتماد/طلب تعديل/رفض, and the social
// connection truth board. Extends the existing admin — not a new application.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
      {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
      {children}
    </div>
  );
}

function relAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return '—';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  if (mins < 48 * 60) return `قبل ${Math.round(mins / 60)} ساعة`;
  return `قبل ${Math.round(mins / 1440)} يوم`;
}

export default async function GrowthPage() {
  const [data, content, radar] = await Promise.all([
    getCommandCenterData('7d'),
    fetchGrowthContent().catch(() => []),
    fetchRadarSurface().catch(() => null),
  ]);
  const f = data.real;
  const readyCount = content.filter((c) => c.status === 'ready_for_review').length;

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">النمو — Growth</h1>
          <p className="text-sm text-gray-500">آخر 7 أيام · بيانات حقيقية فقط (REAL) · <Link className="underline" href="command-center">لوحة التجارة الكاملة</Link></p>
        </div>
        {readyCount > 0 && (
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            {readyCount} محتوى جاهز للمراجعة
          </span>
        )}
      </div>

      {/* 1 — Measurement (the current truth) */}
      <Card title="القياس الحالي">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ['جلسات حقيقية', f.sessions],
            ['عمليات بحث', f.search],
            ['مقارنات', f.comparisonView],
            ['خروج لمتاجر (سجل الخروج)', f.outbound],
          ].map(([label, v]) => (
            <div key={String(label)} className="rounded-xl bg-gray-50 p-4 text-center dark:bg-white/5">
              <div className="text-3xl font-extrabold tabular-nums">{String(v)}</div>
              <div className="mt-1 text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          زيارات مؤهلة مُحالة: <b>{data.commercial.qualifiedVisitsReferred}</b> · أعلى طلب غير مُجاب:{' '}
          {data.unmetDemand.slice(0, 3).map((u) => `«${u.query}»`).join('، ') || '—'}
        </p>
      </Card>

      {/* 2 — مرصد الطلب (ADR-247): live purchase-intent opportunities */}
      <Card title="مرصد الطلب — فرص الآن">
        {!radar ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">تعذر تحميل المرصد — الحالة غير معروفة (وليست صفرًا).</p>
        ) : (
          <>
            {/* source truth strip: UNKNOWN is never rendered as zero */}
            <div className="mb-4 flex flex-wrap gap-3 text-xs">
              {radar.states.length === 0 && (
                <span className="rounded-full bg-gray-100 px-3 py-1.5 font-bold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  لم يعمل المصدر بعد — بانتظار تفعيل مفتاح X (لا يعني «صفر فرص»)
                </span>
              )}
              {radar.states.map((s) => (
                <span
                  key={s.source}
                  className={`rounded-full px-3 py-1.5 font-bold ${
                    s.last_poll_status === 'ok'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                  }`}
                >
                  {s.source === 'x' ? 'X' : s.source} · {s.last_poll_status ?? '—'} · آخر فحص: {relAgo(s.last_poll_at)}
                </span>
              ))}
              {radar.testCount > 0 && (
                <span className="rounded-full bg-blue-100 px-3 py-1.5 font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  {radar.testCount} فرصة تجريبية (TEST) — معزولة عن الأرقام الحقيقية
                </span>
              )}
            </div>

            {/* category demand visibility (§23) — REAL only */}
            {radar.categoryStats.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="pb-1 text-start">الفئة</th>
                      <th className="pb-1">فرص</th>
                      <th className="pb-1">قوية</th>
                      <th className="pb-1">متوسطة</th>
                      <th className="pb-1">معتمدة</th>
                      <th className="pb-1">رد يدوي</th>
                      <th className="pb-1">متجاهلة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {radar.categoryStats.map((s) => (
                      <tr key={s.category} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-1 font-bold">{categoryNameAr(s.category)}</td>
                        <td className="py-1 text-center tabular-nums">{s.candidates}</td>
                        <td className="py-1 text-center tabular-nums">{s.high}</td>
                        <td className="py-1 text-center tabular-nums">{s.medium}</td>
                        <td className="py-1 text-center tabular-nums">{s.approved}</td>
                        <td className="py-1 text-center tabular-nums">{s.replied}</td>
                        <td className="py-1 text-center tabular-nums">{s.dismissed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {radar.open.length === 0 ? (
              <p className="text-sm text-gray-500">
                لا فرص مفتوحة الآن — الصمت نتيجة صحيحة عندما لا توجد فرصة عالية الجودة.
              </p>
            ) : (
              <div className="space-y-4">
                {radar.open.map((op) => (
                  <div
                    key={op.id}
                    id={`op-${op.id}`}
                    className={`rounded-xl border p-4 ${
                      op.tier === 'high'
                        ? 'border-emerald-300 dark:border-emerald-700'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2.5 py-1 font-bold ${
                        op.tier === 'high'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                      }`}>
                        {op.tier === 'high' ? 'فرصة قوية' : 'فرصة متوسطة'}
                      </span>
                      <span className="font-bold">{categoryNameAr(op.category)}</span>
                      <span className="text-gray-500">{op.source === 'x' ? 'X' : op.source}</span>
                      {op.author_handle && <span className="text-gray-500" dir="ltr">@{op.author_handle}</span>}
                      <span className="text-gray-500">{relAgo(op.source_posted_at ?? op.first_seen_at)}</span>
                      {op.is_test && <span className="rounded-full bg-blue-100 px-2 py-0.5 font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">TEST</span>}
                      <span className="text-gray-400">{OPPORTUNITY_STATUS_LABEL_AR[op.status] ?? op.status}</span>
                    </div>

                    <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-sm leading-7 dark:bg-white/5">
                      {op.post_text}
                    </blockquote>

                    <ul className="mt-3 list-inside list-disc space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                      {(op.score_reasons ?? []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>

                    {op.suggested_reply && (
                      <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-7 dark:bg-emerald-500/10">
                        <b className="text-xs text-emerald-700 dark:text-emerald-300">الرد المقترح:</b>
                        <p className="mt-1 whitespace-pre-wrap">{op.suggested_reply}</p>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {op.suggested_query && <span>بحث توفيري المقترح: «{op.suggested_query}»</span>}
                      {op.tracking_url && (
                        <span dir="ltr" className="font-mono">{op.tracking_url}</span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <a
                        href={op.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-black dark:bg-white dark:text-gray-900"
                      >
                        فتح المنشور الأصلي ↗
                      </a>
                      <RadarOpportunityActions id={op.id} status={op.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-gray-500">
              الاعتماد إجراء داخلي — لا يُنشر أي رد تلقائيًا؛ الرد يظل فعلًا يدويًا منك، والرابط القصير أعلاه يقيس أثره حتى الخروج للمتاجر.
            </p>
          </>
        )}
      </Card>

      {/* 3 — Distribution diagnosis (Gate B, evidence-dated) */}
      <Card title="تشخيص الوصول (13 أغسطس 2026)">
        <ul className="list-inside list-disc space-y-2 text-sm leading-7">
          <li><b>القيد الحقيقي هو الوصول، لا المنتج:</b> فيديو تيك توك واحد (نُشر 6 أغسطس) حقق ~2,250 مشاهدة — وتزامن مع أعلى أيام زيارات حقيقية سجّلتها المنصة (65-75 جلسة/يوم في 8-10 أغسطس مقابل ~10 قبله). التجربة نجحت لكنها لم تكن قابلة للإسناد: رابط البايو بلا UTM.</li>
          <li><b>X وصوله شبه معدوم رغم التوثيق:</b> 31 منشورًا، آخرها ~26 مشاهدة — يتوافق مع أبحاث المنصة (الوصول يعتمد على شبكة تفاعل غير موجودة لحساب جديد).</li>
          <li><b>القناة الأساسية للموجة الأولى: تيك توك</b> — السعودية أعلى أسواقه اختراقًا، والوصول لا يعتمد على المتابعين رسميًا، وبحث تيك توك قناة نية شرائية عربية. X يبقى قناة ثانوية يدوية.</li>
          <li><b>ما تغيّر الآن:</b> كل رابط محتوى يحمل UTM ويُقاس حتى الخروج للمتجر (سجل الخروج يحمل الجلسة والحملة منذ ADR-244).</li>
        </ul>
      </Card>

      {/* 3 — Content review queue */}
      <Card title="محتوى للمراجعة">
        {content.length === 0 && <p className="text-sm text-gray-500">لا يوجد محتوى بعد.</p>}
        <div className="space-y-6">
          {content.map((c) => (
            <div key={c.content_id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs text-gray-400">{c.content_id}</span>
                  <h3 className="text-lg font-bold">{c.title || c.content_id}</h3>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold dark:bg-white/10">
                  {GROWTH_STATUS_LABEL_AR[c.status] ?? c.status} · {c.channel}
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-sm leading-7">
                  {c.why_now && <p><b>ليش هذا المحتوى الآن:</b> {c.why_now}</p>}
                  {c.hook && <p><b>الخطاف (أول ثانيتين):</b> «{c.hook}» {c.hook_family ? <span className="text-xs text-gray-400">(عائلة: {c.hook_family})</span> : null}</p>}
                  {c.evidence && (c.evidence as { production_query?: string }).production_query && (
                    <p><b>الاستعلام الحقيقي:</b> «{(c.evidence as { production_query?: string }).production_query}» — {(c.evidence as { verified?: string }).verified ?? ''}</p>
                  )}
                  {c.landing_url && (
                    <p className="break-all"><b>رابط الهبوط (بالتتبع):</b> <a className="text-emerald-700 underline dark:text-emerald-300" href={c.landing_url} target="_blank">{c.landing_url}</a></p>
                  )}
                  {c.founder_note && <p className="text-amber-700 dark:text-amber-300"><b>ملاحظتك السابقة:</b> {c.founder_note}</p>}
                  <div className="pt-2"><GrowthReviewActions contentId={c.content_id} currentStatus={c.status} /></div>
                </div>
                <div>
                  {c.video_url ? (
                    <video controls playsInline className="mx-auto max-h-[480px] rounded-xl border border-gray-200 dark:border-gray-700" src={c.video_url} />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400 dark:bg-white/5">
                      لا يوجد فيديو بعد — {GROWTH_STATUS_LABEL_AR[c.status] ?? c.status}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 4 — Social connection truth board */}
      <Card title="حالة الحسابات الاجتماعية">
        <div className="grid gap-4 md:grid-cols-2">
          {SOCIAL_STATUS.map((s) => (
            <div key={s.channel} className="rounded-xl border border-gray-200 p-4 text-sm leading-7 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <b>{s.channel} — {s.handle}</b>
                <span className="text-xs text-gray-400">تحقق مباشر: {s.verifiedAt}</span>
              </div>
              <p className="mt-2">{s.state}</p>
              <p className="mt-1 text-gray-500">{s.apiState}</p>
              <p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">الحاجز: {s.blocker}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          لا يُنشر أي محتوى خارجيًا إلا بقرارك — النظام يجهّز ويقيس فقط. لا نطلب كلمات مرور؛ الربط عبر OAuth الرسمي فقط.
        </p>
      </Card>
    </div>
  );
}
