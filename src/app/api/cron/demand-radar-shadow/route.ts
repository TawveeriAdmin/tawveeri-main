// POST /api/cron/demand-radar-shadow — Radar 2.0 Phase 2, Checkpoint 4.
// Bearer CRON_SECRET, same contract as every other cron route.
//
// Deliberately MANUAL-TRIGGER ONLY in Checkpoints 1–4 — no recurring
// scheduler tick is wired up yet (unlike instrumentation.ts's automatic
// Radar 1 tick). Whether Shadow polls on a recurring cadence at all is its
// own future decision, not bundled into "implement Checkpoints 1–4." Every
// invocation runs the Control Parity check (§S/§M) — Radar 1's exact,
// unwidened queries, via the same adapter Radar 1 uses. No widened
// vocabulary exists anywhere in this route.

import { NextRequest, NextResponse } from 'next/server';
import { runShadowControlParity } from '@/lib/growth/demand-radar/shadow/shadow-control-parity';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let isTest = false;
  try {
    const body = await request.json();
    isTest = body?.isTest === true;
  } catch {
    /* default: real (isTest=false) */
  }
  try {
    const result = await runShadowControlParity({ isTest });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'shadow control-parity run failed' },
      { status: 500 }
    );
  }
}
