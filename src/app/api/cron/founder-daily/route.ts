// POST /api/cron/founder-daily — the Founder Operating Center's scheduled computation.
// Bearer CRON_SECRET (same convention as every /api/cron/* route). Triggered hourly by the
// isolated worker (scripts/worker/jobs/founder-daily.ts); self-gated so real work happens once
// per day after `summary_hour_riyadh` (default 08:00 Riyadh): snapshots the previous completed
// day + rolling windows, recomputes the last 7 completed days (late events), writes the daily
// summary, and on the first day of a month writes the previous month's report. No external send.
import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/founder/ledger';
import { snapshotWindows } from '@/lib/founder/snapshots';
import { generateSummary, latestSummary, scheduledSummaryWindows } from '@/lib/founder/summary';
import { riyadhMidnightDaysAgo, toRiyadh, windowFor, type MetricWindow } from '@/lib/founder/windows';
import { materializeExpectedExpenses } from '@/lib/founder/subscriptions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const force = req.nextUrl.searchParams.get('force') === '1';
  const now = new Date();
  const hour = Number((await getSetting<number>('summary_hour_riyadh')) ?? 8);
  const riyadhHour = toRiyadh(now).getUTCHours();
  const ledger: Record<string, unknown> = { now: now.toISOString(), riyadhHour, summaryHour: hour };
  // Subscription drafts (rule 1): idempotent, cheap, runs on every tick regardless of the hour.
  ledger.subscriptions = await materializeExpectedExpenses(null).catch((e) => ({ error: e instanceof Error ? e.message : 'failed' }));
  if (riyadhHour < hour && !force) return NextResponse.json({ skipped: 'before summary hour', ...ledger });

  const targets = scheduledSummaryWindows(now);
  const done: Array<{ kind: string; periodStart: string; status: string; aiStatus?: string }> = [];
  let snapshotRun: string | null = null;
  for (const t of targets) {
    const existing = await latestSummary(t.kind, t.window.start);
    if (existing && !force) { done.push({ kind: t.kind, periodStart: t.window.start.toISOString(), status: 'exists' }); continue; }
    if (!snapshotRun) {
      const windows: MetricWindow[] = [windowFor('7d', now), windowFor('30d', now), windowFor('month', now)];
      for (let d = 1; d <= 7; d++) {
        const start = riyadhMidnightDaysAgo(d, now), end = riyadhMidnightDaysAgo(d - 1, now);
        windows.push({ kind: 'day', start, end, partial: false, labelAr: `يوم ${toRiyadh(start).toISOString().slice(0, 10)}` });
      }
      const run = await snapshotWindows(windows);
      snapshotRun = run.runId;
      ledger.snapshots = run.windows.map((w) => ({ kind: w.window.kind, start: w.window.start.toISOString(), ok: w.result.ok, rows: w.rows }));
    }
    const record = await generateSummary(t.kind, t.window, { persist: true });
    done.push({ kind: t.kind, periodStart: t.window.start.toISOString(), status: 'generated', aiStatus: record.aiStatus });
  }
  return NextResponse.json({ ok: true, snapshotRun, summaries: done, ...ledger });
}
