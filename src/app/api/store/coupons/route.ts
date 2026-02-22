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
    .select('id, name_ar, name_en')
    .eq('created_by', profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * GET /api/store/coupons
 * Store owner: list coupons for their store
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await requireRequestStore(request);

    const store = await getOwnedStore(profile.id);
    if (!store) {
      return NextResponse.json(
        { error: 'No store associated with your account' },
        { status: 404 }
      );
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    // Return store info for the form dialog
    if (searchParams.get('stores_only') === 'true') {
      return NextResponse.json({ stores: [store] });
    }

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
      .eq('store_id', store.id)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('code', `%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      coupons: data || [],
      count: count || 0,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Authentication required' ||
        error.message === 'Store access required')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error fetching store coupons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/store/coupons
 * Store owner: create a coupon for their store
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await requireRequestStore(request);

    const store = await getOwnedStore(profile.id);
    if (!store) {
      return NextResponse.json(
        { error: 'No store associated with your account' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
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
    if (!code || !discount_type || discount_value === undefined) {
      return NextResponse.json(
        { error: 'code, discount_type, and discount_value are required' },
        { status: 400 }
      );
    }

    if (
      !['percentage', 'fixed_amount', 'free_shipping'].includes(discount_type)
    ) {
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
        store_id: store.id,
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

    // In-app notification
    createNotification({
      user_id: profile.id,
      type: 'system',
      title_ar: 'تم إنشاء كوبون جديد',
      title_en: 'New Coupon Created',
      message_ar: `تم إنشاء كوبون "${data.code}" بنجاح`,
      message_en: `Coupon "${data.code}" created successfully`,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Authentication required' ||
        error.message === 'Store access required')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error creating store coupon:', error);
    return NextResponse.json(
      { error: 'Failed to create coupon' },
      { status: 500 }
    );
  }
}
