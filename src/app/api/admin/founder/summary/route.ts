// POST /api/admin/founder/summary — generate a summary on demand for a window (kind on_demand for
// partial/custom windows, daily for a completed previous day). Persisted; no external send.
import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin, windowFromSearchParams } from '@/lib/founder/api';
import { generateSummary, listSummaries } from '@/lib/founder/summary';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = withAdmin(async () => NextResponse.json({ summaries: await listSummaries(30) }));

export const POST = withAdmin(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { w?: string; start?: string; end?: string; withAi?: boolean };
  const w = windowFromSearchParams(body);
  const kind = w.kind === 'day' ? 'daily' : w.kind === 'month' && !w.partial ? 'monthly' : 'on_demand';
  const record = await generateSummary(kind, w, { persist: true, withAi: body.withAi !== false });
  return NextResponse.json({ summary: record });
});
