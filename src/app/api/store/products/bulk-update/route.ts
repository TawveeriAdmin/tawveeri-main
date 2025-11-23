import { NextRequest, NextResponse } from 'next/server';
import { requireStore, getUserProfile, createClient } from '@/lib/auth/server';
import { createAuditLog } from '@/lib/auth/audit';

export async function POST(request: NextRequest) {
  try {
    // Verify store owner access
    await requireStore();

    const userProfile = await getUserProfile();
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productIds, updateType, updateValue } = await request.json();

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Invalid product IDs' }, { status: 400 });
    }

    if (!updateType || !updateValue) {
      return NextResponse.json({ error: 'Invalid update parameters' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get user's store
    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .eq('created_by', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!stores) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Get current product_store entries
    const { data: productStores, error: fetchError } = await supabase
      .from('product_stores')
      .select('id, current_price, product_id')
      .in('id', productIds)
      .eq('store_id', stores.id);

    if (fetchError) throw fetchError;
    if (!productStores || productStores.length === 0) {
      return NextResponse.json({ error: 'Products not found' }, { status: 404 });
    }

    // Calculate new prices and update
    const updates = productStores.map((ps) => {
      let newPrice = ps.current_price;
      if (updateType === 'percentage') {
        newPrice = ps.current_price * (1 + updateValue / 100);
      } else {
        newPrice = ps.current_price + updateValue;
      }

      return {
        id: ps.id,
        newPrice: Math.max(0, newPrice),
        oldPrice: ps.current_price,
      };
    });

    // Update prices
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('product_stores')
        .update({ current_price: update.newPrice })
        .eq('id', update.id);

      if (updateError) throw updateError;

      // Create price history entry
      await supabase.from('price_history').insert({
        product_store_id: update.id,
        price: update.newPrice,
      });

      // Create audit log
      await createAuditLog({
        user_id: userProfile.id,
        action: 'bulk_price_update',
        entity_type: 'product_store',
        entity_id: update.id,
        details: {
          old_price: update.oldPrice,
          new_price: update.newPrice,
          update_type: updateType,
          update_value: updateValue,
        },
      });
    }

    return NextResponse.json({
      success: true,
      updated: updates.length,
    });
  } catch (error) {
    console.error('Error in bulk price update API:', error);
    if (error instanceof Error && error.message === 'Store access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

