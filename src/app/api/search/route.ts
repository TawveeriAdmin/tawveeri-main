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
  brand: string;
  model: string;
  category: string;
  sku: string | null;
  image_urls: string[] | null;
  specifications: Record<string, unknown> | null;
  description_ar: string | null;
  description_en: string | null;
  product_stores: ProductStoreRow[];
  search_rank?: number | null;
}

interface ProductStoreRow {
  id: string;
  store_name: string | null;
  current_price: number;
  original_price: number | null;
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order' | null;
  product_url: string;
  coupon_code: string | null;
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
  reason_ar: string;
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

const ARABIC_TO_ENGLISH: Record<string, string[]> = {
  'جوال': ['phone', 'smartphone', 'mobile'],
  'هاتف': ['phone', 'smartphone', 'mobile'],
  'ايفون': ['iphone', 'apple'],
  'سامسونج': ['samsung'],
  'لابتوب': ['laptop', 'notebook'],
  'حاسوب': ['laptop', 'computer'],
  'كمبيوتر': ['computer', 'laptop', 'desktop'],
  'تلفزيون': ['tv', 'television'],
  'شاشة': ['tv', 'monitor', 'screen', 'display'],
  'سماعات': ['headphones', 'earbuds', 'audio'],
  'سماعة': ['headphone', 'earbuds', 'speaker'],
  'مكيف': ['split ac', 'air conditioner', 'ac'],
  'مكيفات': ['split ac', 'air conditioner', 'ac'],
  'سبليت': ['split'],
  'شباك': ['window'],
  'ثلاجة': ['refrigerator', 'fridge'],
  'فريزر': ['freezer'],
  'غسالة': ['washing machine', 'washer'],
  'نشافة': ['dryer'],
  'مكنسة': ['vacuum', 'cleaner'],
  'مايكروويف': ['microwave'],
  'ميكروويف': ['microwave'],
  'فرن': ['oven'],
  'طابعة': ['printer'],
  'راوتر': ['router', 'wifi', 'network'],
  'كاميرا': ['camera'],
  'ساعة': ['smartwatch', 'watch'],
  'تابلت': ['tablet'],
  'برو': ['pro'],
  'ماكس': ['max'],
  'بلس': ['plus'],
  'الترا': ['ultra'],
  'ميني': ['mini'],
  'اير': ['air'],
};

const ACCESSORY_HINTS_AR = ['حامل', 'فتحة', 'موجه', 'غطاء', 'كفر', 'ملحق', 'ملحقات', 'حافظة', 'واقي', 'شاحن', 'كيبل', 'سلك'];
const ACCESSORY_HINTS_EN = ['accessory', 'accessories', 'cover', 'mount', 'holder', 'vent', 'adapter', 'charger', 'cable', 'case', 'remote', 'bracket'];

const BRAND_BOOSTS: Record<string, number> = {
  samsung: 8,
  apple: 10,
  sony: 6,
  lg: 6,
  xiaomi: 5,
  huawei: 4,
  lenovo: 4,
  dell: 4,
  hp: 4,
  asus: 4,
  acer: 3,
  philips: 3,
  panasonic: 3,
  tcl: 3,
  sharp: 3,
};

function hasAccessoryHint(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr);
  const en = (nameEn || '').toLowerCase();
  return ACCESSORY_HINTS_AR.some((h) => ar.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => en.includes(h));
}

function hasACSignal(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr);
  const en = (nameEn || '').toLowerCase();
  const arHit = /(^|\s)مكيف|سبليت|شباك/.test(ar);
  const enHit = /\bsplit\b/.test(en) || /\bair\s*condition/.test(en) || /\ba\/?c\b/.test(en);
  return arHit || enHit;
}

function expandToEnglish(words: string[]): string[] {
  const out = new Set<string>();
  for (const w of words) {
    const key = normalizeArabic(w);
    const mapped = ARABIC_TO_ENGLISH[w] || ARABIC_TO_ENGLISH[key];
    if (mapped) for (const m of mapped) out.add(m);
    else if (/[A-Za-z0-9]/.test(w)) out.add(w);
  }
  return [...out];
}

function buildSearchQueries(raw: string): { arabicQuery: string; englishTerms: string[] } {
  const normalized = normalizeArabic(raw);
  const words = normalized.split(/\s+/).filter(Boolean);
  const englishTerms = expandToEnglish(words);
  return { arabicQuery: normalized, englishTerms };
}

