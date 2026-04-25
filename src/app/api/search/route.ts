import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';
import type { ProductCategory } from '@/lib/database/types';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

interface SearchBody {
  query?: string;
  category?: ProductCategory | string;

  // New contract — real pagination.
  page?: number;
  pageSize?: number;

  // Legacy multiplier kept for backwards compatibility (mobile app / any
  // older clients). If `page`/`pageSize` are absent and `pages` is present,
  // we behave like the old endpoint: return `pages × 48` rows in one shot.
  pages?: number;

  sort?: string;

  // Server-side filters.
  min_price?: number;
  max_price?: number;
  brand?: string;                // single-brand legacy field
  brands?: string[];             // multi-brand (new)
  stores?: string[];             // store slug list (new)
  availability?: string[];       // availability enum list (new)
  deals_only?: boolean;          // new
  free_delivery_only?: boolean;  // new
  in_stock_only?: boolean;       // legacy — equivalent to availability=['in_stock']
  specs?: Record<string, string>;
}

interface ProductRow {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  brand: string;
  model: string;
  category: string;
  sku: string | null;
  image_urls: string[] | null;
  specifications: Record<string, unknown> | null;
  description_ar: string | null;
  description_en: string | null;
  product_stores: ProductStoreRow[];
}

interface ProductStoreRow {
  id: string;
  current_price: number;
  original_price: number | null;
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order';
  product_url: string;
  is_deal: boolean | null;
  is_free_delivery: boolean | null;
  delivery_time_days: number | null;
  delivery_cost: number | null;
  coupon_code: string | null;
  stores: { slug: string; name_ar: string; name_en: string; average_rating: number | null; total_reviews: number | null } | null;
}

