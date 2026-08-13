'use client';

// Founder review actions for a growth-content item (ADR-244 Gate D).
// اعتماد / طلب تعديل / رفض — approval is NOT publication; nothing auto-posts.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GrowthReviewActions({ contentId, currentStatus }: { contentId: string; currentStatus: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  const act = async (status: 'approved' | 'changes_requested' | 'rejected') => {
    if (busy) return;
    if (status === 'changes_requested' && !showNote) { setShowNote(true); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/growth/content', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content_id: contentId, status, note: note || undefined }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (currentStatus === 'approved') {
    return <div className="text-sm font-semibold text-emerald-600">✓ معتمد — جاهز للنشر اليدوي (النشر قرار بشري، لا يُنشر آليًا)</div>;
  }

  return (
    <div className="space-y-2">
      {showNote && (
        <textarea
          className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          rows={2}
          placeholder="وش التعديل المطلوب؟ (تُعاد الملاحظة لخط الإنتاج — ما تحتاج تعدّل الفيديو بنفسك)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          dir="rtl"
        />
      )}
      <div className="flex gap-2" dir="rtl">
        <button onClick={() => act('approved')} disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
          اعتماد
        </button>
        <button onClick={() => act('changes_requested')} disabled={busy}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">
          {showNote ? 'إرسال طلب التعديل' : 'طلب تعديل'}
        </button>
        <button onClick={() => act('rejected')} disabled={busy}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
          رفض
        </button>
      </div>
    </div>
  );
}
