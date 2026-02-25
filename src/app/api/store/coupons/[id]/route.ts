import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { requireRequestStore } from '@/lib/auth/api-auth';
import { logCouponEvent, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { createNotification } from '@/lib/auth/notifications';

/**
 * Get the store owned by the authenticated user
 */
async function getOwnedStore(profileId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('stores')
    .select('id')
    .eq('created_by', profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Verify that a coupon belongs to the user's store
 */
async function verifyCouponOwnership(couponId: string, storeId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('coupons')
    .select('id, store_id')
    .eq('id', couponId)
    .eq('store_id', storeId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * PATCH /api/store/coupons/[id]
 * Store owner: update a coupon belonging to their store
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRequestStore(request);
    const { id } = await params;

    const store = await getOwnedStore(profile.id);
    if (!store) {
      return NextResponse.json(
        { error: 'No store associated with your account' },
        { status: 404 }
      );
    }

    const isOwner = await verifyCouponOwnership(id, store.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Coupon not found or does not belong to your store' },
        { status: 404 }
      );
    }

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
      'product_id',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Store owners cannot change store_id
    if (updates.code && typeof updates.code === 'string') {
      updates.code = updates.code.trim().toUpperCase();
    }

    if (
      updates.discount_type &&
      !['percentage', 'fixed_amount', 'free_shipping'].includes(
        updates.discount_type as string
      )
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
      .eq('store_id', store.id)
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

    // In-app notification
    createNotification({
      user_id: profile.id,
      type: 'system',
      title_ar: 'تم تحديث الكوبون',
      title_en: 'Coupon Updated',
      message_ar: `تم تحديث الكوبون "${(data as any)?.code}" بنجاح`,
      message_en: `Coupon "${(data as any)?.code}" updated successfully`,
      store_id: store.id,
    }).catch(() => {});

    return NextResponse.json({ data });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Authentication required' ||
        error.message === 'Store access required')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error updating store coupon:', error);
    return NextResponse.json(
      { error: 'Failed to update coupon' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/store/coupons/[id]
 * Store owner: permanently delete a coupon belonging to their store
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRequestStore(request);
    const { id } = await params;

    const store = await getOwnedStore(profile.id);
    if (!store) {
      return NextResponse.json(
        { error: 'No store associated with your account' },
        { status: 404 }
      );
    }

    const isOwner = await verifyCouponOwnership(id, store.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Coupon not found or does not belong to your store' },
        { status: 404 }
      );
    }

    const supabase = createServerClient();

    // Fetch coupon info for audit log before deleting
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, code, store_id')
      .eq('id', id)
      .eq('store_id', store.id)
      .single();

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id)
      .eq('store_id', store.id);

    if (error) throw error;

    // Audit log
    logCouponEvent(profile.id, AUDIT_ACTIONS.COUPON_DELETED, id, {
      code: coupon?.code,
      store_id: coupon?.store_id,
    });

    // In-app notification
    createNotification({
      user_id: profile.id,
      type: 'system',
      title_ar: 'تم حذف الكوبون',
      title_en: 'Coupon Deleted',
      message_ar: `تم حذف الكوبون "${coupon?.code}" بنجاح`,
      message_en: `Coupon "${coupon?.code}" deleted successfully`,
      store_id: store.id,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Authentication required' ||
        error.message === 'Store access required')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error deleting store coupon:', error);
    return NextResponse.json(
      { error: 'Failed to delete coupon' },
      { status: 500 }
    );
  }
}
