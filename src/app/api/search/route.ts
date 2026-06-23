import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';
import type { ProductCategory } from '@/lib/database/types';
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';
import { searchAlgolia, isAlgoliaConfigured, type AlgoliaHit } from '@/lib/algolia/search';

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
  brand: string | null;
  category: string | null;
  image_url: string | null;
  product_stores: ProductStoreRow[];
}

// الهيكلة الموحّدة: اسم المتجر نص مباشر في product_stores (لا join مع stores)
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

// ── الجسر اللغوي: عربي → إنجليزي (منقول من api/match) ──────
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

// إشارات الملحقات: للترتيب (دفن) فقط — لا للحذف
const ACCESSORY_HINTS_AR = ['حامل', 'فتحة', 'موجه', 'غطاء', 'كفر', 'ملحق', 'ملحقات', 'حافظة', 'واقي', 'شاحن', 'كيبل', 'سلك', 'لاصقة', 'حماية', 'استاند', 'عدسة'];
const ACCESSORY_HINTS_EN = ['accessory', 'accessories', 'cover', 'mount', 'holder', 'vent', 'adapter', 'charger', 'cable', 'case', 'remote', 'bracket', 'protector', 'stand', 'sticker', 'skin', 'lens'];

// ── أنواع المنتجات الرئيسية: لو البحث عن واحد منها، الملحق يُسحق للقاع ──────
const MAIN_PRODUCT_TYPES = new Set<string>([
  'جوال', 'هاتف', 'ايفون', 'جوالات', 'هواتف',
  'مكيف', 'مكيفات', 'سبليت',
  'لابتوب', 'حاسوب', 'كمبيوتر',
  'تلفزيون', 'شاشه', 'شاشات',
  'ثلاجه', 'فريزر', 'غساله', 'نشافه', 'مكنسه',
  'مايكروويف', 'ميكروويف', 'فرن', 'طابعه', 'راوتر', 'كاميرا', 'ساعه', 'تابلت',
  'سماعه', 'سماعات',
  'phone', 'iphone', 'smartphone', 'mobile', 'laptop', 'tv', 'television',
  'refrigerator', 'fridge', 'freezer', 'washer', 'dryer', 'vacuum',
  'microwave', 'oven', 'printer', 'router', 'camera', 'tablet', 'headphones',
]);

function isMainProductTypeQuery(raw: string): boolean {
  const norm = normalizeArabic(raw).toLowerCase();
  const words = norm.split(/\s+/).filter(Boolean);
  return words.some((w) => MAIN_PRODUCT_TYPES.has(w));
}

function hasAccessoryHint(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr);
  const en = (nameEn || '').toLowerCase();
  return ACCESSORY_HINTS_AR.some((h) => ar.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => en.includes(h));
}

// إشارة "مكيف رئيسي" — كلمات كاملة لتفادي مطابقة ac داخل كلمة أخرى
function hasACSignal(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr);
  const en = (nameEn || '').toLowerCase();
  const arHit = /(^|\s)مكيف|سبليت|شباك/.test(ar);
  const enHit = /\bsplit\b/.test(en) || /\bair\s*condition/.test(en) || /\ba\/?c\b/.test(en);
  return arHit || enHit;
}

// كلمات يجب تجاهلها (لا تُطابَق): تفضيلات/روابط لا توجد في أسماء المنتجات
const STOPWORDS = new Set<string>([
  'افضل', 'احسن', 'ارخص', 'اغلى', 'رخيص', 'غالي', 'الافضل', 'الارخص',
  'جديد', 'الجديد', 'قديم', 'عرض', 'عروض', 'سعر', 'اسعار', 'الاسعار',
  'بكم', 'كم', 'في', 'من', 'على', 'مع', 'الى', 'او', 'و', 'ابي', 'ابغى', 'اريد', 'ودي',
  'best', 'cheapest', 'cheap', 'price', 'prices', 'new', 'offer', 'offers', 'deal', 'deals',
  'the', 'a', 'an', 'in', 'of', 'for', 'with', 'and', 'or', 'want',
]);

