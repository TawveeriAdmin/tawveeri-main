import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { logCouponEvent, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { createNotification, sendCouponAdminActionEmail } from '@/lib/auth/notifications';

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

    // Notify store owner
    const storeData = (data as any)?.stores;
    if (storeData?.id) {
      const { data: storeRow } = await supabase
        .from('stores')
        .select('created_by')
        .eq('id', storeData.id)
        .single();

      if (storeRow?.created_by) {
        createNotification({
          user_id: storeRow.created_by,
          type: 'system',
          title_ar: 'تم تحديث كوبون بواسطة المشرف',
          title_en: 'Coupon Updated by Admin',
          message_ar: `تم تحديث الكوبون "${(data as any)?.code}" بواسطة المشرف`,
          message_en: `Coupon "${(data as any)?.code}" has been updated by admin`,
          store_id: storeData.id,
        }).catch(() => {});

        // Email store owner
        const { data: ownerProfile } = await supabase
          .from('users')
          .select('email, preferred_language')
          .eq('id', storeRow.created_by)
          .single();

        if (ownerProfile?.email) {
          const locale = (ownerProfile.preferred_language || 'ar') as 'ar' | 'en';
          const storeName = locale === 'ar' ? storeData.name_ar : storeData.name_en;
          sendCouponAdminActionEmail(
            ownerProfile.email,
            { action_type: 'updated', coupon_code: (data as any)?.code || '', store_name: storeName || '' },
            locale,
          ).catch(() => {});
        }
      }
    }

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

    // Fetch coupon and store owner info before deleting
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, code, store_id, stores:store_id (created_by, name_ar, name_en)')
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

    // Notify store owner about deletion
    const storeInfo = (coupon as any)?.stores;
    if (storeInfo?.created_by) {
      createNotification({
        user_id: storeInfo.created_by,
        type: 'system',
        title_ar: 'تم حذف كوبون بواسطة المشرف',
        title_en: 'Coupon Deleted by Admin',
        message_ar: `تم حذف الكوبون "${coupon?.code}" من متجر "${storeInfo.name_ar}" بواسطة المشرف`,
        message_en: `Coupon "${coupon?.code}" from store "${storeInfo.name_en}" has been deleted by admin`,
        store_id: coupon?.store_id,
      }).catch(() => {});

      // Email store owner
      const { data: ownerProfile } = await supabase
        .from('users')
        .select('email, preferred_language')
        .eq('id', storeInfo.created_by)
        .single();

      if (ownerProfile?.email) {
        const locale = (ownerProfile.preferred_language || 'ar') as 'ar' | 'en';
        const storeName = locale === 'ar' ? storeInfo.name_ar : storeInfo.name_en;
        sendCouponAdminActionEmail(
          ownerProfile.email,
          { action_type: 'deleted', coupon_code: coupon?.code || '', store_name: storeName || '' },
          locale,
        ).catch(() => {});
      }
    }

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
