import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { logCouponEvent, AUDIT_ACTIONS } from '@/lib/auth/audit';

/**
 * PATCH /api/admin/coupons/[id]
 * Admin: update a coupon
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRequestAdmin(request);
    const { id } = await params;

    const body = await request.json();
    const allowedFields = [
      'code',
      'description_ar',
      'description_en',
      'discount_type',
      'discount_value',
      'min_purchase',
      'max_discount',
      'starts_at',
      'expires_at',
      'is_active',
      'store_id',
      'product_id',
    ];

    // Only pick allowed fields
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (updates.code && typeof updates.code === 'string') {
      updates.code = updates.code.trim().toUpperCase();
    }

    if (
      updates.discount_type &&
      !['percentage', 'fixed_amount', 'free_shipping'].includes(updates.discount_type as string)
    ) {
      return NextResponse.json(
        { error: 'Invalid discount_type' },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        stores:store_id (id, name_ar, name_en, logo_url),
        products:product_id (id, name_ar, name_en, slug)
      `
      )
      .single();

    if (error) throw error;

    // Audit log
    logCouponEvent(profile.id, AUDIT_ACTIONS.COUPON_UPDATED, id, {
      updates,
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    console.error('Error updating coupon:', error);
    return NextResponse.json(
      { error: 'Failed to update coupon' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/coupons/[id]
 * Admin: permanently delete a coupon
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRequestAdmin(request);
    const { id } = await params;

    const supabase = createServerClient();

    // Fetch coupon info for audit log before deleting
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, code, store_id')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Audit log
    logCouponEvent(profile.id, AUDIT_ACTIONS.COUPON_DELETED, id, {
      code: coupon?.code,
      store_id: coupon?.store_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    console.error('Error deleting coupon:', error);
    return NextResponse.json(
      { error: 'Failed to delete coupon' },
      { status: 500 }
    );
  }
}
