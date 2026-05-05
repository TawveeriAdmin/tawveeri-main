import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getRequestUser } from '@/lib/auth/api-auth';

/**
 * POST /api/products/ensure
 * Ensures a scraped product exists in the database. If not found, creates it.
 * Returns the database product ID.
 */
export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name_en, name_ar, slug, category, brand, model, image_urls, product_stores } = body;

    if (!name_en && !name_ar) {
      return NextResponse.json({ error: 'Product name required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Try to find existing product by slug or name
    let productId: string | null = null;

    if (slug) {
      const { data } = await supabase
        .from('products')
        .select('id')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle();
      if (data) productId = data.id;
    }

    if (!productId && name_en) {
      const { data } = await supabase
        .from('products')
        .select('id')
        .eq('name_en', name_en)
        .limit(1)
        .maybeSingle();
      if (data) productId = data.id;
    }

    // Create product if not found
    if (!productId) {
      const productSlug = slug || (name_en || name_ar || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `product-${Date.now()}`;

      const { data: inserted, error: insertErr } = await supabase
        .from('products')
        .insert({
          name_ar: name_ar || name_en || '',
          name_en: name_en || name_ar || '',
          slug: productSlug,
          category: category || 'accessories',
          brand: brand || 'Unknown',
          model: model || '',
          image_urls: image_urls || null,
        })
        .select('id')
        .single();

      if (insertErr) {
        // Slug conflict — fetch existing
        if (insertErr.code === '23505') {
          const { data } = await supabase
            .from('products')
            .select('id')
            .eq('slug', productSlug)
            .limit(1)
            .maybeSingle();
          if (data) {
            productId = data.id;
          } else {
            return NextResponse.json({ error: insertErr.message }, { status: 500 });
          }
        } else {
          return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }
      } else {
        productId = inserted.id;
      }

      // Create product_store entries
      if (productId && product_stores && Array.isArray(product_stores)) {
        for (const ps of product_stores) {
          const storeSlug = ps.store_slug;
          if (!storeSlug || !ps.product_url) continue;

          const { data: storeRow } = await supabase
            .from('stores')
            .select('id')
            .eq('slug', storeSlug)
            .limit(1)
            .maybeSingle();

          if (storeRow) {
            await supabase.from('product_stores').insert({
              product_id: productId,
              store_id: storeRow.id,
              current_price: ps.current_price || 0,
              original_price: ps.original_price || null,
              product_url: ps.product_url,
              availability: ps.availability || 'in_stock',
              is_deal: ps.is_deal || false,
              is_free_delivery: ps.is_free_delivery || false,
            });
          }
        }
      }
    }

    return NextResponse.json({ id: productId });
  } catch (err) {
    console.error('[API] /products/ensure error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
