import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';
import type { ProductCategory } from '@/lib/database/types';
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

interface SearchBody {
  query?: string;
  category?: ProductCategory | string;
  page?: number;
  pageSize?: number;
  pages?: number;
  sort?: string;
  min_price?: number;
  max_price?: number;
  brand?: string;
  brands?: string[];
  stores?: string[];
  availability?: string[];
  deals_only?: boolean;
  free_delivery_only?: boolean;
  in_stock_only?: boolean;
  specs?: Record<string, string[]>;
  discount?: number;
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

type DecisionTopMatch = {
  product_id: string;
  name_ar: string;
  best_price: number;
  store_count: number;
  availability: string;
  rating: number;
  product_url: string;
  store_name: string;
};

type DecisionLayer = {
  decisionCard: {
    title: string;
    best_price: number;
    store_name: string;
    product_url: string;
  } | null;
  topMatches: DecisionTopMatch[];
};

function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0640/g, '')
    .trim();
}

const ARABIC_TO_ENGLISH: Record<string, string> = {
  'جوال': 'smartphone phone mobile',
  'هاتف': 'smartphone phone mobile',
  'ايفون': 'iphone apple',
  'سامسونج': 'samsung',
  'لابتوب': 'laptop notebook',
  'حاسوب': 'laptop computer',
  'كمبيوتر': 'computer laptop desktop',
  'تلفزيون': 'tv television',
  'شاشة': 'monitor screen display tv',
  'سماعات': 'headphones earbuds audio',
  'مكيف': 'air conditioner ac split',
  'ثلاجة': 'refrigerator fridge',
  'غسالة': 'washing machine washer',
  'مكنسة': 'vacuum cleaner',
  'طابعة': 'printer',
  'راوتر': 'router wifi network',
  'كاميرا': 'camera',
  'ساعة': 'smartwatch watch',
  'برو': 'pro',
  'ماكس': 'max',
  'بلس': 'plus',
  'الترا': 'ultra',
  'ميني': 'mini',
};

