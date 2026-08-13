import type { Metadata } from 'next';
import Link from 'next/link';
import { getCommandCenterData } from '@/lib/admin/command-center-queries';
import { fetchGrowthContent, GROWTH_STATUS_LABEL_AR, SOCIAL_STATUS } from '@/lib/admin/growth-queries';
import { GrowthReviewActions } from '@/components/admin/growth-review-actions';

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

export default async function GrowthPage() {
  const [data, content] = await Promise.all([
    getCommandCenterData('7d'),
    fetchGrowthContent().catch(() => []),
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

      {/* 2 — Distribution diagnosis (Gate B, evidence-dated) */}
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
