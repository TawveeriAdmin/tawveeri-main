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
  category: string;
  image_url: string | null;
  product_stores: ProductStoreRow[];
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

type IntentType = 'price' | 'compare' | 'brand' | 'category' | 'fallback';

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
  'ايفون': ['iphone'],
  'سامسونج': ['samsung'],
  'لابتوب': ['laptop', 'notebook'],
  'حاسوب': ['laptop', 'computer'],
  'كمبيوتر': ['computer', 'laptop', 'desktop'],
  'تلفزيون': ['television'],
  'شاشه': ['monitor', 'screen', 'display'],
  'سماعات': ['headphones', 'earbuds'],
  'سماعه': ['headphone', 'earbuds', 'speaker'],
  'مكيف': ['air conditioner', 'conditioner'],
  'مكيفات': ['air conditioner', 'conditioner'],
  'ثلاجه': ['refrigerator', 'fridge'],
  'غساله': ['washing machine', 'washer'],
  'طابعه': ['printer'],
  'كاميرا': ['camera'],
  'ساعه': ['smartwatch'],
  'تابلت': ['tablet'],
};

const ARABIC_STOPWORDS = new Set(
  [
    'ابي', 'ابغى', 'ابغا', 'اريد', 'ارخص', 'اغلى', 'افضل', 'احسن',
    'سعر', 'اسعار', 'كم', 'وش', 'ايش', 'في', 'من', 'الى', 'على',
    'لي', 'قدم', 'اعطني', 'اعطيني', 'هات', 'بكم', 'تقدر', 'ممكن',
    'جديد', 'حق', 'مع', 'او', 'بدون', 'الان', 'عن', 'هل', 'ايه',
  ].map(normalizeArabic)
);

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
  return (
    ['حامل', 'غطاء', 'كفر', 'ملحق', 'شاحن', 'كيبل', 'سلك', 'واقي', 'لزقه', 'لاصقه'].some((h) =>
      ar.includes(normalizeArabic(h))
    ) ||
    ['accessory', 'cover', 'mount', 'holder', 'adapter', 'charger', 'cable', 'case', 'bracket', 'protector', 'screen guard'].some(
      (h) => en.includes(h)
    )
  );
}

function buildSearchQueries(raw: string): {
  arabicQuery: string;
  arabicTokens: string[];
  englishTerms: string[];
  latinTokens: string[];
} {
  const normalized = normalizeArabic(raw);
  const words = normalized.split(/\s+/).filter(Boolean);

  const arabicTokens: string[] = [];
  const latinTokens: string[] = [];
  const englishTerms: string[] = [];

  for (const w of words) {
    if (ARABIC_STOPWORDS.has(w)) continue;
    if (/^[A-Za-z0-9]+$/.test(w)) {
      if (w.length >= 2) latinTokens.push(w.toLowerCase());
      continue;
    }
    if (w.length >= 2) arabicTokens.push(w);
    const syn = ARABIC_TO_ENGLISH[w];
    if (syn) englishTerms.push(...syn);
  }

  return {
    arabicQuery: normalized,
    arabicTokens: [...new Set(arabicTokens)],
    englishTerms: [...new Set(englishTerms)],
    latinTokens: [...new Set(latinTokens)],
  };
}

function detectIntent(query: string): IntentType {
  const text = normalizeArabic(query).toLowerCase();
  const tokens = text.split(/\s+/).filter(Boolean);
  if (/(ارخص|سعر|price|cheapest|lowest)/i.test(text)) return 'price';
  if (/(قارن|مقارنه|compare|vs|versus)/i.test(text)) return 'compare';
  if (tokens.some((t) => Object.keys(BRAND_BOOSTS).includes(t))) return 'brand';
  if (Object.keys(ARABIC_TO_ENGLISH).some((k) => text.includes(normalizeArabic(k)))) return 'category';
  return 'fallback';
}

function applyCommonFilters(query: any, body: SearchBody): any {
  if (body.category && body.category !== 'all') query = query.eq('category', body.category);
  if (body.brands && body.brands.length > 0) query = query.in('brand', body.brands);
  else if (body.brand) query = query.ilike('brand', body.brand);
  if (body.stores && body.stores.length > 0) query = query.in('product_stores.store_name', body.stores);
  if (body.availability && body.availability.length > 0) {
    const VALID = ['in_stock', 'out_of_stock', 'limited_stock', 'pre_order'] as const;
    type A = (typeof VALID)[number];
    const filtered = body.availability.filter((a): a is A => (VALID as readonly string[]).includes(a));
    if (filtered.length > 0) query = query.in('product_stores.availability', filtered);
  } else if (body.in_stock_only) {
    query = query.eq('product_stores.availability', 'in_stock');
  }
  if (typeof body.min_price === 'number') query = query.gte('product_stores.current_price', body.min_price);
  if (typeof body.max_price === 'number') query = query.lte('product_stores.current_price', body.max_price);
  return query;
}

