import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import type { DiscountType } from '@/lib/database/types';

/**
 * GET /api/coupons
 * Public: list active, non-expired coupons with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get('store_id');
    const productId = searchParams.get('product_id');
    const discountType = searchParams.get('discount_type');
    const sort = searchParams.get('sort') || 'newest';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('coupons')
      .select(
        `
        *,
        stores:store_id (id, name_ar, name_en, logo_url, slug),
        products:product_id (id, name_ar, name_en, slug, image_urls)
      `,
        { count: 'exact' }
      )
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()');

    // Filters
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    if (productId) {
      query = query.eq('product_id', productId);
    }
    if (discountType && ['percentage', 'fixed_amount', 'free_shipping'].includes(discountType)) {
      query = query.eq('discount_type', discountType as DiscountType);
    }

    // Sort
    switch (sort) {
      case 'discount':
        query = query.order('discount_value', { ascending: false });
        break;
      case 'expiring':
        query = query
          .not('expires_at', 'is', null)
          .order('expires_at', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json(
      {
        data: data || [],
        count: count || 0,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}
