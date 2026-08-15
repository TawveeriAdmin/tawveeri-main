// POST /api/cron/demand-radar — Demand Radar tick (ADR-247).
// Bearer CRON_SECRET (same contract as every cron route; rate-limit exempt).
// Body: { "source": "x" | "mock" } — mock runs are ALWAYS marked TEST and are
// the production-verification path; x runs are REAL (requires the bearer token,
// otherwise the run reports 'unconfigured' honestly, never zero).

import { NextRequest, NextResponse } from 'next/server';
import { runDemandRadar } from '@/lib/growth/demand-radar/pipeline';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let source: 'x' | 'mock' = 'x';
  try {
    const body = await request.json();
    if (body?.source === 'mock') source = 'mock';
  } catch {
    /* default: x */
  }
  try {
    const result = await runDemandRadar({ source });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'radar run failed' },
      { status: 500 }
    );
  }
}