function applyCommonFilters(query: any, body: SearchBody): any {
  if (body.category && body.category !== 'all') query = query.eq('category', body.category);
  if (body.brands && body.brands.length > 0) query = query.in('brand', body.brands);
  else if (body.brand) query = query.ilike('brand', body.brand);
  if (body.stores && body.stores.length > 0) query = query.in('product_stores.store_name', body.stores);
  if (body.availability && body.availability.length > 0) {
    const VALID = ['in_stock', 'out_of_stock', 'limited_stock', 'pre_order'] as const;
    type A = typeof VALID[number];
    const filtered = body.availability.filter((a): a is A => (VALID as readonly string[]).includes(a));
    if (filtered.length > 0) query = query.in('product_stores.availability', filtered);
  } else if (body.in_stock_only) {
    query = query.eq('product_stores.availability', 'in_stock');
  }
  if (typeof body.min_price === 'number') query = query.gte('product_stores.current_price', body.min_price);
  if (typeof body.max_price === 'number') query = query.lte('product_stores.current_price', body.max_price);
  return query;
}

function scoreProduct(p: GroupedSearchProduct, queryWords: string[], priceMin: number, priceMax: number): number {
  const nameAr = normalizeArabic(p.name_ar || '');
  const nameEn = (p.name_en || '').toLowerCase();
  const isAccessory = hasAccessoryHint(nameAr, nameEn);
  const acSignal = hasACSignal(nameAr, nameEn);

  const inStockBoost = p.stores.some((s) => s.availability === 'in_stock') ? 30 : 0;
  const storeBoost = Math.min(p.store_count * 7, 24);
  const dealBoost = p.stores.some((s) => s.original_price && s.current_price && s.original_price > s.current_price) ? 12 : 0;
  const rating = Math.max(...p.stores.map((s) => s.rating ?? 0));
  const ratingBoost = rating > 0 ? rating * 4 : 0;

  const brandBoost = Object.entries(BRAND_BOOSTS).reduce((acc, [brand, boost]) => {
    const hit = nameAr.includes(normalizeArabic(brand)) || nameEn.includes(brand);
    return hit ? acc + boost : acc;
  }, 0);

  const queryBoost = queryWords.reduce((acc, w) => {
    const t = normalizeArabic(w);
    if (!t) return acc;
    if (nameAr.includes(t)) return acc + 6;
    if (nameEn.includes(t.toLowerCase())) return acc + 4;
    return acc;
  }, 0);

  let pricePenalty = 18;
  if (p.best_price > 0 && priceMax > priceMin) {
    pricePenalty = ((p.best_price - priceMin) / (priceMax - priceMin)) * 18;
  } else if (p.best_price > 0) {
    pricePenalty = 0;
  }

  const accessoryPenalty = isAccessory ? 50 : 0;
  const acBoost = acSignal ? 14 : 0;

  return inStockBoost + storeBoost + dealBoost + ratingBoost + brandBoost + queryBoost + acBoost - pricePenalty - accessoryPenalty;
}

function buildReasonAr(p: GroupedSearchProduct, isCheapest: boolean): string {
  const parts: string[] = [];
  if (isCheapest) parts.push('أرخص سعر');
  if (p.store_count >= 2) parts.push(`متوفر في ${p.store_count} متاجر`);
  const dealStore = p.stores.find((s) => s.original_price && s.current_price && s.original_price > s.current_price);
  if (dealStore && dealStore.original_price) {
    const pct = Math.round(((dealStore.original_price - dealStore.current_price) / dealStore.original_price) * 100);
    if (pct > 0) parts.push(`خصم ${pct}%`);
  }
  const inStock = p.stores.some((s) => s.availability === 'in_stock');
  if (inStock && parts.length === 0) parts.push('متوفر الآن');
  return parts.length ? parts.join(' · ') : 'خيار مناسب';
}

function buildDecisionLayer(products: GroupedSearchProduct[]): DecisionLayer {
  const prices = products.map((p) => p.best_price).filter((n) => n > 0);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;

  const ranked = [...products].sort((a, b) => scoreProduct(b, [], priceMin, priceMax) - scoreProduct(a, [], priceMin, priceMax));
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
    reason_ar: buildReasonAr(p, p.best_price === priceMin && priceMin > 0),
  }));

  return { decisionCard, topMatches };
}