// توسيع كلمة بحث إلى كل صيغ المطابقة (عربي مطبّع + إنجليزي مترجم) — تُستخدم للمطابقة في JS.
function expandWordTerms(word: string): string[] {
  const norm = normalizeArabic(word).toLowerCase();
  const terms = new Set<string>();
  if (norm) terms.add(norm);
  const mapped = ARABIC_TO_ENGLISH[word] || ARABIC_TO_ENGLISH[normalizeArabic(word)];
  if (mapped) {
    for (const m of mapped) {
      for (const tok of m.split(/\s+/)) {
        if (tok.length >= 2) terms.add(tok.toLowerCase());
      }
    }
  }
  return [...terms];
}

// أجزاء OR لجلب مجموعة المرشّحين من قاعدة البيانات (واسعة، نفس أسلوب النسخة الناجحة).
function buildOrPool(words: string[]): string {
  const parts: string[] = [];
  for (const word of words) {
    const clean = word.replace(/[(),]/g, ' ').trim();
    if (!clean) continue;
    parts.push(`name_ar.ilike.%${clean}%`, `name_en.ilike.%${clean}%`, `brand.ilike.%${clean}%`);
    const norm = normalizeArabic(clean);
    const mapped = ARABIC_TO_ENGLISH[clean] || ARABIC_TO_ENGLISH[norm];
    if (mapped) {
      for (const m of mapped) {
        for (const tok of m.split(/\s+/)) {
          if (tok.length >= 2) parts.push(`name_en.ilike.%${tok}%`);
        }
      }
    }
  }
  return [...new Set(parts)].join(',');
}

