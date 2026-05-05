import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getRequestUser } from '@/lib/auth/api-auth';
import { logCouponEvent, AUDIT_ACTIONS } from '@/lib/auth/audit';

/**
 * POST /api/coupons/[id]/copy
 * Track coupon code copy — increments usage_count
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    // Get user if authenticated (optional — anonymous copies are allowed)
    const user = await getRequestUser(request).catch(() => null);

    // Increment usage_count
    const { data: coupon, error: fetchError } = await supabase
      .from('coupons')
      .select('usage_count, code, store_id')
      .eq('id', id)
      .single();

    if (fetchError || !coupon) {
      return NextResponse.json(
        { error: 'Coupon not found' },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from('coupons')
      .update({ usage_count: (coupon.usage_count || 0) + 1 })
      .eq('id', id);

    if (updateError) throw updateError;

    // Audit log (non-blocking)
    logCouponEvent(user?.id || null, AUDIT_ACTIONS.COUPON_COPIED, id, {
      code: coupon.code,
      store_id: coupon.store_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking coupon copy:', error);
    return NextResponse.json(
      { error: 'Failed to track coupon copy' },
      { status: 500 }
    );
  }
}
