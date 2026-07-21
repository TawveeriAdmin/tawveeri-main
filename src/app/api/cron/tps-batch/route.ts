import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { runMobileBatch } from '../../../../../scripts/tps-matcher/mobile-matcher-v2-dry';
import { runAcBatch } from '../../../../../scripts/tps-matcher/ac-matcher-v1-dry';
import { TPS_MAX_OBSERVATIONS, TPS_MIN_OBSERVATIONS, type TpsCategory, type TpsBatchResult } from '../../../../../scripts/tps-core/tps-batch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const FINGERPRINT = 'vyceqrzttspyycdpojtn';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  return !!secret && auth === `Bearer ${secret}`;
}

/**
 * POST /api/cron/tps-batch  — authenticated, category-isolated, hard-bounded (<=500)
 * TPS batch. One category and one bounded batch per request. Overlap-protected
 * via an atomic category-scoped lock (tps_acquire_run). Body:
 *   { category: 'mobile'|'air_conditioner', limit: 1..500, dryRun?: boolean }
 * dryRun defaults to TRUE. Returns a sanitized execution summary (no secrets).
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { category?: string; limit?: unknown; dryRun?: boolean };
  const category = body.category as TpsCategory;
  const limit = Number(body.limit);
  const dryRun = body.dryRun !== false; // default true — writes require an explicit dryRun:false

  if (category !== 'mobile' && category !== 'air_conditioner') {
    return NextResponse.json({ error: "category must be 'mobile' or 'air_conditioner' (no 'all')" }, { status: 400 });
  }
  if (!Number.isInteger(limit)) return NextResponse.json({ error: 'limit is required and must be an integer' }, { status: 400 });
  if (limit > TPS_MAX_OBSERVATIONS) return NextResponse.json({ error: `limit ${limit} exceeds hard bound ${TPS_MAX_OBSERVATIONS}` }, { status: 400 });
  if (limit < TPS_MIN_OBSERVATIONS) return NextResponse.json({ error: `limit ${limit} below minimum ${TPS_MIN_OBSERVATIONS}` }, { status: 400 });

  const supabase = createServerClient();

  // Atomic category-scoped overlap lock (both dry-run and write acquire it, so a
  // write can never run concurrently with another same-category run).
  const { data: runId, error: lockErr } = await supabase.rpc('tps_acquire_run', { p_category: category, p_source: 'schedule', p_stale_min: 30 });
  if (lockErr) return NextResponse.json({ error: 'lock acquisition failed', detail: lockErr.message }, { status: 500 });
  if (runId === null || runId === undefined) {
    return NextResponse.json({ error: 'overlap: a same-category TPS run is already active', overlapRejected: true, category }, { status: 409 });
  }

  let result: TpsBatchResult | { success: false; error: string };
  try {
    const run = category === 'mobile' ? runMobileBatch : runAcBatch;
    result = await run({ category, dryRun, limit, expectedFingerprint: FINGERPRINT, source: 'schedule', runId: Number(runId) });
  } catch (e) {
    result = { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  const status = result.success ? 'success' : 'failed';
  // Sanitized metadata only — no env values or secrets.
  await supabase.rpc('tps_finish_run', {
    p_run_id: Number(runId),
    p_status: status,
    p_metadata: { buildSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null, ...result },
  });

  return NextResponse.json({ runId: Number(runId), ...result }, { status: result.success ? 200 : 500 });
}

// Read-only health/status. GET can never mutate state.
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'tps-batch',
    mode: 'read-only health',
    contract: { method: 'POST', auth: 'Bearer CRON_SECRET', categories: ['mobile', 'air_conditioner'], maxLimit: TPS_MAX_OBSERVATIONS, dryRunDefault: true },
  });
}
