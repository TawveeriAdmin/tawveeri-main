import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { runSweepUnit } from '../../../../../scripts/tps-core/progressive-engine';
import { CATEGORY_DEFS } from '../../../../../scripts/tps-core/category-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * POST /api/cron/tps-progressive — authenticated, hard-bounded progressive sweep.
 * Runs up to `batches` bounded sweep units (each ≤500 observations, durable global
 * cursor), classifying new observations across all evidence-backed categories and
 * corroborating them. Idempotent; resumable. Body: { batches?: 1..10, limit?: 1..500 }.
 * Keeps TPS coverage growing incrementally as the catalog ingests new products —
 * the ongoing complement to the one-time bulk backfill. Milestone 7 invariants
 * (≤500/run, category isolation, idempotency, ≥2-store + price-band) are enforced
 * by the engine. Returns a sanitized per-category summary (no secrets).
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { batches?: unknown; limit?: unknown };
  const batches = Math.min(10, Math.max(1, Number(body.batches) || 3));
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 500));

  const sb = createServerClient();
  const defs = Object.values(CATEGORY_DEFS);
  const agg: Record<string, { detected: number; valid: number; written: number }> = {};
  for (const d of defs) agg[d.category] = { detected: 0, valid: 0, written: 0 };
  let scanned = 0, ran = 0, saturated = false;
  try {
    for (let b = 0; b < batches; b++) {
      const r = await runSweepUnit(sb as never, defs, limit);
      ran++; scanned += r.normalize.fetched;
      for (const d of defs) {
        const cm = r.normalize.byCategory[d.category];
        agg[d.category].detected += cm.detected; agg[d.category].valid += cm.valid;
        agg[d.category].written += r.corroborate[d.category]?.canonicalsWritten ?? 0;
      }
      if (r.normalize.saturated) { saturated = true; break; }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, ran, scanned, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ran, scanned, saturated, byCategory: agg });
}
