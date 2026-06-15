import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { createNotification, sendPriceDropEmail } from '@/lib/auth/notifications';
import { createAuditLog } from '@/lib/auth/audit';
import { sendPushToUser } from '@/lib/push/expo-push';
import { sendWebPushToUser } from '@/lib/push/web-push';

/**
 * API Route to check price alerts and send notifications
 * This should be called periodically via cron job or Supabase Edge Function
 * 
 * Security: Add authentication/authorization header check in production
 * Example: Check for secret token in headers
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Fetch all active price alerts
    const { data: activeAlerts, error: alertsError } = await supabase
      .from('price_alerts')
      .select(
        `
        *,
        products (
          id,
          name_ar,
          name_en,
          image_urls,
          slug
        ),
        users (
          id,
          email,
          full_name,
          locale
        )
      `
      )
      .eq('is_active', true);

    if (alertsError) throw alertsError;

    if (!activeAlerts || activeAlerts.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        triggered: 0,
      });
    }

    let triggeredCount = 0;
    const now = new Date().toISOString();

    // Process each alert
    for (const alertData of activeAlerts) {
      try {
        const alert = alertData as any;
        if (!alert || !alert.product_id || !alert.target_price) continue;

        // Get current lowest price for this product
        const { data: productStores, error: storesError } = await supabase
          .from('product_stores')
          .select('current_price')
          .eq('product_id', alert.product_id)
          .eq('availability', 'in_stock')
          .order('current_price', { ascending: true })
          .limit(1);

        if (storesError || !productStores || productStores.length === 0) {
          continue; // Skip if no stores found
        }

        const currentPrice = productStores[0].current_price;

        // Check if target price is reached
        if (currentPrice <= alert.target_price) {
          const product = alert.products as any;
          const user = alert.users as any;
          const locale = (user?.locale || 'en') as 'ar' | 'en';
          const numberLocale = locale === 'ar' ? 'ar-SA' : 'en-US';
          const productName = locale === 'ar' ? product?.name_ar : product?.name_en || 'Product';
          const currentPriceText = Math.round(currentPrice).toLocaleString(numberLocale);
          const targetPriceText = Math.round(alert.target_price).toLocaleString(numberLocale);

          // Create in-app notification
          await createNotification({
            user_id: alert.user_id,
            type: 'price_drop',
            title_ar: `انخفض سعر ${productName}!`,
            title_en: `${productName} price dropped!`,
            message_ar: `انخفض سعر ${productName} إلى ${currentPriceText} ر.س (الهدف: ${targetPriceText} ر.س)`,
            message_en: `${productName} price dropped to ${currentPriceText} SAR (Target: ${targetPriceText} SAR)`,
            product_id: alert.product_id,
            link: `/products/${product?.slug || alert.product_id}`,
          });

          // Send push notification to mobile
          const pushTitle = locale === 'ar' ? `انخفض سعر ${productName}!` : `${productName} price dropped!`;
          const pushBody = locale === 'ar'
            ? `السعر الآن ${currentPriceText} ر.س`
            : `Now ${currentPriceText} SAR`;
          await sendPushToUser(alert.user_id, {
            title: pushTitle,
            body: pushBody,
            data: {
              type: 'price_drop',
              product_id: alert.product_id,
              product_slug: product?.slug,
            },
            channelId: 'price-alerts',
          });

          // Send price drop email
          if (user?.email) {
            const productLink = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/products/${product?.slug || alert.product_id}`;
            sendPriceDropEmail(user.email, {
              product_name: productName,
              old_price: alert.target_price,
              new_price: currentPrice,
              product_link: productLink,
            }, locale).catch((err) =>
              console.error('Failed to send price drop email:', err)
            );
          }

          // Send web push notification to browser
          await sendWebPushToUser(alert.user_id, {
            title: pushTitle,
            body: pushBody,
            data: {
              url: `/${locale}/products/${product?.slug || alert.product_id}`,
              type: 'price_drop',
              product_id: alert.product_id,
            },
            dir: locale === 'ar' ? 'rtl' : 'ltr',
            lang: locale,
            tag: `price-drop-${alert.product_id}`,
          });

          // Audit log for price drop alert sent
          createAuditLog({
            user_id: alert.user_id,
            action: 'price_drop_alert_sent',
            entity_type: 'product',
            entity_id: alert.product_id,
            details: { target_price: alert.target_price, current_price: currentPrice },
          }).catch(() => {});

          // Mark alert as inactive and update notified_at
          const alertId = (alertData as any).id;
          if (alertId) {
            await supabase
              .from('price_alerts')
              .update({
                is_active: false,
                notified_at: now,
              })
              .eq('id', alertId);
          }

          triggeredCount++;
        }
      } catch (error) {
        const alertId = (alertData as any).id;
        console.error(`Error processing alert ${alertId}:`, error);
        // Continue with next alert
      }
    }

    return NextResponse.json({
      success: true,
      checked: activeAlerts.length,
      triggered: triggeredCount,
    });
  } catch (error) {
    console.error('Error in price alert checker:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow GET for health checks
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Price alerts checker endpoint',
  });
}
