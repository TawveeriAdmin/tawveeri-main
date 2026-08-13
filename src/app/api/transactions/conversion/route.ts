import { NextRequest, NextResponse } from 'next/server';
import { trackConversion } from '@/lib/transactions/tracking';

/**
 * POST /api/transactions/conversion — LEGACY, now internal-only (ADR-244).
 *
 * Audit finding (2026-08-13): this route accepted a `click_id` + arbitrary `amount`
 * + spread `metadata` from ANY unauthenticated caller and wrote them into the
 * `transactions` table via the service-role client — an open mutation path into a
 * commercial table, duplicating the canonical attribution system (`outbound_clicks`
 * + `affiliate_conversions`, ADR-213). Grep across web + mobile confirmed NOTHING
 * legitimate calls it: no fetch to this path exists anywhere in the codebase, and no
 * affiliate network was ever configured to post back to it.
 *
 * Disposition: authenticated + internal (Bearer CRON_SECRET), not deleted — the
 * `transactions` data and the admin stats that read it are untouched, and if a real
 * postback integration ever materializes it gets a deliberate design, not this. The
 * `metadata` spread is also removed: callers may no longer write arbitrary columns.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const { click_id, amount } = await request.json();

    if (!click_id) {
      return NextResponse.json({ error: 'click_id is required' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const result = await trackConversion(click_id, amount);
    if (result.error) {
      console.error('Error tracking conversion:', result.error);
      return NextResponse.json({ error: result.error.message || 'Failed to track conversion' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in conversion tracking API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
