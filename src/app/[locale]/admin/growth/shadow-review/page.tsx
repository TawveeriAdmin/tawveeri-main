import type { Metadata } from 'next';
import { listPendingShadowReview } from '@/lib/growth/demand-radar/shadow/shadow-review';
import { ShadowReviewActions } from '@/components/admin/shadow-review-actions';

// Radar 2.0 Phase 2 — Checkpoint 3: Shadow Sample Review. The ONLY
// founder-facing Shadow surface. Deliberately NOT linked from the main
// /admin/growth page in this checkpoint — reached directly by URL only,
// so it is never confused with the real, live founder inbox. Protected by
// the same /admin/* middleware gate as every other admin route (no
// additional auth code needed here — see src/middleware.ts). Read-only
// server component; all mutation goes through ShadowReviewActions'
// PATCH call to /api/admin/growth/shadow-review.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ShadowReviewPage() {
  const rows = await listPendingShadowReview(20);

  return (
    <div className="mx-auto max-w-4xl p-6" dir="rtl">
      <div className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-500/10">
        <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
          مرصد الظل (Shadow) — Radar 2.0 Phase 2، Checkpoint 3
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          هذه ليست فرص إنتاج حقيقية ولا تُرسل بريدًا. المحتوى الخام لكل عنصر يُحذف تلقائيًا بعد 72 ساعة (§T)؛ التصنيف
          فقط يبقى كسجل منفصل تمامًا عن جداول Radar 1.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">لا توجد عناصر بانتظار المراجعة حاليًا.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[#d7ece5] bg-white p-4 dark:border-[#263b33] dark:bg-[#141c18]">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {r.is_test && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">TEST</span>}
                <span>{r.category ?? 'غير مصنّف'}</span>
                <span>·</span>
                <span>{r.retrieved_by_radar1 ? 'وجدها Radar 1 أيضًا' : 'لم يجدها Radar 1'}</span>
              </div>
              <blockquote className="mb-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/5">{r.post_text}</blockquote>
              <ShadowReviewActions id={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
