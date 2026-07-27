import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';
import type { ProductCategory } from '@/lib/database/types';
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';
import { searchAlgolia, isAlgoliaConfigured, type AlgoliaHit } from '@/lib/algolia/search';
import { identityKeyToSlug } from '@/lib/catalog/getProductComparison';
import { isApprovedStore } from '@/lib/retailers/approved-retailers';

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

interface ProductStoreRow {
  id: string;
  store_name: string | null;
  current_price: number;
  original_price: number | null;
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order' | null;
  product_url: string;
  coupon_code: string | null;
  stores?: { name: string | null } | null;
}

interface CanonicalProductRow {
  id: string;
  name_ar: string;
  name_en: string;
  brand: string | null;
  image_url: string | null;
  model_number: string | null;
  tps_identity_key: string | null;
  // compare_url قد لا يكون موجوداً، لذا نجعله optional
  compare_url?: string | null;
  category?: string | null;
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
    store_count: number;
    reason_ar: string;
    is_tps: boolean;
  } | null;
  topMatches: DecisionTopMatch[];
};

import { normalizeArabic } from '@/lib/search/arabic-normalize';

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

const ACCESSORY_HINTS_AR = ['حامل', 'فتحة', 'موجه', 'غطاء', 'كفر', 'ملحق', 'ملحقات', 'حافظة', 'واقي', 'شاحن', 'كيبل', 'سلك', 'لاصقة', 'حماية', 'استاند', 'عدسة', 'ماجسيف', 'جراب', 'سماعه اذن'];
const ACCESSORY_HINTS_EN = ['accessory', 'accessories', 'cover', 'mount', 'holder', 'vent', 'adapter', 'charger', 'cable', 'case', 'remote', 'bracket', 'protector', 'stand', 'sticker', 'skin', 'lens', 'magsafe', 'tempered'];

// Compatibility phrasing is a strong accessory signal: an item described as
// "compatible with" or "for" a phone IS an accessory for that phone, not the
// phone itself. These patterns caught real trust failures in production
// (a phone case surfaced as the top result and "smart pick" for "iphone 15").
const ACCESSORY_COMPAT_AR = /متوافق|مخصص\s+ل|(?:^|\s)ل(?:هاتف|جوال|ايفون|آيفون|سامسونج|جالاكسي)/;
const ACCESSORY_COMPAT_EN = /\bcompatible\b|\bfor\s+(?:iphone|samsung|galaxy|apple|xiaomi|huawei)\b/;

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

// Determine the SINGLE canonical category to search for a query, so we never
// fetch both mobile and AC canonicals indiscriminately. Accessory queries get
// no TPS canonical (a Smart Pick must not surface for an accessory search).
// Clearly-AC queries → air_conditioner. Everything else → mobile (preserves all
// existing mobile behavior; non-matching queries simply return []).
const AC_QUERY_WORDS = new Set(['مكيف', 'مكيفات', 'سبليت', 'شباك', 'كاسيت', 'دولابي', 'ac']);
function detectCanonicalCategory(raw: string): 'mobile' | 'air_conditioner' | null {
  const norm = normalizeArabic(raw).toLowerCase();
  const words = norm.split(/\s+/).filter(Boolean);
  if (
    ACCESSORY_HINTS_AR.some((h) => norm.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => norm.includes(h)) ||
    ACCESSORY_COMPAT_AR.test(norm) || ACCESSORY_COMPAT_EN.test(norm)
  ) return null;
  const isAC = words.some((w) => AC_QUERY_WORDS.has(w)) || /split\s*ac|air\s*condition/.test(norm);
  if (isAC) return 'air_conditioner';
  return 'mobile';
}

function hasAccessoryHint(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr);
  const en = (nameEn || '').toLowerCase();
  return ACCESSORY_HINTS_AR.some((h) => ar.includes(normalizeArabic(h))) ||
    ACCESSORY_HINTS_EN.some((h) => en.includes(h)) ||
    ACCESSORY_COMPAT_AR.test(ar) ||
    ACCESSORY_COMPAT_EN.test(en);
}

