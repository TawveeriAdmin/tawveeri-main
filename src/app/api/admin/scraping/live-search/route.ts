import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { searchAllStores } from '@/lib/scraping/search/search-orchestrator';
import { DEFAULT_SEARCH_STORES } from '@/lib/scraping/search/store-registry';
import { createServerClient } from '@/lib/database';
import { ProductService } from '@/lib/scraping/services/product-service';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';
import type { ProductCategory } from '@/lib/database/types';

export const maxDuration = 240;

/**
 * POST /api/admin/scraping/live-search
 * Admin-only wrapper around searchAllStores(). No in-memory cache, no public
 * exposure. Two modes:
 *   - action=search (default): runs live scrape and returns results
 *   - action=ingest: takes a products[] payload and upserts into catalog
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action || 'search';

  if (action === 'search') {
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const stores: string[] = Array.isArray(body.stores) && body.stores.length > 0
      ? body.stores
      : [...DEFAULT_SEARCH_STORES];
    const pages = Math.min(Math.max(parseInt(body.pages ?? '1', 10), 1), 5);
    const sort = body.sort || 'relevance';
    const category = body.category as ProductCategory | undefined;

    const result = await searchAllStores(query, stores, pages, sort, category);

    createAuditLog({
      user_id: admin.id,
      action: AUDIT_ACTIONS.SCRAPING_LIVE_SEARCH_EXECUTED,
      entity_type: 'scraping',
      details: {
        query,
        stores,
        pages,
        category,
        product_count: result.count,
        duration_ms: result.searchTime,
      },
    }).catch(() => {});

    return NextResponse.json(result);
  }

  if (action === 'ingest') {
    const products = Array.isArray(body.products) ? body.products : [];
    if (products.length === 0) {
      return NextResponse.json({ error: 'products array is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const productService = new ProductService();
    let created = 0;
    let linked = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of products) {
      try {
        if (!p.store_slug) {
          skipped++;
          continue;
        }
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('slug', p.store_slug)
          .single();
        const storeId = (store as { id?: string } | null)?.id;
        if (!storeId) {
          skipped++;
          continue;
        }
        const result = await productService.createOrUpdateProduct(p, storeId);
        if (result.created) created++;
        else linked++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    createAuditLog({
      user_id: admin.id,
      action: AUDIT_ACTIONS.SCRAPING_LIVE_SEARCH_INGESTED,
      entity_type: 'scraping',
      details: { created, linked, skipped, errors: errors.length },
    }).catch(() => {});

    return NextResponse.json({ ok: true, created, linked, skipped, errors });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
