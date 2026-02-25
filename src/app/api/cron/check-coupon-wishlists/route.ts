import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { createNotification, sendNewCouponAlertEmail } from '@/lib/auth/notifications';

/**
 * POST /api/cron/check-coupon-wishlists
 * Checks for new coupons on wishlisted products and notifies users
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find coupons created in the last 24 hours that target a specific product
    const { data: recentCoupons, error: couponsError } = await supabase
      .from('coupons')
      .select(`
        id, code, product_id, store_id, discount_type, discount_value,
        stores:store_id (name_ar, name_en),
        products:product_id (name_ar, name_en)
      `)
      .not('product_id', 'is', null)
      .eq('is_active', true)
      .gte('created_at', oneDayAgo);

    if (couponsError) throw couponsError;
    if (!recentCoupons?.length) {
      return NextResponse.json({ success: true, notifications_sent: 0 });
    }

    let notificationsSent = 0;

    for (const coupon of recentCoupons) {
      const productId = coupon.product_id;
      if (!productId) continue;

      // Find users who have this product in their wishlist
      const { data: wishlistUsers, error: wishlistError } = await supabase
        .from('user_wishlists')
        .select('user_id, users:user_id (email, preferred_language)')
        .eq('product_id', productId);

      if (wishlistError || !wishlistUsers?.length) continue;

      const product = coupon.products as any;
      const store = coupon.stores as any;
      const discountText = coupon.discount_type === 'percentage'
        ? `${coupon.discount_value}%`
        : coupon.discount_type === 'free_shipping'
          ? 'Free Shipping'
          : `${coupon.discount_value} SAR`;

      for (const item of wishlistUsers) {
        const user = (item as any).users;
        const locale = (user?.preferred_language || 'ar') as 'ar' | 'en';
        const productName = locale === 'ar' ? product?.name_ar : product?.name_en;

        // In-app notification
        await createNotification({
          user_id: item.user_id,
          type: 'deal',
          title_ar: `كوبون جديد: ${product?.name_ar || ''}`,
          title_en: `New Coupon: ${product?.name_en || ''}`,
          message_ar: `كوبون "${coupon.code}" بخصم ${discountText} لمنتج في قائمة أمنياتك`,
          message_en: `Coupon "${coupon.code}" with ${discountText} discount for a product in your wishlist`,
          product_id: productId,
          store_id: coupon.store_id,
        });

        // Email notification
        if (user?.email) {
          sendNewCouponAlertEmail(
            user.email,
            { product_name: productName || '', coupon_code: coupon.code, discount: discountText },
            locale,
          ).catch((err) => console.error('Failed to send coupon alert email:', err));
        }

        notificationsSent++;
      }
    }

    return NextResponse.json({ success: true, notifications_sent: notificationsSent });
  } catch (error) {
    console.error('Error in coupon wishlist checker:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Coupon wishlist checker endpoint' });
}