function mergeProducts(rows: ProductRow[]): GroupedSearchProduct[] {
  const groupedMap = new Map<string, GroupedSearchProduct>();

  for (const row of rows) {
    const grouped = toGroupedSearchProduct(row);
    if (!grouped) continue;

    const existing = groupedMap.get(grouped.product_id);
    if (!existing) {
      groupedMap.set(grouped.product_id, grouped);
      continue;
    }

    const mergedStores = [...existing.stores, ...grouped.stores];
    const uniqueStores = new Map<string, SearchProduct>();

    for (const s of mergedStores) {
      const key = `${s.store_name || s.store}-${s.product_url}-${s.current_price}`;
      if (!uniqueStores.has(key)) uniqueStores.set(key, s);
    }

    const stores = [...uniqueStores.values()];
    const prices = stores.map((e) => e.current_price).filter((n) => n > 0);
    const bestPrice = prices.length ? Math.min(...prices) : 0;

    groupedMap.set(grouped.product_id, {
      ...existing,
      stores,
      current_price: bestPrice,
      best_price: bestPrice,
      store_count: new Set(stores.map((s) => s.store)).size,
      availability: stores.some((s) => s.availability === 'in_stock') ? 'in_stock' : existing.availability,
    } as GroupedSearchProduct);
  }

  return [...groupedMap.values()].filter((p) => p.stores.length > 0);
}

