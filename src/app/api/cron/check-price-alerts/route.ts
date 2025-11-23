import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { createNotification } from '@/lib/auth/notifications';

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
          const productName = locale === 'ar' ? product?.name_ar : product?.name_en || 'Product';

          // Create notification
          await createNotification({
            user_id: alert.user_id,
            type: 'price_drop',
            title_ar: `انخفض سعر ${productName}!`,
            title_en: `${productName} price dropped!`,
            message_ar: `انخفض سعر ${productName} إلى ${currentPrice.toLocaleString()} ر.س (الهدف: ${alert.target_price.toLocaleString()} ر.س)`,
            message_en: `${productName} price dropped to ${currentPrice.toLocaleString()} SAR (Target: ${alert.target_price.toLocaleString()} SAR)`,
            product_id: alert.product_id,
            link: `/products/${product?.slug || alert.product_id}`,
          });

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
        const alertId = (alert as any).id;
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