// RELEVANCE GATE — كل كلمة عربية لازم تظهر في الاسم (AND)
function isRelevant(
  p: GroupedSearchProduct,
  arabicTokens: string[],
  latinTokens: string[]
): boolean {
  const nameAr = normalizeArabic(p.name_ar || '');
  const nameEn = (p.name_en || '').toLowerCase();
  const brand = (p.brand || '').toLowerCase();

  for (const tok of arabicTokens) {
    const directAr = nameAr.includes(tok);
    const syn = ARABIC_TO_ENGLISH[tok] || [];
    const viaSyn = syn.some((s) =>
      s.split(/\s+/).filter((x) => x.length >= 3).every((x) => nameEn.includes(x))
    );
    if (!directAr && !viaSyn) return false;
  }

  for (const tok of latinTokens) {
    if (!nameEn.includes(tok) && !brand.includes(tok)) return false;
  }

  return true;
}

function relevanceScore(
  p: GroupedSearchProduct,
  arabicTokens: string[],
  latinTokens: string[],
  englishTerms: string[]
): number {
  const nameAr = normalizeArabic(p.name_ar || '');
  const nameEn = (p.name_en || '').toLowerCase();
  let score = 0;
  for (const tok of arabicTokens) if (nameAr.includes(tok)) score += 20;
  for (const tok of latinTokens) if (nameEn.includes(tok)) score += 20;
  for (const term of englishTerms) {
    const parts = term.split(/\s+/).filter((x) => x.length >= 3);
    if (parts.length && parts.every((x) => nameEn.includes(x))) score += 10;
  }
  return score;
}

function scoreProduct(
  p: GroupedSearchProduct,
  arabicTokens: string[],
  latinTokens: string[],
  englishTerms: string[],
  intent: IntentType
): number {
  const nameAr = normalizeArabic(p.name_ar || '');
  const nameEn = (p.name_en || '').toLowerCase();
  const isAccessory = hasAccessoryHint(nameAr, nameEn);

  const relevance = relevanceScore(p, arabicTokens, latinTokens, englishTerms);
  const inStockBoost = p.stores.some((s) => s.availability === 'in_stock') ? 15 : 0;
  const storeBoost = Math.min(p.store_count * 4, 16);
  const dealBoost = p.stores.some(
    (s) => s.original_price && s.current_price && s.original_price > s.current_price
  ) ? 8 : 0;
  const brandBoost = Object.entries(BRAND_BOOSTS).reduce((acc, [brand, boost]) => {
    const hit = nameEn.includes(brand) || (p.brand || '').toLowerCase().includes(brand);
    return hit ? acc + boost : acc;
  }, 0);
  const priceBoost = p.best_price > 0 ? 4 : 0;
  const accessoryPenalty = isAccessory ? 50 : 0;
  const intentBoost =
    intent === 'price' ? priceBoost :
    intent === 'compare' ? storeBoost + dealBoost :
    0;

  return (
    relevance * 3 + inStockBoost + storeBoost + dealBoost +
    brandBoost + priceBoost + intentBoost - accessoryPenalty
  );
}

function buildReasonAr(p: GroupedSearchProduct, isCheapest: boolean): string {
  const parts: string[] = [];
  if (isCheapest) parts.push('أرخص سعر');
  if (p.store_count >= 2) parts.push(`متوفر في ${p.store_count} متاجر`);
  const dealStore = p.stores.find(
    (s) => s.original_price && s.current_price && s.original_price > s.current_price
  );
  if (dealStore && dealStore.original_price) {
    const pct = Math.round(
      ((dealStore.original_price - dealStore.current_price) / dealStore.original_price) * 100
    );
    if (pct > 0) parts.push(`خصم ${pct}%`);
  }
  if (p.stores.some((s) => s.availability === 'in_stock') && parts.length === 0)
    parts.push('متوفر الآن');
  return parts.length ? parts.join(' · ') : 'خيار مناسب';
}