// المطابقة الصارمة (AND) في JS: المنتج يطابق كل كلمات البحث — كل كلمة موجودة بإحدى صيغها.
function productMatchesAllWords(row: ProductRow, wordTermsList: string[][]): boolean {
  const hay = (
    normalizeArabic(row.name_ar || '') + ' ' +
    normalizeArabic(row.name_en || '') + ' ' +
    normalizeArabic(row.brand || '')
  ).toLowerCase();
  return wordTermsList.every((terms) => terms.some((t) => hay.includes(t)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCommonFilters(query: any, body: SearchBody): any {
  if (body.category && body.category !== 'all') query = query.eq('category', body.category);
  if (body.brands && body.brands.length > 0) query = query.in('brand', body.brands);
  else if (body.brand) query = query.ilike('brand', body.brand);
  // فلتر المتجر الآن على الاسم النصي مباشرة (الهيكلة الموحّدة)
  if (body.stores && body.stores.length > 0) query = query.in('product_stores.store_name', body.stores);
  if (body.availability && body.availability.length > 0) {
    const VALID = ['in_stock', 'out_of_stock', 'limited_stock', 'pre_order'] as const;
    type A = typeof VALID[number];
    const filtered = body.availability.filter((a): a is A => (VALID as readonly string[]).includes(a));
    if (filtered.length > 0) query = query.in('product_stores.availability', filtered);
  } else if (body.in_stock_only) {
    query = query.eq('product_stores.availability', 'in_stock');
  }
  // ملاحظة: حذفنا فلاتر product_stores.is_deal و is_free_delivery لأنها غير مضمونة الوجود.
  if (typeof body.min_price === 'number') query = query.gte('product_stores.current_price', body.min_price);
  if (typeof body.max_price === 'number') query = query.lte('product_stores.current_price', body.max_price);
  return query;
}

// ── الترتيب: رفع المنتج الأساسي + سحق الملحقات عند البحث عن نوع رئيسي ──────
function scoreProduct(p: GroupedSearchProduct, priceMin: number, priceMax: number, queryIsMainProduct: boolean): number {
  const isAccessory = hasAccessoryHint(p.name_ar || '', p.name_en || '');
  const acSignal = hasACSignal(p.name_ar || '', p.name_en || '');

  const inStockBoost = p.stores.some((s) => s.availability === 'in_stock') ? 25 : 0;
  const storeBoost = Math.min(p.store_count * 6, 18);
  const dealBoost = p.stores.some((s) => s.original_price && s.current_price && s.original_price > s.current_price) ? 8 : 0;
  const rating = Math.max(...p.stores.map((s) => s.rating ?? 0));
  const ratingBoost = rating > 0 ? rating * 3 : 0;

  let pricePenalty = 22;
  if (p.best_price > 0 && priceMax > priceMin) {
    pricePenalty = ((p.best_price - priceMin) / (priceMax - priceMin)) * 22;
  } else if (p.best_price > 0) {
    pricePenalty = 0;
  }

  // البوابة الحاسمة (التحدي ٤): لو البحث عن نوع رئيسي (جوال/مكيف...) والمنتج ملحق → سحق للقاع.
  // غير ذلك: عقوبة دفن عادية (لا حذف). منتج أساسي حقيقي لا يُمسّ.
  const accessoryPenalty = isAccessory ? (queryIsMainProduct ? 1000 : 60) : 0;
  const acBoost = acSignal ? 10 : 0;

  return inStockBoost + storeBoost + dealBoost + ratingBoost + acBoost - pricePenalty - accessoryPenalty;
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

function buildDecisionLayer(products: GroupedSearchProduct[], queryIsMainProduct: boolean): DecisionLayer {
  const prices = products.map((p) => p.best_price).filter((n) => n > 0);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;

  const ranked = [...products].sort((a, b) => scoreProduct(b, priceMin, priceMax, queryIsMainProduct) - scoreProduct(a, priceMin, priceMax, queryIsMainProduct));
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
    product_id: (p as unknown as { product_id?: string }).product_id || '',
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

// ── تحويل سجل Algolia إلى GroupedSearchProduct (مع تعبئة stores كاملة بالأسعار والمتاجر) ──────
function algoliaHitToGrouped(hit: AlgoliaHit): GroupedSearchProduct | null {
  const validStores = (hit.stores || []).filter((s) => s.current_price != null);
  if (validStores.length === 0) return null;

  const storeEntries: SearchProduct[] = validStores.map((s) => ({
    name_ar: hit.name_ar,
    name_en: hit.name_en,
    brand: hit.brand || '',
    model: '',
    sku: null,
    current_price: Number(s.current_price),
    original_price: s.original_price != null ? Number(s.original_price) : null,
    availability: (s.availability || 'in_stock') as SearchProduct['availability'],
    product_url: s.product_url || '',
    image_urls: hit.image_url ? [hit.image_url] : [],
    specifications: {} as Record<string, unknown>,
    category: '' as ProductCategory,
    description_ar: null,
    description_en: null,
    is_free_delivery: false,
    delivery_time_days: null,
    delivery_cost: 0,
    is_deal: !!(s.original_price && s.current_price && s.original_price > s.current_price),
    coupon_code: s.coupon_code ?? null,
    store: s.store_name || 'unknown',
    store_name: s.store_name || '',
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
    product_id: hit.objectID,
    product_slug: hit.objectID,
  } as unknown as GroupedSearchProduct;
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body: SearchBody = await request.json().catch(() => ({} as SearchBody));
  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const queryIsMainProduct = isMainProductTypeQuery(rawQuery);
  const supabase = createServerClient();

  // أعمدة جدول products الحقيقية فقط: id, name_ar, name_en, brand, category, image_url
  // نقرأ store_name مباشرة من product_stores (الهيكلة الموحّدة) — لا join مع جدول stores
  const selectClause = `
    id, name_ar, name_en, brand, category, image_url,
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

  // ── محاولة Algolia أولاً (بحث ذكي + تسامح إملائي) ──────
  let algoliaProducts: GroupedSearchProduct[] | null = null;
  if (rawQuery && isAlgoliaConfigured()) {
    console.log('[Algolia] search started:', rawQuery);
    try {
      const algoliaRes = await searchAlgolia({
        query: rawQuery,
        brands: body.brands,
        stores: body.stores,
        minPrice: body.min_price,
        maxPrice: body.max_price,
        inStockOnly: body.in_stock_only,
        dealsOnly: body.deals_only,
        hitsPerPage: 100,
      });
      console.log('[Algolia] hits count:', algoliaRes?.hits?.length ?? 'null');
      if (algoliaRes?.hits?.length) {
        const mapped = algoliaRes.hits
          .map(algoliaHitToGrouped)
          .filter((p): p is GroupedSearchProduct => p !== null);
        if (mapped.length > 0) {
          algoliaProducts = mapped;
          console.log('[Algolia] using Algolia results:', mapped.length);
        }
      }
    } catch (e) {
      console.error('[Algolia] error:', e);
    }
    if (!algoliaProducts) console.log('[Algolia] falling back to Supabase');
  }

  if (rawQuery && !algoliaProducts) {
    // مطابقة صارمة (AND): المنتج يجب أن يحقق كل كلمات البحث المعنوية.
    const normalized = normalizeArabic(rawQuery);
    const allWords = normalized.split(/\s+/).filter(Boolean);
    const meaningful = allWords.filter((w) => !STOPWORDS.has(w));
    const words = meaningful.length > 0 ? meaningful : allWords;

    // 1) جلب مجموعة مرشّحين واسعة بـ OR (مضمون يرجّع نتائج)
    let q = supabase.from('products').select(selectClause, { count: 'exact' }).eq('is_active', true);
    const orPool = buildOrPool(words);
    if (orPool) q = q.or(orPool);
    q = applyCommonFilters(q, body);
    q = q.range(0, 1500);
    const { data, error } = await q;
    if (error) { console.error('[search:pool]', error.message); dbError = error.message; }
    let candidateRows = (data ?? []) as unknown as ProductRow[];

    // 2) المطابقة الصارمة (AND) في JS — كل كلمة بحث يجب أن تتطابق
    const wordTermsList = words.map(expandWordTerms).filter((t) => t.length > 0);
    if (wordTermsList.length > 0) {
      candidateRows = candidateRows.filter((row) => productMatchesAllWords(row, wordTermsList));
    }
    rows = candidateRows;
    totalCount = candidateRows.length;
  } else if (!rawQuery) {
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

  let products: GroupedSearchProduct[] = algoliaProducts
    ? algoliaProducts
    : rows
        .map(toGroupedSearchProduct)
        .filter((p): p is GroupedSearchProduct => p !== null);

  products = applyPostFilters(products, body);

  // عند البحث: نرتّب بالنقاط (يرفع الأساسي ويسحق الملحقات). غير البحث: الترتيب الأصلي.
  if (rawQuery) {
    const prices = products.map((p) => p.best_price).filter((n) => n > 0);
    const pMin = prices.length ? Math.min(...prices) : 0;
    const pMax = prices.length ? Math.max(...prices) : 0;
    const requestedSort = body.sort && body.sort !== 'relevance';
    if (requestedSort) products.sort(compareBySort(body.sort!));
    else products.sort((a, b) => scoreProduct(b, pMin, pMax, queryIsMainProduct) - scoreProduct(a, pMin, pMax, queryIsMainProduct));
  } else {
    products.sort(compareBySort(body.sort || 'relevance'));
  }

  const decision = buildDecisionLayer(products, queryIsMainProduct);

  const total = hasPostFilters ? products.length : (algoliaProducts ? products.length : totalCount);
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
    errors: dbError ? { search: dbError } : null,
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
      const fallbackSpecs = extractSpecsFromTitle(product.name_en || product.name_ar || '');
      return Object.entries(body.specs!).every(([key, values]) => {
        if (!values || values.length === 0) return true;
        const value = fallbackSpecs?.[key] ?? '';
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
    brand: row.brand || '',
    model: '',
    sku: null,
    current_price: Number(ps.current_price),
    original_price: ps.original_price !== null && ps.original_price !== undefined ? Number(ps.original_price) : null,
    availability: ps.availability || 'in_stock',
    product_url: ps.product_url,
    image_urls: row.image_url ? [row.image_url] : [],
    specifications: {} as Record<string, unknown>,
    category: (row.category || '') as ProductCategory,
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
    product_slug: row.id,
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

export async function GET() {
  return NextResponse.json({ status: 'ok', engine: 'algolia+db', arabic: true, store: 'inline-name', v: 'v8-algolia' });
}