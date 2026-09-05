import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getSession } from '@/lib/auth/server';
import { runShadowEvaluationForProductView } from '@/lib/campaigns/shadow-commerce';
import type { AcquisitionCampaign } from '@/lib/campaigns/traffic-eligibility';

/** Minimal, independent utm_source/utm_medium read from the SAME tw_campaign cookie shape
 *  src/app/go/[offerId]/route.ts's readAttribution() parses — NOT a shared import, so this
 *  route can never regress the live, heavily-tested /go path. Only the 2 fields the
 *  traffic-eligibility classifier needs (traffic-eligibility.ts's AcquisitionCampaign). */
function readAcquisitionCampaign(request: NextRequest): AcquisitionCampaign | null {
  try {
    const raw = request.cookies.get('tw_campaign')?.value;
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const utm_source = typeof parsed.utm_source === 'string' ? parsed.utm_source.slice(0, 32) : undefined;
    if (!utm_source) return null;
    const utm_medium = typeof parsed.utm_medium === 'string' ? parsed.utm_medium.slice(0, 32) : undefined;
    return { utm_source, utm_medium };
  } catch {
    return null;
  }
}

/**
 * POST /api/products/[id]/view — best-effort per-user view tracking (for recommendations).
 *
 * Production System A `products` has no `view_count` column, so the legacy global-counter increment
 * was removed (it 500'd on every product view). Aggregate view volume is now captured by the funnel
 * (`usage_events` product_view). This endpoint only records an optional per-user view, deduped hourly,
 * and NEVER fails the request — view tracking must never break a product page.
 *
 * Also runs the Noon Internal Commerce Expansion's SHADOW evaluation (mission §2/§7,
 * 2026-09-05): every real product view is a real shopper journey — this is the cheapest,
 * already-wired hook to log what the internal Amazon×Noon tie-break would decide, without
 * any new client-side call and without gating on login (unlike the per-user view row
 * above, which the shadow evaluation runs independently of).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (session?.user?.id) {
      const supabase = createServerClient();
      const userId = session.user.id;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: recentView } = await supabase
        .from('product_views')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', id)
        .gte('viewed_at', oneHourAgo)
        .limit(1)
        .maybeSingle();

      if (!recentView) {
        await supabase.from('product_views').insert({ user_id: userId, product_id: id });
      }
    }

    const sessionId = request.cookies.get('tw_sid')?.value?.slice(0, 64) || null;
    // Same tw_test cookie src/lib/analytics/track.ts's setTestMode()/isTestMode() already
    // use — set via document.cookie on ?test=1, sent automatically on this same-origin
    // fetch, no new client-side header needed.
    const isTest = request.cookies.get('tw_test')?.value === '1';
    void runShadowEvaluationForProductView(id, readAcquisitionCampaign(request), sessionId, isTest);
  } catch {
    // Best-effort only — swallow everything (missing table/column, no session, etc.).
  }
  return NextResponse.json({ ok: true });
}