function toTsQuery(raw: string): string {
  const words = normalizeArabic(raw).split(/\s+/).filter(Boolean).map((w) => w.replace(/'/g, "''"));
  if (!words.length) return '';
  return words.join(' & ');
}

function joinOr(parts: string[]): string {
  return [...new Set(parts)].join(',');
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body: SearchBody = await request.json().catch(() => ({} as SearchBody));
  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const supabase = createServerClient();

  const selectClause = `
    id, name_ar, name_en, brand, model, category, sku,
    image_urls, specifications, description_ar, description_en,
    product_stores!inner (
      id, store_name, current_price, original_price, availability, product_url, coupon_code
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
  let dbError: string | null = null;

  if (rawQuery) {
    const { arabicQuery, englishTerms } = buildSearchQueries(rawQuery);
    const arabicWords = arabicQuery.split(/\s+/).filter(Boolean);
    const queryWords = [...new Set([...arabicWords, ...englishTerms.flatMap((t) => t.split(/\s+/))])];
    const tsQuery = toTsQuery(rawQuery);

    const ftsSelect = `
      id, name_ar, name_en, brand, model, category, sku,
      image_urls, specifications, description_ar, description_en,
      product_stores!inner (
        id, store_name, current_price, original_price, availability, product_url, coupon_code
      ),
      search_rank
    `;

    const baseFields = `
      id, name_ar, name_en, brand, model, category, sku,
      image_urls, specifications, description_ar, description_en,
      product_stores!inner (
        id, store_name, current_price, original_price, availability, product_url, coupon_code
      )
    `;

    let collected: ProductRow[] = [];

    if (tsQuery) {
      const rankExpr = `ts_rank(
        setweight(to_tsvector('simple', coalesce(name_ar, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(name_en, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(brand, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(model, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(description_en, '')), 'D'),
        websearch_to_tsquery('simple', '${tsQuery}')
      )`;

      let ftsQuery = supabase
        .from('products')
        .select(baseFields, { count: 'exact' })
        .eq('is_active', true)
        .or(joinOr([
          `name_ar.ilike.%${arabicQuery}%`,
          `name_en.ilike.%${rawQuery}%`,
          `brand.ilike.%${rawQuery}%`,
        ]));

      ftsQuery = applyCommonFilters(ftsQuery, body);
      ftsQuery = ftsQuery.range(0, hasPostFilters ? 4999 : offsetEnd + 200);

      const { data: ftsData, error: ftsError } = await ftsQuery;
      if (ftsError) {
        console.error('[search:fts]', ftsError.message);
        dbError = ftsError.message;
      }

      const pass1 = (ftsData ?? []) as unknown as ProductRow[];
      collected.push(...pass1);

      let q2 = supabase.from('products').select(baseFields, { count: 'exact' }).eq('is_active', true);
      if (englishTerms.length > 0) {
        const englishOr = englishTerms.flatMap((term) => term.split(/\s+/).filter((t) => t.length >= 2).map((t) => `name_en.ilike.%${t}%`));
        const uniqueEnglishOr = joinOr(englishOr);
        if (uniqueEnglishOr) q2 = q2.or(uniqueEnglishOr);
      }

      q2 = applyCommonFilters(q2, body);
      q2 = q2.range(0, hasPostFilters ? 4999 : offsetEnd + 200);

      const { data: d2, error: e2 } = await q2;
      if (e2) {
        console.error('[search:q2]', e2.message);
        dbError = dbError || e2.message;
      }

      collected.push(...((d2 ?? []) as unknown as ProductRow[]));
    } else {
      let q1 = supabase.from('products').select(baseFields, { count: 'exact' }).eq('is_active', true);
      if (arabicWords.length > 0) {
        q1 = q1.or(joinOr(arabicWords.flatMap((w) => [
          `name_ar.ilike.%${w}%`,
          `name_en.ilike.%${w}%`,
          `brand.ilike.%${w}%`,
        ])));
      }
      q1 = applyCommonFilters(q1, body);
      q1 = q1.range(0, hasPostFilters ? 4999 : offsetEnd + 200);
      const { data: d1, error: e1 } = await q1;
      if (e1) {
        console.error('[search:q1]', e1.message);
        dbError = e1.message;
      }
      collected.push(...((d1 ?? []) as unknown as ProductRow[]));
    }

    const seen = new Map<string, ProductRow>();
    for (const row of collected) {
      if (!seen.has(row.id)) seen.set(row.id, row);
    }
    rows = [...seen.values()];
    totalCount = rows.length;
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

  let products = mergeProducts(rows);

  products = applyPostFilters(products, body);

  if (rawQuery) {
    const prices = products.map((p) => p.best_price).filter((n) => n > 0);
    const pMin = prices.length ? Math.min(...prices) : 0;
    const pMax = prices.length ? Math.max(...prices) : 0;
    const requestedSort = body.sort && body.sort !== 'relevance';
    if (requestedSort) products.sort(compareBySort(body.sort!));
    else products.sort((a, b) => scoreProduct(b, queryWords, pMin, pMax) - scoreProduct(a, queryWords, pMin, pMax));
  } else {
    products.sort(compareBySort(body.sort || 'relevance'));
  }

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
    errors: dbError,
    totalStores: computeUniqueStores(pageProducts),
    successfulStores: computeUniqueStores(pageProducts),
    decisionCard: decision.decisionCard,
    topMatches: decision.topMatches,
  };

  return NextResponse.json(result);
}

function applyPostFilters(products: GroupedSearchProduct[], body: SearchBody): GroupedSearchProduct[] {
  let result = products;

  if (body.deals_only) {
    result = result.filter((product) =>
      product.stores.some((s) => s.original_price && s.current_price && s.original_price > s.current_price)
    );
  }

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
  const productStores = (row.product_stores || []).filter((ps) => ps && ps.current_price != null);
  if (productStores.length === 0) return null;

  const storeEntries: SearchProduct[] = productStores.map((ps) => ({
    name_ar: row.name_ar,
    name_en: row.name_en,
    brand: row.brand,
    model: row.model,
    sku: row.sku,
    current_price: Number(ps.current_price),
    original_price: ps.original_price !== null && ps.original_price !== undefined ? Number(ps.original_price) : null,
    availability: ps.availability || 'in_stock',
    product_url: ps.product_url,
    image_urls: row.image_urls || [],
    specifications: (row.specifications || {}) as Record<string, unknown>,
    category: row.category as ProductCategory,
    description_ar: row.description_ar,
    description_en: row.description_en,
    is_free_delivery: false,
    delivery_time_days: null,
    delivery_cost: 0,
    is_deal: !!(ps.original_price && ps.current_price && ps.original_price > ps.current_price),
    coupon_code: ps.coupon_code ?? null,
    store: ps.store_name || 'unknown',
    store_name: ps.store_name || '',
    rating: null,
    review_count: null,
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
  return (a, b) => {
    if (b.store_count !== a.store_count) return b.store_count - a.store_count;
    return a.best_price - b.best_price;
  };
}
