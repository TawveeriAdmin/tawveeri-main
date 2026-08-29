// POST /api/cron/demand-radar-shadow-recommendation — Radar 2.0 Phase 2,
// Checkpoint 5 (founder decision 2026-08-29). Bearer CRON_SECRET, same
// contract as every other cron route. Manual-trigger only — no recurring
// scheduler tick, matching Checkpoint 4's precedent. Runs ONLY the approved
// PRODUCT_RECOMMENDATION × {mobile, laptop, air_conditioner} experiment —
// no other family, no other category exists in this route.

import { NextRequest, NextResponse } from 'next/server';
import { runShadowRecommendationExperiment } from '@/lib/growth/demand-radar/shadow/shadow-recommendation-experiment';

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
    const result = await runShadowRecommendationExperiment({ isTest });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'shadow recommendation experiment failed' },
      { status: 500 }
    );
  }
}