function buildDecisionLayer(products: GroupedSearchProduct[]): DecisionLayer {
  const top3 = products.slice(0, 3);
  const best = top3[0] || null;

  const decisionCard = best
    ? {
        title: best.name_ar,
        best_price: best.best_price,
        store_name:
          best.stores.find((s) => s.current_price === best.best_price)?.store_name ||
          best.stores[0]?.store_name || '',
        product_url:
          best.stores.find((s) => s.current_price === best.best_price)?.product_url ||
          best.stores[0]?.product_url || '',
      }
    : null;

  const validPrices = products.map((x) => x.best_price).filter((n) => n > 0);
  const minPrice = validPrices.length ? Math.min(...validPrices) : 0;

  const topMatches: DecisionTopMatch[] = top3.map((p) => ({
    product_id: p.product_id,
    name_ar: p.name_ar,
    best_price: p.best_price,
    store_count: p.store_count,
    availability: p.availability,
    rating: Math.max(0, ...p.stores.map((s) => s.rating ?? 0)),
    product_url:
      p.stores.find((s) => s.current_price === p.best_price)?.product_url ||
      p.stores[0]?.product_url || '',
    store_name:
      p.stores.find((s) => s.current_price === p.best_price)?.store_name ||
      p.stores[0]?.store_name || '',
    reason_ar: buildReasonAr(p, p.best_price === minPrice),
  }));

  return { decisionCard, topMatches };
}

