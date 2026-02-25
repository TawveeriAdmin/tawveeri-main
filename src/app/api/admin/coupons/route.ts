import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { logCouponEvent, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { createNotification, sendCouponAdminActionEmail } from '@/lib/auth/notifications';

/**
 * GET /api/admin/coupons
 * Admin: list all coupons (including inactive/expired)
 */
export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);

    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    // Return stores list for the filter dropdown
    if (searchParams.get('stores_only') === 'true') {
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id, name_ar, name_en')
        .order('name_en');

      if (storesError) throw storesError;

      return NextResponse.json({ stores: stores || [] });
    }

    const storeId = searchParams.get('store_id');
    const status = searchParams.get('status'); // active, inactive, expired
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('coupons')
      .select(
        `
        *,
        store:store_id (id, name_ar, name_en, logo_url, slug),
        products:product_id (id, name_ar, name_en, slug)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    if (search) {
      query = query.ilike('code', `%${search}%`);
    }

    if (status === 'active') {
      query = query
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()');
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    } else if (status === 'expired') {
      query = query
        .eq('is_active', true)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString());
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      coupons: data || [],
      count: count || 0,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    console.error('Error fetching admin coupons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/coupons
 * Admin: create a new coupon
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await requireRequestAdmin(request);

    const body = await request.json();
    const {
      store_id,
      product_id,
      code,
      description_ar,
      description_en,
      discount_type,
      discount_value,
      min_purchase,
      max_discount,
      starts_at,
      expires_at,
    } = body;

    // Validate required fields
    if (!store_id || !code || !discount_type || discount_value === undefined) {
      return NextResponse.json(
        { error: 'store_id, code, discount_type, and discount_value are required' },
        { status: 400 }
      );
    }

    if (!['percentage', 'fixed_amount', 'free_shipping'].includes(discount_type)) {
      return NextResponse.json(
        { error: 'Invalid discount_type' },
        { status: 400 }
      );
    }

    if (discount_value < 0) {
      return NextResponse.json(
        { error: 'discount_value must be non-negative' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('coupons')
      .insert({
        store_id,
        product_id: product_id || null,
        code: code.trim().toUpperCase(),
        description_ar: description_ar || null,
        description_en: description_en || null,
        discount_type,
        discount_value,
        min_purchase: min_purchase || null,
        max_discount: max_discount || null,
        starts_at: starts_at || new Date().toISOString(),
        expires_at: expires_at || null,
        is_active: true,
        created_by: profile.id,
      })
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
    logCouponEvent(profile.id, AUDIT_ACTIONS.COUPON_CREATED, data.id, {
      code: data.code,
      store_id: data.store_id,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
    });

    // In-app notification to admin
    createNotification({
      user_id: profile.id,
      type: 'system',
      title_ar: 'تم إنشاء كوبون جديد',
      title_en: 'New Coupon Created',
      message_ar: `تم إنشاء كوبون "${data.code}" بنجاح`,
      message_en: `Coupon "${data.code}" created successfully`,
    });

    // Notify store owner (in-app + email)
    const { data: storeRow } = await supabase
      .from('stores')
      .select('created_by, name_ar, name_en')
      .eq('id', store_id)
      .single();

    if (storeRow?.created_by && storeRow.created_by !== profile.id) {
      createNotification({
        user_id: storeRow.created_by,
        type: 'system',
        title_ar: 'كوبون جديد بواسطة المشرف',
        title_en: 'New Coupon by Admin',
        message_ar: `تم إنشاء كوبون "${data.code}" في متجرك بواسطة المشرف`,
        message_en: `Coupon "${data.code}" was created in your store by admin`,
        store_id,
      }).catch(() => {});

      const { data: ownerProfile } = await supabase
        .from('users')
        .select('email, preferred_language')
        .eq('id', storeRow.created_by)
        .single();

      if (ownerProfile?.email) {
        const locale = (ownerProfile.preferred_language || 'ar') as 'ar' | 'en';
        const storeName = locale === 'ar' ? storeRow.name_ar : storeRow.name_en;
        sendCouponAdminActionEmail(
          ownerProfile.email,
          { action_type: 'created', coupon_code: data.code, store_name: storeName || '' },
          locale,
        ).catch(() => {});
      }
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    console.error('Error creating coupon:', error);
    return NextResponse.json(
      { error: 'Failed to create coupon' },
      { status: 500 }
    );
  }
}
