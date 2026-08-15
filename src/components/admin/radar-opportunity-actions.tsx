'use client';

// Founder actions on a radar opportunity (ADR-247 §22). Approval is internal —
// nothing here publishes. «تم الرد يدوياً» is the signal that ties the
// opportunity's tracking link to a real manual reply.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ACTIONS: Array<{ action: string; label: string; cls: string }> = [
  { action: 'approved', label: 'اعتماد الرد', cls: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { action: 'replied_manually', label: 'تم الرد يدوياً', cls: 'bg-blue-600 text-white hover:bg-blue-700' },
  { action: 'changes_requested', label: 'اطلب تعديل', cls: 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300' },
  { action: 'dismissed', label: 'تجاهل', cls: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300' },
];

export function MentionActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (action: string) => {
    setBusy(action);
    try {
      await fetch('/api/admin/growth/opportunities', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action, kind: 'mention' }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex gap-2">
      {[
        { action: 'replied_manually', label: 'تم الرد يدويًا', cls: 'bg-blue-600 text-white hover:bg-blue-700' },
        { action: 'reviewed', label: 'تمت المراجعة', cls: 'bg-emerald-600 text-white hover:bg-emerald-700' },
        { action: 'dismissed', label: 'تجاهل', cls: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300' },
      ].map((a) => (
        <button
          key={a.action}
          onClick={() => act(a.action)}
          disabled={busy !== null || status === a.action}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${a.cls}`}
        >
          {busy === a.action ? '…' : a.label}
        </button>
      ))}
    </div>
  );
}

export function RadarOpportunityActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: string) => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch('/api/admin/growth/opportunities', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action }),
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
      {ACTIONS.map((a) => (
        <button
          key={a.action}
          onClick={() => act(a.action)}
          disabled={busy !== null || status === a.action}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${a.cls}`}
        >
          {busy === a.action ? '…' : a.label}
        </button>
      ))}
      {error && <span className="text-xs text-red-600" dir="ltr">{error}</span>}
    </div>
  );
}
