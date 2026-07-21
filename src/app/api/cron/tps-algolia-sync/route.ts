import { NextRequest, NextResponse } from 'next/server';
import { syncTpsIndex } from '../../../../../scripts/tps-algolia-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  return !!secret && auth === `Bearer ${secret}`;
}

/**
 * POST /api/cron/tps-algolia-sync — authenticated. Rebuilds the owned TPS
 * search index (tawveeri_tps_products) from tps_product_projection (atomic,
 * reproducible) and stamps algolia_synced_at. Zero live-search impact until the
 * E14 cutover. Run after a projection rebuild.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await syncTpsIndex();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'tps-algolia-sync', mode: 'read-only health' });
}
