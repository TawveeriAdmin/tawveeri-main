import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getSession } from '@/lib/auth/server';

/**
 * POST /api/products/[id]/view — best-effort per-user view tracking (for recommendations).
 *
 * Production System A `products` has no `view_count` column, so the legacy global-counter increment
 * was removed (it 500'd on every product view). Aggregate view volume is now captured by the funnel
 * (`usage_events` product_view). This endpoint only records an optional per-user view, deduped hourly,
 * and NEVER fails the request — view tracking must never break a product page.
 */
export async function POST(
  _request: Request,
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
  } catch {
    // Best-effort only — swallow everything (missing table/column, no session, etc.).
  }
  return NextResponse.json({ ok: true });
}
