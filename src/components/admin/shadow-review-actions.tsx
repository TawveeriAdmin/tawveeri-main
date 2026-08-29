'use client';

// Radar 2.0 Phase 2 — Checkpoint 3. Five labels only. Mirrors the existing
// RadarOpportunityActions pattern exactly (same fetch/PATCH shape), pointed
// at the new, separate /api/admin/growth/shadow-review route — never the
// production opportunities route.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LABELS: Array<{ label: string; text: string; cls: string }> = [
  { label: 'valuable', text: 'فرصة حقيقية', cls: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { label: 'not_a_lead', text: 'ليست فرصة', cls: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300' },
  { label: 'exclusion_noise', text: 'مسابقة/ضجيج', cls: 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300' },
  { label: 'cannot_answer', text: 'توفيري لا يستطيع المساعدة', cls: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-300' },
  { label: 'draft_quality_issue', text: 'فرصة صحيحة لكن صياغة الرد ضعيفة', cls: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-300' },
];

export function ShadowReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (label: string) => {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch('/api/admin/growth/shadow-review', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, label }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل الإجراء');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {LABELS.map((l) => (
        <button
          key={l.label}
          onClick={() => act(l.label)}
          disabled={busy !== null}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${l.cls}`}
        >
          {busy === l.label ? '…' : l.text}
        </button>
      ))}
      {error && <span className="text-xs text-red-600" dir="ltr">{error}</span>}
    </div>
  );
}