function hasACSignal(nameAr: string, nameEn: string): boolean {
  const ar = normalizeArabic(nameAr);
  const en = (nameEn || '').toLowerCase();
  const arHit = /(^|\s)مكيف|سبليت|شباك/.test(ar);
  const enHit = /\bsplit\b/.test(en) || /\bair\s*condition/.test(en) || /\ba\/?c\b/.test(en);
  return arHit || enHit;
}

const STOPWORDS = new Set<string>([
  'افضل', 'احسن', 'ارخص', 'اغلى', 'رخيص', 'غالي', 'الافضل', 'الارخص',
  'جديد', 'الجديد', 'قديم', 'عرض', 'عروض', 'سعر', 'اسعار', 'الاسعار',
  'بكم', 'كم', 'في', 'من', 'على', 'مع', 'الى', 'او', 'و', 'ابي', 'ابغى', 'اريد', 'ودي',
  'best', 'cheapest', 'cheap', 'price', 'prices', 'new', 'offer', 'offers', 'deal', 'deals',
  'the', 'a', 'an', 'in', 'of', 'for', 'with', 'and', 'or', 'want',
]);

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

function buildOrPool(words: string[]): string {
  const parts: string[] = [];
  for (const word of words) {
    const clean = word.replace(/[(),]/g, ' ').trim();
    if (!clean) continue;
    // The query words are fully normalized (ة→ه, ى→ي), but the catalogue usually keeps ة/ى, so an
    // ilike on the folded form misses them (e.g. query "ثلاجه" vs catalogue "ثلاجة"). Also match the
    // un-folded trailing variants so real products are actually fetched as candidates.
    const variants = new Set([clean, clean.replace(/ه$/, 'ة'), clean.replace(/ي$/, 'ى')]);
    for (const v of variants) {
      if (v) parts.push(`name_ar.ilike.%${v}%`);
    }
    parts.push(`name_en.ilike.%${clean}%`, `brand.ilike.%${clean}%`);
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
  const accessoryPenalty = isAccessory ? (queryIsMainProduct ? 1000 : 60) : 0;
  const acBoost = acSignal ? 10 : 0;
  const tpsBonus = (p.has_tps_comparison || !!p.tps_compare_url) ? 5 : 0;
  return inStockBoost + storeBoost + dealBoost + ratingBoost + acBoost + tpsBonus - pricePenalty - accessoryPenalty;
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

  // Trust gate: never present an accessory as the "smart pick" for a
  // main-product query (Constitution: truth before convenience; a phone case
  // is not a defensible answer to "iphone 15"). When the best available match
  // is an accessory for a product search, we show no smart-pick card rather
  // than a misleading one — the ranked results still render below it.
  const bestIsAccessory = best ? hasAccessoryHint(best.name_ar || '', best.name_en || '') : false;
  const trustworthyPick = !!best && best.best_price > 0 && !(queryIsMainProduct && bestIsAccessory);

  const decisionCard = trustworthyPick && best
    ? {
        title: best.name_ar,
        best_price: best.best_price,
        store_name: best.stores.find((s) => s.current_price === best.best_price)?.store_name || best.stores[0]?.store_name || '',
        product_url: best.stores.find((s) => s.current_price === best.best_price)?.product_url || best.stores[0]?.product_url || '',
        store_count: best.store_count,
        reason_ar: buildReasonAr(best, best.best_price === priceMin && priceMin > 0),
        is_tps: !!(best.has_tps_comparison || best.tps_compare_url),
      }
    : null;
  const topMatches: DecisionTopMatch[] = top3.map((p) => ({
    product_id: p.product_id || '',
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

function algoliaHitToGrouped(hit: AlgoliaHit): GroupedSearchProduct | null {
  // Approved-27 scope gate: only surface offers from approved retailers (Founder Directive 2026-07-27).
  const validStores = (hit.stores || []).filter((s) => s.current_price != null && isApprovedStore(s.store_name));
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
  } as GroupedSearchProduct;
}

// ── Deduplication ─────────────────────────────────────────────
function deduplicateProducts(products: GroupedSearchProduct[]): GroupedSearchProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const key = p.tps_identity_key || p.product_id || normalizeArabic(p.name_ar || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
// ─────────────────────────────────────────────────────────────

// ── TPS Enrichment (Type-safe) ────────────────────
const MODEL_CODE_REGEX = /\b([A-Z]{2}\d{2}[A-Z0-9]{4,}(?:\/[A-Z0-9]+)?)\b/g;

async function enrichWithTPS(
  products: GroupedSearchProduct[],
  supabase: ReturnType<typeof createServerClient>
): Promise<GroupedSearchProduct[]> {
  if (!products.length) return products;

  try {
    const productModels = products.map((p, idx) => {
      const text = `${p.name_en || ''} ${p.name_ar || ''}`;
      const codes = [...text.matchAll(MODEL_CODE_REGEX)].map(m => m[1].toUpperCase());
      return { idx, codes };
    });

    const allCodes = [...new Set(productModels.flatMap(p => p.codes))];
    if (!allCodes.length) return products;

    const { data: canonicalRows } = await supabase
      .from('canonical_products')
      .select(`
        id,
        name_ar,
        name_en,
        brand,
        image_url,
        model_number,
        tps_identity_key
      `)
      .in('model_number', allCodes)
      .eq('is_active', true);

    if (!canonicalRows?.length) return products;

    const canonicalMap = new Map<string, CanonicalProductRow>();
    for (const row of canonicalRows) {
      if (row.model_number) {
        canonicalMap.set(row.model_number.toUpperCase(), row as CanonicalProductRow);
      }
    }

    return products.map((p, idx) => {
      let enriched = { ...p };

      for (const code of productModels[idx].codes) {
        const canonical = canonicalMap.get(code);
        if (canonical) {
          const slug = identityKeyToSlug(canonical.tps_identity_key || '');
          // Link the identity for dedup, but DON'T claim a comparison here — a model-code match
          // doesn't prove >=2 live store offers. Verified compare CTAs come only from
          // searchTPSCanonical (gated on >=2 distinct stores). Prevents false "قارن الأسعار" CTAs.
          enriched = {
            ...enriched,
            tps_identity_key: canonical.tps_identity_key,
            product_id: enriched.product_id || canonical.id,
          } as GroupedSearchProduct;
          break;
        }
      }
      return enriched;
    });
  } catch (err) {
    console.error('[TPS Enrichment] failed:', err);
    return products;
  }
}
// ─────────────────────────────────────────────────────────────

// ── TPS Canonical Search ──────────────────────────────────────
async function searchTPSCanonical(
  words: string[],
  supabase: ReturnType<typeof createServerClient>,
  category: 'mobile' | 'air_conditioner',
): Promise<GroupedSearchProduct[]> {
  try {
    if (!words.length) return [];
    // canonical plane is 'mobile'/'air_conditioner'; UI plane maps mobile→smartphone.
    const uiCategory: ProductCategory = category === 'mobile' ? 'smartphone' : (category as ProductCategory);
    const { data: prods } = await supabase
      .from('canonical_products')
      .select('id, name_ar, name_en, brand, image_url, tps_identity_key, model_number')
      .eq('category', category)
      .eq('is_active', true);

    if (!prods?.length) return [];

    const wordTermsList = words.map(expandWordTerms).filter((t) => t.length > 0);
    const matched = prods.filter((p) => {
      const hay = (normalizeArabic(p.name_ar || '') + ' ' + normalizeArabic(p.name_en || '') + ' ' + normalizeArabic(p.brand || '')).toLowerCase();
      return wordTermsList.every((terms) => terms.some((t) => hay.includes(t)));
    });
    if (!matched.length) return [];

    const ids = matched.map((p) => p.id);
    const { data: prices } = await supabase
      .from('price_history')
      .select('canonical_product_id, store_name, price, observed_at, tps_observation_id')
      .in('canonical_product_id', ids)
      .order('observed_at', { ascending: false });

    const latest = new Map<string, Map<string, { price: number; obsId: string }>>();
    for (const r of prices ?? []) {
      // Approved-27 scope gate: skip observations from non-approved retailers (e.g. najm, alnakheel).
      if (!isApprovedStore(r.store_name)) continue;
      if (!latest.has(r.canonical_product_id)) latest.set(r.canonical_product_id, new Map());
      const m = latest.get(r.canonical_product_id)!;
      if (!m.has(r.store_name)) m.set(r.store_name, { price: Number(r.price), obsId: r.tps_observation_id });
    }

    const out: GroupedSearchProduct[] = [];
    for (const p of matched) {
      const byStore = latest.get(p.id);
      if (!byStore || byStore.size === 0) continue;
      const slug = identityKeyToSlug(p.tps_identity_key ?? '');
      const storeEntries: SearchProduct[] = [...byStore.entries()].map(([storeName, v]) => ({
        name_ar: p.name_ar, 
        name_en: p.name_en || '', 
        brand: p.brand || '', 
        model: '', 
        sku: null,
        current_price: v.price, 
        original_price: null,
        availability: 'in_stock' as const,
        product_url: `/go/${v.obsId}`,
        image_urls: p.image_url ? [p.image_url] : [],
        specifications: {} as Record<string, unknown>,
        category: uiCategory,
        description_ar: null, 
        description_en: null,
        is_free_delivery: false, 
        delivery_time_days: null, 
        delivery_cost: 0,
        is_deal: false, 
        coupon_code: null,
        store: storeName, 
        store_name: storeName,
        rating: null, 
        review_count: null,
      }));
      const ps2 = storeEntries.map((e) => e.current_price).filter((n) => n > 0);
      const bestPrice = ps2.length ? Math.min(...ps2) : 0;
      const rep = storeEntries[0];
      out.push({
        ...rep,
        current_price: bestPrice,
        stores: storeEntries,
        best_price: bestPrice,
        store_count: byStore.size,
        product_id: p.id,
        product_slug: slug,
        // Only claim a price COMPARISON when the product genuinely has >=2 distinct store offers.
        // Single-store products get no compare CTA (the UI shows an honest single-store action instead).
        tps_compare_url: byStore.size >= 2 ? `/ar/compare/${encodeURIComponent(p.tps_identity_key || '')}` : null,
        tps_identity_key: p.tps_identity_key,
        has_tps_comparison: byStore.size >= 2,
      } as GroupedSearchProduct);
    }
    return out;
  } catch (e) {
    console.error('[TPS Search] failed:', e);
    return [];
  }
}
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body: SearchBody = await request.json().catch(() => ({} as SearchBody));
  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const queryIsMainProduct = isMainProductTypeQuery(rawQuery);
  const supabase = createServerClient();

  const selectClause = `
    id, name_ar, name_en, brand, category, image_url,
    product_stores!inner (
      id, store_name, current_price, original_price, availability, product_url, coupon_code,
      stores ( name )
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
  let relaxedResults = false; // true when we fell back to nearby/related products (no exact all-words match)

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
    const normalized = normalizeArabic(rawQuery);
    const allWords = normalized.split(/\s+/).filter(Boolean);
    const meaningful = allWords.filter((w) => !STOPWORDS.has(w));
    const words = meaningful.length > 0 ? meaningful : allWords;
    let q = supabase.from('products').select(selectClause, { count: 'exact' }).eq('is_active', true);
    const orPool = buildOrPool(words);
    if (orPool) q = q.or(orPool);
    q = applyCommonFilters(q, body);
    q = q.range(0, 1500);
    const { data, error } = await q;
    if (error) { console.error('[search:pool]', error.message); dbError = error.message; }
    const orCandidates = (data ?? []) as ProductRow[];
    const wordTermsList = words.map(expandWordTerms).filter((t) => t.length > 0);
    let candidateRows = orCandidates;
    if (wordTermsList.length > 0) {
      const strict = orCandidates.filter((row) => productMatchesAllWords(row, wordTermsList));
      if (strict.length > 0) {
        candidateRows = strict;
      } else if (wordTermsList.length > 1) {
        // No product matches ALL words (e.g. "ثلاجة صغيرة", "مكيف لغرفة 30 متر"). Rather than a silent
        // zero, surface the closest products — those matching the MOST query words — flagged as related.
        const scored = orCandidates
          .map((row) => ({ row, hits: wordTermsList.filter((terms) => productMatchesAllWords(row, [terms])).length }))
          .filter((x) => x.hits > 0);
        const maxHits = scored.reduce((m, x) => Math.max(m, x.hits), 0);
        candidateRows = scored.filter((x) => x.hits === maxHits).map((x) => x.row);
        relaxedResults = candidateRows.length > 0;
      } else {
        candidateRows = [];
      }
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
    rows = (data ?? []) as ProductRow[];
    totalCount = count ?? rows.length;
  }

  let products: GroupedSearchProduct[] = algoliaProducts
    ? algoliaProducts
    : rows
        .map(toGroupedSearchProduct)
        .filter((p): p is GroupedSearchProduct => p !== null);

  // TPS Canonical Search — one category per query, derived from the query.
  const tpsCategory = rawQuery ? detectCanonicalCategory(rawQuery) : null;
  if (rawQuery && tpsCategory) {
    const nq = normalizeArabic(rawQuery);
    const aw = nq.split(/\s+/).filter(Boolean);
    const mw = aw.filter((w) => !STOPWORDS.has(w));
    const tpsProducts = await searchTPSCanonical(mw.length ? mw : aw, supabase, tpsCategory);
    if (tpsProducts.length) {
      products = [...tpsProducts, ...products];
      console.log('[TPS Search] injected:', tpsProducts.length, '(', tpsCategory, ')');
    }
  }

  // Deduplication after TPS merge
  products = deduplicateProducts(products);

  products = applyPostFilters(products, body);

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

  // ✅ تم تصحيح حساب total بعد دمج TPS
  const total = rawQuery
    ? products.length
    : hasPostFilters
    ? products.length
    : totalCount;

  const pageProducts = hasPostFilters
    ? products.slice(offsetStart, offsetEnd + 1)
    : products.slice(0, currentPageSize);

  // TPS Enrichment
  const enrichedProducts = await enrichWithTPS(pageProducts, supabase);

  const prices = enrichedProducts.map((p) => p.best_price).filter((n) => n > 0);
  const result: ScrapedSearchResult & {
    total: number;
    page: number;
    pageSize: number;
    decisionCard: DecisionLayer['decisionCard'];
    topMatches: DecisionTopMatch[];
    relaxed: boolean;
  } = {
    products:          enrichedProducts,
    count:             enrichedProducts.length,
    total,
    relaxed:           relaxedResults,
    page:              currentPage,
    pageSize:          currentPageSize,
    query:             rawQuery,
    storeResults:      computeStoreResults(enrichedProducts),
    priceStats: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    },
    searchTime:        (Date.now() - started) / 1000,
    errors:            dbError ? { search: dbError } : null,
    totalStores:       computeUniqueStores(enrichedProducts),
    successfulStores:  computeUniqueStores(enrichedProducts),
    decisionCard:      decision.decisionCard,
    topMatches:        decision.topMatches,
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
  // Approved-27 scope gate: drop offers from non-approved retailers (e.g. shaker, samsung_ksa).
  const productStores = (row.product_stores || []).filter(
    (ps) => ps && ps.current_price != null && isApprovedStore(ps.store_name || ps.stores?.name),
  );
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
    store: ps.store_name || ps.stores?.name || 'unknown',
    store_name: ps.store_name || ps.stores?.name || '',
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
  } as GroupedSearchProduct;
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
  // الإكسسوارات تنزل لذيل النتائج دائماً — حتى مع الفرز السعري
  // (يمنع كفر بـ119 ريال من تصدّر بحث "ايفون 17" ولبس شارة أفضل سعر)
  const acc = (p: GroupedSearchProduct) =>
    hasAccessoryHint(p.name_ar || '', p.name_en || '') ? 1 : 0;

  if (sort === 'price_asc' || sort === 'price_low')
    return (a, b) => acc(a) - acc(b) || a.best_price - b.best_price;
  if (sort === 'price_desc' || sort === 'price_high')
    return (a, b) => acc(a) - acc(b) || b.best_price - a.best_price;
  return (a, b) => {
    if (acc(a) !== acc(b)) return acc(a) - acc(b);
    if (b.store_count !== a.store_count) return b.store_count - a.store_count;
    return a.best_price - b.best_price;
  };
}

export async function GET() {
  return NextResponse.json({ status: 'ok', engine: 'algolia+db', arabic: true, store: 'inline-name', v: 'v9-algolia-tps-canonical' });
}