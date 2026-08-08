import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { createNotification, sendCouponExpiryEmail } from '@/lib/auth/notifications';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';

/**
 * POST /api/cron/check-coupon-expiry
 * Warns store owners about coupons expiring within 3 days
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const now = new Date().toISOString();
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // Find active coupons expiring within 3 days
    const { data: expiringCoupons, error: couponsError } = await supabase
      .from('coupons')
      .select(`
        id, code, store_id, expires_at,
        stores:store_id (id, name_ar, name_en, created_by, contact_email)
      `)
      .eq('is_active', true)
      .not('expires_at', 'is', null)
      .gte('expires_at', now)
      .lte('expires_at', threeDaysFromNow);

    if (couponsError) throw couponsError;
    if (!expiringCoupons?.length) {
      return NextResponse.json({ success: true, warnings_sent: 0 });
    }

    let warningsSent = 0;

    for (const coupon of expiringCoupons) {
      const store = coupon.stores as any;
      if (!store?.created_by) continue;

      const storeOwnerId = store.created_by;
      const expiresAt = new Date(coupon.expires_at!).toLocaleDateString('ar-SA');

      // In-app notification to store owner
      await createNotification({
        user_id: storeOwnerId,
        type: 'system',
        title_ar: `كوبون على وشك الانتهاء: ${coupon.code}`,
        title_en: `Coupon Expiring Soon: ${coupon.code}`,
        message_ar: `الكوبون "${coupon.code}" في متجر "${store.name_ar}" سينتهي في ${expiresAt}`,
        message_en: `Coupon "${coupon.code}" in store "${store.name_en}" expires on ${expiresAt}`,
        store_id: coupon.store_id,
      });

      // Email to store owner
      // Look up store owner's email
      const { data: ownerProfile } = await supabase
        .from('users')
        .select('email, preferred_language')
        .eq('id', storeOwnerId)
        .single();

      const ownerEmail = ownerProfile?.email || store.contact_email;
      if (ownerEmail) {
        const locale = (ownerProfile?.preferred_language || 'ar') as 'ar' | 'en';
        const storeName = locale === 'ar' ? store.name_ar : store.name_en;
        sendCouponExpiryEmail(
          ownerEmail,
          { coupon_code: coupon.code, store_name: storeName, expires_at: expiresAt },
          locale,
        ).catch((err) => console.error('Failed to send coupon expiry email:', err));
      }

      warningsSent++;
    }

    // Audit log
    createAuditLog({
      action: AUDIT_ACTIONS.COUPON_EXPIRY_WARNINGS_SENT,
      entity_type: 'cron',
      details: { warnings_sent: warningsSent, coupons_checked: expiringCoupons.length },
    });

    return NextResponse.json({ success: true, warnings_sent: warningsSent });
  } catch (error) {
    console.error('Error in coupon expiry checker:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Coupon expiry checker endpoint' });
}
