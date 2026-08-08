import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { createNotification } from '@/lib/auth/notifications';
import { createAuditLog } from '@/lib/auth/audit';
import { requireRequestStore } from '@/lib/auth/api-auth';
import type { Database } from '@/lib/database/types';

type ProductStoreRow = Database['public']['Tables']['product_stores']['Row'];

interface SyncProduct {
  product_id: string;
  current_price: number;
  original_price?: number;
  availability?: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order';
  stock_quantity?: number;
  product_url: string;
  affiliate_url?: string;
  delivery_time_days?: number;
  delivery_cost?: number;
  is_free_delivery?: boolean;
  is_deal?: boolean;
  deal_expires_at?: string;
  coupon_code?: string;
}

interface SyncRequest {
  products: SyncProduct[];
}

/**
 * POST /api/store/sync/[storeId]
 * Store data sync endpoint
 * Accepts product data and updates or creates product_store entries
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;

    let profile;
    try {
      profile = await requireRequestStore(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SyncRequest = await request.json();

    if (!body.products || !Array.isArray(body.products)) {
      return NextResponse.json({ error: 'Invalid request: products array required' }, { status: 400 });
    }

    const supabase = createServerClient();

    if (profile.role !== 'admin') {
      const { data: ownedStore } = await supabase
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .eq('created_by', profile.id)
        .maybeSingle();

      if (!ownedStore) {
        return NextResponse.json({ error: 'Store not found or not owned by this account' }, { status: 403 });
      }
    }
    const results: Array<{ product_id: string; status: 'created' | 'updated' | 'error'; error?: string }> = [];
    const priceChanges: Array<{ product_id: string; old_price: number; new_price: number }> = [];

    for (const productData of body.products) {
      try {
        // Check if product_store entry exists
        const { data: existing, error: fetchError } = await supabase
          .from('product_stores')
          .select('id, current_price')
          .eq('product_id', productData.product_id)
          .eq('store_id', storeId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 is "not found" - that's ok, we'll create new
          throw fetchError;
        }

        const updateData: Partial<ProductStoreRow> = {
          current_price: productData.current_price,
          original_price: productData.original_price || null,
          availability: productData.availability || 'in_stock',
          stock_quantity: productData.stock_quantity || null,
          product_url: productData.product_url,
          affiliate_url: productData.affiliate_url || null,
          delivery_time_days: productData.delivery_time_days || null,
          delivery_cost: productData.delivery_cost || 0,
          is_free_delivery: productData.is_free_delivery || false,
          is_deal: productData.is_deal || false,
          deal_expires_at: productData.deal_expires_at || null,
          coupon_code: productData.coupon_code || null,
          last_checked_at: new Date().toISOString(),
        };

        if (existing) {
          // Track price change if price differs
          if (existing.current_price !== productData.current_price) {
            priceChanges.push({
              product_id: productData.product_id,
              old_price: existing.current_price,
              new_price: productData.current_price,
            });

            updateData.last_price_change_at = new Date().toISOString();

            // Insert into price_history
            await supabase.from('price_history').insert({
              product_store_id: existing.id,
              price: productData.current_price,
            });
          }

          // Update existing entry
          const { error: updateError } = await supabase
            .from('product_stores')
            .update(updateData)
            .eq('id', existing.id);

          if (updateError) throw updateError;

          results.push({ product_id: productData.product_id, status: 'updated' });
        } else {
          // Create new entry
          const { error: insertError } = await supabase
            .from('product_stores')
            .insert({
              ...updateData,
              product_id: productData.product_id,
              store_id: storeId,
              currency: 'SAR',
            } as any);

          if (insertError) throw insertError;

          results.push({ product_id: productData.product_id, status: 'created' });
        }
      } catch (error) {
        console.error(`Error syncing product ${productData.product_id}:`, error);
        results.push({
          product_id: productData.product_id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const createdCount = results.filter((r) => r.status === 'created').length;
    const updatedCount = results.filter((r) => r.status === 'updated').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    // Notify store owner about sync results
    const { data: store } = await supabase
      .from('stores')
      .select('created_by, name_ar, name_en')
      .eq('id', storeId)
      .single();

    if (store?.created_by) {
      createNotification({
        user_id: store.created_by,
        type: 'system',
        title_ar: 'اكتملت مزامنة المتجر',
        title_en: 'Store Sync Completed',
        message_ar: `تمت مزامنة ${store.name_ar}: ${createdCount} جديد، ${updatedCount} محدث، ${errorCount} أخطاء، ${priceChanges.length} تغيير سعر`,
        message_en: `${store.name_en} synced: ${createdCount} created, ${updatedCount} updated, ${errorCount} errors, ${priceChanges.length} price changes`,
        store_id: storeId,
      }).catch(() => {});
    }

    // Audit log
    createAuditLog({
      user_id: store?.created_by || null,
      action: 'store_sync_completed',
      entity_type: 'store',
      entity_id: storeId,
      details: { created: createdCount, updated: updatedCount, errors: errorCount, price_changes: priceChanges.length },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      synced: results.length,
      created: createdCount,
      updated: updatedCount,
      errors: errorCount,
      price_changes: priceChanges.length,
      results,
    });
  } catch (error) {
    console.error('Error in store sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync store data' },
      { status: 500 }
    );
  }
}