function buildSearchQueries(raw: string): { arabicQuery: string; englishQuery: string } {
  const normalized = normalizeArabic(raw);
  const words = normalized.split(/\s+/).filter(Boolean);
  const englishParts: string[] = [];
  for (const word of words) {
    const mapped = ARABIC_TO_ENGLISH[word] || ARABIC_TO_ENGLISH[normalizeArabic(word)];
    if (mapped) englishParts.push(mapped);
    else if (/[A-Za-z0-9]/.test(word)) englishParts.push(word);
  }
  return { arabicQuery: normalized, englishQuery: englishParts.join(' ') };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCommonFilters(query: any, body: SearchBody): any {
  if (body.category && body.category !== 'all') query = query.eq('category', body.category);
  if (body.brands && body.brands.length > 0) query = query.in('brand', body.brands);
  else if (body.brand) query = query.ilike('brand', body.brand);
  if (body.stores && body.stores.length > 0) query = query.in('product_stores.stores.slug', body.stores);
  if (body.availability && body.availability.length > 0) {
    const VALID = ['in_stock', 'out_of_stock', 'limited_stock', 'pre_order'] as const;
    type A = typeof VALID[number];
    const filtered = body.availability.filter((a): a is A => (VALID as readonly string[]).includes(a));
    if (filtered.length > 0) query = query.in('product_stores.availability', filtered);
  } else if (body.in_stock_only) {
    query = query.eq('product_stores.availability', 'in_stock');
  }
  if (body.deals_only) query = query.eq('product_stores.is_deal', true);
  if (body.free_delivery_only) query = query.eq('product_stores.is_free_delivery', true);
  if (typeof body.min_price === 'number') query = query.gte('product_stores.current_price', body.min_price);
  if (typeof body.max_price === 'number') query = query.lte('product_stores.current_price', body.max_price);
  return query;
}

function scoreProduct(p: GroupedSearchProduct): number {
  const inStockBoost = p.stores.some((s) => s.availability === 'in_stock') ? 25 : 0;
  const storeBoost = Math.min(p.store_count * 6, 18);
  const dealBoost = p.stores.some((s) => s.is_deal) ? 8 : 0;
  const freeDeliveryBoost = p.stores.some((s) => s.is_free_delivery) ? 4 : 0;
  const rating = Math.max(...p.stores.map((s) => s.rating ?? 0));
  const ratingBoost = rating > 0 ? rating * 3 : 0;
  const pricePenalty = p.best_price > 0 ? Math.min(p.best_price / 120, 20) : 20;
  return inStockBoost + storeBoost + dealBoost + freeDeliveryBoost + ratingBoost - pricePenalty;
}

function buildDecisionLayer(products: GroupedSearchProduct[]): DecisionLayer {
  const ranked = [...products].sort((a, b) => scoreProduct(b) - scoreProduct(a));
  const top3 = ranked.slice(0, 3);

  const best = top3[0] || null;
  const decisionCard = best
    ? {
        title: best.name_ar,
        best_price: best.best_price,
        store_name: best.stores.find((s) => s.current_price === best.best_price)?.store_name || best.stores[0]?.store_name || '',
        product_url: best.stores.find((s) => s.current_price === best.best_price)?.product_url || best.stores[0]?.product_url || '',
      }
    : null;

  const topMatches: DecisionTopMatch[] = top3.map((p) => ({
    product_id: p.product_id,
    name_ar: p.name_ar,
    best_price: p.best_price,
    store_count: p.store_count,
    availability: p.availability,
    rating: Math.max(...p.stores.map((s) => s.rating ?? 0)),
    product_url: p.stores.find((s) => s.current_price === p.best_price)?.product_url || p.stores[0]?.product_url || '',
    store_name: p.stores.find((s) => s.current_price === p.best_price)?.store_name || p.stores[0]?.store_name || '',
  }));

  return { decisionCard, topMatches };
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body: SearchBody = await request.json().catch(() => ({} as SearchBody));
  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const supabase = createServerClient();

  const selectClause = `
    id, name_ar, name_en, slug, brand, model, category, sku,
    image_urls, specifications, description_ar, description_en,
    product_stores!inner (
      id, current_price, original_price, availability, product_url,
      is_deal, is_free_delivery, delivery_time_days, delivery_cost, coupon_code,
      stores!inner (slug, name_ar, name_en, average_rating, total_reviews)
    )
  `;

  const hasPostFilters =
    typeof body.discount === 'number' ||
    (body.specs !== undefined && Object.keys(body.specs).length > 0);

  let currentPage: number;
  let currentPageSize: number;
  let offsetStart: number;
  let offsetEnd: number;

  if (typeof body.page === 'number' || typeof body.pageSize === 'number') {
    currentPage = Math.max(1, body.page ?? 1);
    currentPageSize = Math.min(100, Math.max(1, body.pageSize ?? 25));
    offsetStart = (currentPage - 1) * currentPageSize;
    offsetEnd = currentPage * currentPageSize - 1;
  } else {
    const pages = body.pages ?? 1;
    currentPage = 1;
    currentPageSize = Math.max(pages, 1) * 48;
    offsetStart = 0;
    offsetEnd = currentPageSize - 1;
  }

  let rows: ProductRow[] = [];
  let totalCount = 0;

  if (rawQuery) {
    const { arabicQuery, englishQuery } = buildSearchQueries(rawQuery);
    const arabicWords = arabicQuery.split(/\s+/).filter(Boolean);

    let q1 = supabase.from('products').select(selectClause, { count: 'exact' }).eq('is_active', true);
    if (arabicWords.length > 0) {
      const orParts = arabicWords.flatMap(w => [
        `name_ar.ilike.%${w}%`,
        `name_en.ilike.%${w}%`,
        `brand.ilike.%${w}%`,
      ]).join(',');
      q1 = q1.or(orParts);
    }
    q1 = applyCommonFilters(q1, body);
    q1 = q1.range(0, hasPostFilters ? 4999 : offsetEnd + 200);
    const { data: d1, count: c1 } = await q1;
    const pass1Rows = (d1 ?? []) as unknown as ProductRow[];

    let pass2Rows: ProductRow[] = [];
    if (englishQuery) {
      let q2 = supabase.from('products').select(selectClause, { count: 'exact' }).eq('is_active', true)
        .textSearch('search_vector', englishQuery, { type: 'websearch', config: 'english' });
      q2 = applyCommonFilters(q2, body);
      q2 = q2.range(0, hasPostFilters ? 4999 : offsetEnd + 200);
      const { data: d2 } = await q2;
      pass2Rows = (d2 ?? []) as unknown as ProductRow[];
    }

    let pass3Rows: ProductRow[] = [];
    if (/[A-Za-z]/.test(rawQuery)) {
      let q3 = supabase.from('products').select(selectClause, { count: 'exact' }).eq('is_active', true)
        .textSearch('search_vector', rawQuery, { type: 'websearch', config: 'english' });
      q3 = applyCommonFilters(q3, body);
      q3 = q3.range(0, hasPostFilters ? 4999 : offsetEnd + 200);
      const { data: d3 } = await q3;
      pass3Rows = (d3 ?? []) as unknown as ProductRow[];
    }

    const seen = new Set<string>();
    const merged: ProductRow[] = [];
    for (const row of [...pass1Rows, ...pass2Rows, ...pass3Rows]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }
    rows = merged;
    totalCount = c1 ?? merged.length;
  } else {
    let q = supabase.from('products').select(selectClause, { count: 'exact' }).eq('is_active', true);
    q = applyCommonFilters(q, body);
    q = q.range(hasPostFilters ? 0 : offsetStart, hasPostFilters ? 4999 : offsetEnd);
    const { data, error, count } = await q;
    if (error) {
      console.error('[search] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = (data ?? []) as unknown as ProductRow[];
    totalCount = count ?? rows.length;
  }

  let products: GroupedSearchProduct[] = rows
    .map(toGroupedSearchProduct)
    .filter((p): p is GroupedSearchProduct => p !== null);

  products = applyPostFilters(products, body);
  products.sort(compareBySort(body.sort || 'relevance'));

  const decision = buildDecisionLayer(products);

  const total = hasPostFilters ? products.length : totalCount;
  const pageProducts = hasPostFilters
    ? products.slice(offsetStart, offsetEnd + 1)
    : products.slice(0, currentPageSize);

  const prices = pageProducts.map((p) => p.best_price).filter((n) => n > 0);
  const result: ScrapedSearchResult & {
    total: number;
    page: number;
    pageSize: number;
    decisionCard: DecisionLayer['decisionCard'];
    topMatches: DecisionTopMatch[];
  } = {
    products: pageProducts,
    count: pageProducts.length,
    total,
    page: currentPage,
    pageSize: currentPageSize,
    query: rawQuery,
    storeResults: computeStoreResults(pageProducts),
    priceStats: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    },
    searchTime: (Date.now() - started) / 1000,
    errors: null,
    totalStores: computeUniqueStores(pageProducts),
    successfulStores: computeUniqueStores(pageProducts),
    decisionCard: decision.decisionCard,
    topMatches: decision.topMatches,
  };

  return NextResponse.json(result);
}

function applyPostFilters(products: GroupedSearchProduct[], body: SearchBody): GroupedSearchProduct[] {
  let result = products;
  if (typeof body.discount === 'number') {
    result = result.filter((product) =>
      product.stores.some((store) => {
        if (!store.original_price || !store.current_price) return false;
        const discount = ((store.original_price - store.current_price) / store.original_price) * 100;
        return discount >= body.discount!;
      })
    );
  }

  if (body.specs && Object.keys(body.specs).length > 0) {
    result = result.filter((product) => {
      const dbSpecs = (product.specifications ?? null) as Record<string, unknown> | null;
      const hasDbSpecs = dbSpecs && Object.keys(dbSpecs).length > 0;
      const fallbackSpecs = hasDbSpecs ? null : extractSpecsFromTitle(product.name_en || product.name_ar || '');
      return Object.entries(body.specs!).every(([key, values]) => {
        if (!values || values.length === 0) return true;
        const dbValue = hasDbSpecs ? dbSpecs![key] : undefined;
        const value = dbValue !== undefined && dbValue !== null
          ? String(dbValue).toLowerCase()
          : fallbackSpecs?.[key] ?? '';
        return values.map((item) => item.toLowerCase()).includes(value);
      });
    });
  }

  return result;
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
    product_id: row.id,
    product_slug: row.slug,
  } as unknown as GroupedSearchProduct;
}

function computeStoreResults(products: GroupedSearchProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of products) for (const s of p.stores) counts[s.store] = (counts[s.store] || 0) + 1;
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
  return (a, b) => {
    if (b.store_count !== a.store_count) return b.store_count - a.store_count;
    return a.best_price - b.best_price;
  };
}

export async function GET() {
  return NextResponse.json({ status: 'ok', engine: 'db', arabic: true });
}