function toGroupedSearchProduct(row: ProductRow): GroupedSearchProduct | null {
  const productStores = (row.product_stores || []).filter(
    (ps) => ps && ps.current_price != null
  );
  if (productStores.length === 0) return null;

  const storeEntries: SearchProduct[] = productStores.map((ps) => ({
    name_ar: row.name_ar,
    name_en: row.name_en,
    brand: row.brand,
    model: '',
    sku: null,
    current_price: Number(ps.current_price),
    original_price: ps.original_price != null ? Number(ps.original_price) : null,
    availability: ps.availability || 'in_stock',
    product_url: ps.product_url,
    image_urls: row.image_url ? [row.image_url] : [],
    specifications: {},
    category: row.category as ProductCategory,
    description_ar: null,
    description_en: null,
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

function joinOr(parts: string[]): string {
  return [...new Set(parts)].join(',');
}

function applyPostFilters(
  products: GroupedSearchProduct[],
  body: SearchBody
): GroupedSearchProduct[] {
  let result = products;

  if (body.deals_only) {
    result = result.filter((product) =>
      product.stores.some(
        (s) => s.original_price && s.current_price && s.original_price > s.current_price
      )
    );
  }

  if (typeof body.discount === 'number') {
    result = result.filter((product) =>
      product.stores.some((store) => {
        if (!store.original_price || !store.current_price) return false;
        const discount =
          ((store.original_price - store.current_price) / store.original_price) * 100;
        return discount >= body.discount!;
      })
    );
  }

  return result;
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

const selectClause = `
  id, name_ar, name_en, brand, category,
  image_url,
  product_stores!inner (
    id, store_name, current_price, original_price,
    availability, product_url, coupon_code
  )
`;

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body: SearchBody = await request.json().catch(() => ({} as SearchBody));
  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const supabase = createServerClient();
  const intent = rawQuery ? detectIntent(rawQuery) : 'fallback';

  const currentPage = typeof body.page === 'number' ? Math.max(1, body.page) : 1;
  const currentPageSize =
    typeof body.pageSize === 'number' ? Math.min(100, Math.max(1, body.pageSize)) : 25;
  const offsetStart = (currentPage - 1) * currentPageSize;
  const offsetEnd = currentPage * currentPageSize - 1;

  let rows: ProductRow[] = [];
  let totalCount = 0;
  let dbError: string | null = null;

  let arabicTokens: string[] = [];
  let latinTokens: string[] = [];
  let englishTerms: string[] = [];

  if (rawQuery) {
    const built = buildSearchQueries(rawQuery);
    arabicTokens = built.arabicTokens;
    latinTokens = built.latinTokens;
    englishTerms = built.englishTerms;

    let collected: ProductRow[] = [];

    // Path 1: AND across Arabic tokens (chained ilike = AND)
    if (arabicTokens.length > 0) {
      let q1 = supabase
        .from('products')
        .select(selectClause, { count: 'exact' })
        .eq('is_active', true);
      for (const tok of arabicTokens) {
        q1 = q1.ilike('name_ar', `%${tok}%`);
      }
      q1 = applyCommonFilters(q1, body).range(0, 999);
      const { data: d1, error: e1 } = await q1;
      if (e1) {
        console.error('[search:q1-arabic-AND]', e1.message);
        dbError = e1.message;
      }
      collected.push(...((d1 ?? []) as unknown as ProductRow[]));
    }

    // Path 2: latin tokens (each must hit name_en or brand)
    if (latinTokens.length > 0) {
      let q2 = supabase
        .from('products')
        .select(selectClause, { count: 'exact' })
        .eq('is_active', true);
      for (const tok of latinTokens) {
        q2 = q2.or(`name_en.ilike.%${tok}%,brand.ilike.%${tok}%`);
      }
      q2 = applyCommonFilters(q2, body).range(0, 999);
      const { data: d2, error: e2 } = await q2;
      if (e2) {
        console.error('[search:q2-latin]', e2.message);
        dbError = dbError || e2.message;
      }
      collected.push(...((d2 ?? []) as unknown as ProductRow[]));
    }

    // Path 3: English synonym recall (full phrase >= 4 chars)
    if (englishTerms.length > 0) {
      const phraseTerms = englishTerms
        .map((t) => t.trim())
        .filter((t) => t.length >= 4)
        .map((t) => `name_en.ilike.%${t}%`);
      if (phraseTerms.length > 0) {
        let q3 = supabase
          .from('products')
          .select(selectClause, { count: 'exact' })
          .eq('is_active', true)
          .or(joinOr(phraseTerms));
        q3 = applyCommonFilters(q3, body).range(0, 999);
        const { data: d3, error: e3 } = await q3;
        if (e3) {
          console.error('[search:q3-synonym]', e3.message);
          dbError = dbError || e3.message;
        }
        collected.push(...((d3 ?? []) as unknown as ProductRow[]));
      }
    }

    const seen = new Map<string, ProductRow>();
    for (const row of collected) if (!seen.has(row.id)) seen.set(row.id, row);
    rows = [...seen.values()];
  } else {
    let q = supabase
      .from('products')
      .select(selectClause, { count: 'exact' })
      .eq('is_active', true);
    q = applyCommonFilters(q, body);
    q = q.range(offsetStart, offsetEnd);
    const { data, error, count } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = (data ?? []) as unknown as ProductRow[];
    totalCount = count ?? rows.length;
  }

  let products = mergeProducts(rows);

  // RELEVANCE GATE
  if (rawQuery && (arabicTokens.length > 0 || latinTokens.length > 0)) {
    const gated = products.filter((p) => isRelevant(p, arabicTokens, latinTokens));
    products = gated.length > 0 ? gated : [];
  }

  products = applyPostFilters(products, body);

  // RANK BY RELEVANCE, then optional price sort
  if (rawQuery) {
    products.sort(
      (a, b) =>
        scoreProduct(b, arabicTokens, latinTokens, englishTerms, intent) -
        scoreProduct(a, arabicTokens, latinTokens, englishTerms, intent)
    );
    if (body.sort === 'price_asc' || body.sort === 'price_low') {
      products.sort((a, b) => a.best_price - b.best_price);
    } else if (body.sort === 'price_desc' || body.sort === 'price_high') {
      products.sort((a, b) => b.best_price - a.best_price);
    }
  } else if (body.sort) {
    if (body.sort === 'price_asc' || body.sort === 'price_low')
      products.sort((a, b) => a.best_price - b.best_price);
    else if (body.sort === 'price_desc' || body.sort === 'price_high')
      products.sort((a, b) => b.best_price - a.best_price);
  }

  totalCount = rawQuery ? products.length : totalCount;

  const decision = buildDecisionLayer(products);
  const prices = products.map((p) => p.best_price).filter((n) => n > 0);
  const pageProducts = rawQuery
    ? products.slice(offsetStart, offsetEnd + 1)
    : products.slice(0, currentPageSize);

  const result: ScrapedSearchResult & {
    total: number;
    page: number;
    pageSize: number;
    decisionCard: DecisionLayer['decisionCard'];
    topMatches: DecisionTopMatch[];
    intent?: IntentType;
  } = {
    products: pageProducts,
    count: pageProducts.length,
    total: totalCount,
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
    intent,
  };

  return NextResponse.json(result);
}