/**
 * POST /api/search
 * DB-backed search over the products + product_stores catalog.
 *
 * Pagination: the new contract accepts { page, pageSize } and returns
 * { total } — the exact match count across the whole catalog, so the
 * client can render real pagination (not a client-side slice over the
 * first N rows). The legacy { pages } body field is still honoured for
 * older callers that haven't migrated yet.
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  const body: SearchBody = await request.json().catch(() => ({} as SearchBody));
  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';

  const supabase = createServerClient();
  let query = supabase
    .from('products')
    .select(`
      id, name_ar, name_en, slug, brand, model, category, sku,
      image_urls, specifications, description_ar, description_en,
      product_stores!inner (
        id, current_price, original_price, availability, product_url,
        is_deal, is_free_delivery, delivery_time_days, delivery_cost, coupon_code,
        stores!inner (slug, name_ar, name_en, average_rating, total_reviews)
      )
    `, { count: 'exact' })
    .eq('is_active', true);

  if (rawQuery) {
    query = query.textSearch('search_vector', rawQuery, {
      type: 'websearch',
      config: 'english',
    });
  }

  if (body.category && body.category !== 'all') {
    query = query.eq('category', body.category);
  }

  // Brand filter: prefer multi (`brands`) over single (`brand`).
  if (body.brands && body.brands.length > 0) {
    query = query.in('brand', body.brands);
  } else if (body.brand) {
    query = query.ilike('brand', body.brand);
  }

  if (body.specs && Object.keys(body.specs).length > 0) {
    query = query.contains('specifications', body.specs);
  }

  // Store filter — filters the inner-joined product_stores so products
  // without a row in any of the selected stores are dropped.
  if (body.stores && body.stores.length > 0) {
    query = query.in('product_stores.stores.slug', body.stores);
  }

  // Availability filter: if `availability[]` is set, use it; else honour
  // the legacy `in_stock_only` boolean.
  if (body.availability && body.availability.length > 0) {
    const VALID_AVAILABILITY = ['in_stock', 'out_of_stock', 'limited_stock', 'pre_order'] as const;
    type AvailabilityLit = typeof VALID_AVAILABILITY[number];
    const filtered = body.availability.filter((a): a is AvailabilityLit =>
      (VALID_AVAILABILITY as readonly string[]).includes(a)
    );
    if (filtered.length > 0) {
      query = query.in('product_stores.availability', filtered);
    }
  } else if (body.in_stock_only) {
    query = query.eq('product_stores.availability', 'in_stock');
  }

  if (body.deals_only) {
    query = query.eq('product_stores.is_deal', true);
  }
  if (body.free_delivery_only) {
    query = query.eq('product_stores.is_free_delivery', true);
  }

  if (typeof body.min_price === 'number') {
    query = query.gte('product_stores.current_price', body.min_price);
  }
  if (typeof body.max_price === 'number') {
    query = query.lte('product_stores.current_price', body.max_price);
  }

  // Pagination: new contract (page/pageSize) wins. Falls back to the old
  // (pages × 48) multiplier for legacy callers.
  let offsetStart: number;
  let offsetEnd: number;
  let currentPage: number;
  let currentPageSize: number;
  if (typeof body.page === 'number' || typeof body.pageSize === 'number') {
    currentPage = Math.max(1, body.page ?? 1);
    currentPageSize = Math.min(100, Math.max(1, body.pageSize ?? 25));
    offsetStart = (currentPage - 1) * currentPageSize;
    offsetEnd = currentPage * currentPageSize - 1;
  } else {
    // Legacy path — unchanged behaviour.
    const pages = body.pages ?? 1;
    currentPage = 1;
    currentPageSize = Math.max(pages, 1) * 48;
    offsetStart = 0;
    offsetEnd = currentPageSize - 1;
  }
  query = query.range(offsetStart, offsetEnd);

  const { data, error, count } = await query;

  if (error) {
    console.error('[search] error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ProductRow[];
  const products: GroupedSearchProduct[] = rows
    .map(toGroupedSearchProduct)
    .filter((p): p is GroupedSearchProduct => p !== null);

  products.sort(compareBySort(body.sort || 'relevance'));

  const prices = products.map((p) => p.best_price).filter((n) => n > 0);
  const total = typeof count === 'number' ? count : products.length;
  const result: ScrapedSearchResult & { total: number; page: number; pageSize: number } = {
    products,
    count: products.length,
    total,
    page: currentPage,
    pageSize: currentPageSize,
    query: rawQuery,
    storeResults: computeStoreResults(products),
    priceStats: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    },
    searchTime: (Date.now() - started) / 1000,
    errors: null,
    totalStores: computeUniqueStores(products),
    successfulStores: computeUniqueStores(products),
  };

  return NextResponse.json(result);
}

function toGroupedSearchProduct(row: ProductRow): GroupedSearchProduct | null {
  const productStores = (row.product_stores || []).filter((ps) => ps.stores);
  if (productStores.length === 0) return null;

  const storeEntries: SearchProduct[] = productStores.map((ps) => ({
    name_ar: row.name_ar,
    name_en: row.name_en,
    brand: row.brand,
    model: row.model,
    sku: row.sku,
    current_price: Number(ps.current_price),
    original_price: ps.original_price !== null ? Number(ps.original_price) : null,
    availability: ps.availability,
    product_url: ps.product_url,
    image_urls: row.image_urls || [],
    specifications: (row.specifications || {}) as Record<string, unknown>,
    category: row.category as ProductCategory,
    description_ar: row.description_ar,
    description_en: row.description_en,
    is_free_delivery: ps.is_free_delivery ?? false,
    delivery_time_days: ps.delivery_time_days,
    delivery_cost: ps.delivery_cost !== null ? Number(ps.delivery_cost) : 0,
    is_deal: ps.is_deal ?? false,
    coupon_code: ps.coupon_code,
    store: ps.stores!.slug,
    store_name: ps.stores!.name_en,
    rating: ps.stores!.average_rating !== null ? Number(ps.stores!.average_rating) : null,
    review_count: ps.stores!.total_reviews,
  }));

  const prices = storeEntries.map((e) => e.current_price).filter((n) => n > 0);
  const bestPrice = prices.length ? Math.min(...prices) : 0;
  const anyInStock = storeEntries.some((e) => e.availability === 'in_stock');
  const uniqueStores = new Set(storeEntries.map((e) => e.store)).size;

  const rep = storeEntries[0];
  return {
    ...rep,
    current_price: bestPrice,
    availability: anyInStock ? 'in_stock' : rep.availability,
    stores: storeEntries,
    best_price: bestPrice,
    store_count: uniqueStores,
    // Expose DB product id so the client can deep-link without hitting /api/products/ensure.
    product_id: row.id,
    product_slug: row.slug,
  } as unknown as GroupedSearchProduct;
}

function computeStoreResults(products: GroupedSearchProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of products) {
    for (const s of p.stores) {
      counts[s.store] = (counts[s.store] || 0) + 1;
    }
  }
  return counts;
}

function computeUniqueStores(products: GroupedSearchProduct[]): number {
  const set = new Set<string>();
  for (const p of products) for (const s of p.stores) set.add(s.store);
  return set.size;
}

function compareBySort(sort: string): (a: GroupedSearchProduct, b: GroupedSearchProduct) => number {
  if (sort === 'price_asc' || sort === 'price_low') return (a, b) => a.best_price - b.best_price;
  if (sort === 'price_desc' || sort === 'price_high') return (a, b) => b.best_price - a.best_price;
  if (sort === 'rating') {
    return (a, b) => {
      const ar = Math.max(...a.stores.map((s) => s.rating ?? 0));
      const br = Math.max(...b.stores.map((s) => s.rating ?? 0));
      return br - ar;
    };
  }
  // Default: prefer more stores carrying it (signal of relevance), then cheaper.
  return (a, b) => {
    if (b.store_count !== a.store_count) return b.store_count - a.store_count;
    return a.best_price - b.best_price;
  };
}

export async function GET() {
  return NextResponse.json({ status: 'ok', engine: 'db' });
}
