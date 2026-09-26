'use client';

import React, { useEffect, useState } from 'react';
import { recordFirstPartyInteraction } from '@/lib/analytics/interaction';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';

import {
  X,
  AlertCircle,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { PICK_FRESHNESS_MAX_HOURS } from '@/lib/intelligence/evidence-engine';
import { partitionEligible, summarizeEligiblePrices, distinctStoreCount, type ExclusionReason } from '@/lib/compare/offer-eligibility';
import { observedLabel, availabilityLabelFor, exclusionLabelFor } from '@/lib/compare/observed-label';
import { identitySpecRows, mergeIdentitySpecTable } from '@/lib/compare/identity-specs';
import { brandDisplayName } from '@/lib/compare/brand-display';

interface StoreInfo {
  id: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  website_url: string;
  delivery_info_ar: string | null;
  delivery_info_en: string | null;
  return_policy_ar: string | null;
  return_policy_en: string | null;
  warranty_info_ar: string | null;
  warranty_info_en: string | null;
}

export interface ProductStore {
  id: string;
  current_price: number;
  original_price: number | null;
  availability: AvailabilityStatus;
  delivery_time_days: number | null;
  delivery_cost: number | null;
  is_free_delivery: boolean | null;
  product_url: string | null;
  affiliate_url: string | null;
  // QUALITY PROGRAM P1 §19.2 item 2 (2026-08-28): threaded through so the "best price"
  // crown can be freshness-gated — same storefront-layer gap §17.1/§19.1 already fixed
  // on the main search grid and the store-comparison panel, different call site (this
  // separate localStorage-backed multi-product compare TOOL, distinct from
  // /compare/[key] which §12 already fixed).
  observed_at?: string | null;
  /** ADR-388: the knowledge layer records some offers with NO availability statement (e.g.
   *  Extra's current row). The shared eligibility rule treats "not stated" as not-out-of-stock
   *  (exactly as /compare/[key] does), so `availability` holds the eligible value while this
   *  flag keeps the label honest («التوفر غير مذكور عند آخر رصد»), never «متوفر». */
  availability_unstated?: boolean;
  stores: StoreInfo | null;
}

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  category: ProductCategory;
  brand: string;
  model: string;
  image_urls: string[] | null;
  specifications: Record<string, unknown> | null;
  product_stores: ProductStore[];
  /** ADR-388: the knowledge layer's structured identity (a search-originated item carries
   *  it in the cache). Read for identity-derived specification rows — never displayed raw. */
  tps_identity_key?: string | null;
  /** ADR-389: outcome of the knowledge-layer refresh for a tray item.
   *  'ok' = current offers replaced the snapshot (possibly with none);
   *  'gone' = the identity no longer resolves (404) — no current offers are shown;
   *  'failed' = network/server failure — the saved snapshot is shown, with its ORIGINAL
   *  observation times, and eligibility is re-evaluated against now. */
  refresh_status?: 'ok' | 'failed' | 'gone';
}

/**
 * ADR-388 — everything the page states about ONE product's offers, computed once from the
 * SAME eligibility rule /compare/[key] uses (offer-eligibility.ts). Exported for tests.
 *   • eligible / excluded-with-reason (in stock, positive price, observed ≤ 7 days)
 *   • best = the cheapest ELIGIBLE offer; when none is eligible, the cheapest known offer is
 *     still shown, labelled as a last-observed price and never crowned
 *   • eligibleStoreCount = DISTINCT eligible retailers (never offer rows)
 *   • spread = highest − lowest among ELIGIBLE prices only (null below two)
 * Legacy rows with no timestamp anywhere on the product keep the pre-existing behaviour
 * (availability alone decides) — the moment any offer carries a timestamp, an undated one
 * is excluded as `unknown_age` rather than out-competing a dated one.
 */
export interface ProductOfferFacts {
  sorted: ProductStore[];
  eligible: ProductStore[];
  excluded: Array<{ item: ProductStore; reason: ExclusionReason }>;
  best: ProductStore | null;
  bestIsEligible: boolean;
  eligibleStoreCount: number;
  excludedStoreCount: number;
  lowest: number | null;
  highest: number | null;
  spread: number | null;
  /** true when no offer of this product carries any observation time (legacy rows). */
  freshnessUnknown: boolean;
}

export function deriveProductOfferFacts(stores: readonly ProductStore[], nowMs: number = Date.now()): ProductOfferFacts {
  const sorted = [...stores].filter((s) => s.current_price > 0).sort((a, b) => a.current_price - b.current_price);
  const freshnessUnknown = !sorted.some((s) => s.observed_at != null);
  const { eligible, excluded } = partitionEligible(
    sorted,
    (s) => ({ price: s.current_price, availability: s.availability, observed_at: s.observed_at }),
    nowMs,
    { unknownAgeIsEligible: freshnessUnknown },
  );
  const inStock = sorted.filter((s) => s.availability !== 'out_of_stock');
  const best = eligible[0] ?? inStock[0] ?? sorted[0] ?? null;
  const storeKey = (s: ProductStore) => s.stores?.id ?? s.id;
  const { lowest, highest, spread } = summarizeEligiblePrices(eligible.map((s) => s.current_price));
  return {
    sorted,
    eligible,
    excluded,
    best,
    bestIsEligible: best != null && eligible.includes(best),
    eligibleStoreCount: distinctStoreCount(eligible, storeKey),
    excludedStoreCount: distinctStoreCount(excluded.map((e) => e.item), storeKey),
    lowest,
    highest,
    spread,
    freshnessUnknown,
  };
}

const MAX_COMPARE_PRODUCTS = 4;
const COMPARE_STORAGE_KEY = 'compare_products';
const COMPARE_CACHE_STORAGE_KEY = 'compare_products_cache';
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STORE_POLICIES: Record<string, {
  delivery_ar: string; delivery_en: string;
  warranty_ar: string; warranty_en: string;
  return_ar: string; return_en: string;
}> = {
  amazon: {
    delivery_ar: '١-٥ أيام عمل',
    delivery_en: '1-5 business days',
    warranty_ar: 'ضمان الشركة المصنعة',
    warranty_en: 'Manufacturer warranty',
    return_ar: 'إرجاع خلال ١٥ يوم',
    return_en: '15-day returns',
  },
  noon: {
    delivery_ar: '١-٣ أيام (نون إكسبريس)',
    delivery_en: '1-3 days (Noon Express)',
    warranty_ar: 'ضمان الشركة المصنعة',
    warranty_en: 'Manufacturer warranty',
    return_ar: 'إرجاع خلال ١٥ يوم',
    return_en: '15-day returns',
  },
  jarir: {
    delivery_ar: '٢-٥ أيام عمل',
    delivery_en: '2-5 business days',
    warranty_ar: 'ضمان الشركة المصنعة',
    warranty_en: 'Manufacturer warranty',
    return_ar: 'إرجاع خلال ٧ أيام',
    return_en: '7-day returns',
  },
  extra: {
    delivery_ar: '٢-٥ أيام عمل',
    delivery_en: '2-5 business days',
    warranty_ar: 'ضمان الشركة المصنعة',
    warranty_en: 'Manufacturer warranty',
    return_ar: 'إرجاع خلال ٧ أيام',
    return_en: '7-day returns',
  },
  almanea: {
    delivery_ar: '٣-٧ أيام عمل',
    delivery_en: '3-7 business days',
    warranty_ar: 'ضمان الشركة المصنعة',
    warranty_en: 'Manufacturer warranty',
    return_ar: 'إرجاع خلال ٧ أيام',
    return_en: '7-day returns',
  },
};

const EXTENDED_COMPARE_SELECT = `
  id,
  name_ar,
  name_en,
  slug,
  category,
  brand,
  model,
  image_urls,
  specifications,
  product_stores(
    id,
    current_price,
    original_price,
    availability,
    delivery_time_days,
    delivery_cost,
    is_free_delivery,
    product_url,
    last_checked_at,
    last_seen_at,
    stores(
      id,
      name_ar,
      name_en,
      logo_url,
      website_url,
      delivery_info_ar,
      delivery_info_en,
      return_policy_ar,
      return_policy_en,
      warranty_info_ar,
      warranty_info_en
    )
  )
`;

const FALLBACK_COMPARE_SELECT = `
  id,
  name_ar,
  name_en,
  slug,
  category,
  brand,
  model,
  image_urls,
  specifications,
  product_stores(
    id,
    current_price,
    original_price,
    availability,
    last_checked_at,
    last_seen_at,
    stores(
      id,
      name_ar,
      name_en,
      logo_url
    )
  )
`;

interface CompareQueryError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

interface StoreRecord {
  id: string;
  name_ar: string;
  name_en: string;
  logo_url?: string | null;
  website_url?: string;
  delivery_info_ar?: string | null;
  delivery_info_en?: string | null;
  return_policy_ar?: string | null;
  return_policy_en?: string | null;
  warranty_info_ar?: string | null;
  warranty_info_en?: string | null;
}

interface ProductStoreRecord {
  id: string;
  current_price: number;
  original_price: number | null;
  availability: AvailabilityStatus;
  delivery_time_days?: number | null;
  delivery_cost?: number | null;
  is_free_delivery?: boolean | null;
  product_url?: string | null;
  affiliate_url?: string | null;
  last_checked_at?: string | null;
  last_seen_at?: string | null;
  stores?: StoreRecord | StoreRecord[] | null;
}

interface ProductRecord {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  category: ProductCategory;
  brand: string;
  model: string;
  image_urls: string[] | null;
  specifications: Record<string, unknown> | null;
  product_stores?: ProductStoreRecord[] | null;
  tps_identity_key?: string | null;
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isCompareQueryError(error: unknown): error is CompareQueryError {
  return typeof error === 'object' && error !== null;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (isCompareQueryError(error) && typeof error.message === 'string' && error.message) {
    return error.message;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') {
      return serialized;
    }
  } catch {
    // ignore serialization errors and use fallback
  }

  return fallbackMessage;
}

function normalizeStoreRecord(store: StoreRecord | StoreRecord[] | null | undefined): StoreInfo | null {
  const storeRecord = Array.isArray(store) ? store[0] : store;
  if (!storeRecord || !storeRecord.id) {
    return null;
  }

  return {
    id: storeRecord.id,
    name_ar: storeRecord.name_ar,
    name_en: storeRecord.name_en,
    logo_url: storeRecord.logo_url ?? null,
    website_url: storeRecord.website_url || '',
    delivery_info_ar: storeRecord.delivery_info_ar ?? null,
    delivery_info_en: storeRecord.delivery_info_en ?? null,
    return_policy_ar: storeRecord.return_policy_ar ?? null,
    return_policy_en: storeRecord.return_policy_en ?? null,
    warranty_info_ar: storeRecord.warranty_info_ar ?? null,
    warranty_info_en: storeRecord.warranty_info_en ?? null,
  };
}

function normalizeAvailability(availability: unknown): AvailabilityStatus {
  if (availability === 'in_stock' || availability === 'limited_stock' || availability === 'pre_order') {
    return availability;
  }
  return 'out_of_stock';
}

/**
 * QUALITY PROGRAM P1 §19.2 item 2 (2026-08-28): the "best price" crown for a compared
 * product used to be the raw cheapest in-stock offer (falling back to the raw cheapest
 * overall if nothing is in stock) with no freshness check at all — the storefront-layer
 * twin of the gap §17.1/§19.1 already fixed on the main search grid and the
 * store-comparison panel. Mirrors `selectBestPriceStore()` (product-card.tsx) — same
 * `isFreshObservation()` gate, same backward-compatible design (a store/product with no
 * `observed_at` at all behaves exactly as before) — reimplemented locally rather than
 * imported because this page's `ProductStore` type is its own (a nullable `stores` field
 * product-card.tsx's shape does not allow), not because the selection logic differs.
 * `sortedStores` is `getStoresByPrice(product)`'s own output (price-sorted, current_price
 * > 0) — this function only changes WHICH tier of that list wins, never re-sorts or
 * re-filters it, so the original availability-fallback tiering is preserved exactly:
 * fresh in-stock > stale in-stock > any in-stock > cheapest overall (only when NOTHING
 * is in stock, unchanged from before this fix).
 */
export function selectBestPriceStore(sortedStores: ProductStore[]): ProductStore | null {
  // ADR-388: delegates to the shared eligibility rule so the crown, the store count and the
  // spread on this page can never disagree with each other or with /compare/[key].
  return deriveProductOfferFacts(sortedStores).best;
}

function normalizeProductStore(store: ProductStoreRecord): ProductStore {
  return {
    id: store.id,
    current_price: typeof store.current_price === 'number' ? store.current_price : 0,
    original_price: typeof store.original_price === 'number' ? store.original_price : null,
    availability: normalizeAvailability(store.availability),
    delivery_time_days: typeof store.delivery_time_days === 'number' ? store.delivery_time_days : null,
    delivery_cost: typeof store.delivery_cost === 'number' ? store.delivery_cost : null,
    is_free_delivery: typeof store.is_free_delivery === 'boolean' ? store.is_free_delivery : null,
    product_url: store.product_url ?? null,
    affiliate_url: store.affiliate_url ?? null,
    // last_checked_at is "when we last looked" (the ADR-194 observation-time signal);
    // last_seen_at as a fallback when a store's checked/seen columns diverge. Flows
    // through the localStorage cache path too (parseCachedCompareProducts also calls
    // this function), so a cached comparison carries the same freshness signal as a
    // fresh fetch.
    // ADR-387: a search-card entry cached into the tray already carries the TPS observation
    // time as `observed_at` (product-adapter.ts) — it was dropped here, so a 12-day-old Amazon
    // row won "best store" on /compare while the same product's compare page excluded it.
    observed_at: (store as { observed_at?: string | null }).observed_at ?? store.last_checked_at ?? store.last_seen_at ?? null,
    stores: normalizeStoreRecord(store.stores),
  };
}

function normalizeProductRecord(product: ProductRecord): Product {
  return {
    id: product.id,
    name_ar: product.name_ar,
    name_en: product.name_en,
    slug: product.slug,
    category: product.category,
    brand: product.brand,
    model: product.model,
    image_urls: product.image_urls || null,
    specifications: product.specifications || null,
    product_stores: (product.product_stores || []).map(normalizeProductStore),
    tps_identity_key: typeof product.tps_identity_key === 'string' ? product.tps_identity_key : null,
  };
}

function parseCachedCompareProducts(rawValue: string | null): Record<string, Product> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, ProductRecord>;
    return Object.entries(parsed).reduce<Record<string, Product>>((acc, [id, product]) => {
      if (!product || typeof product !== 'object') {
        return acc;
      }

      const normalized = normalizeProductRecord({
        ...product,
        id: product.id || id,
        image_urls: Array.isArray(product.image_urls) ? product.image_urls : null,
        specifications:
          product.specifications && typeof product.specifications === 'object'
            ? product.specifications
            : null,
        product_stores: Array.isArray(product.product_stores) ? product.product_stores : [],
      });

      acc[id] = normalized;
      return acc;
    }, {});
  } catch (err) {
    console.warn('[Compare] Failed to parse cached compare products:', err);
    return {};
  }
}

function writeCompareCache(cacheById: Record<string, Product>, orderedIds: string[]): void {
  const nextCache = orderedIds.reduce<Record<string, Product>>((acc, id) => {
    const product = cacheById[id];
    if (product) {
      acc[id] = product;
    }
    return acc;
  }, {});
  localStorage.setItem(COMPARE_CACHE_STORAGE_KEY, JSON.stringify(nextCache));
}

function getStoreSlug(store: StoreInfo | null): string | null {
  if (!store) return null;
  const nameEn = store.name_en.toLowerCase();
  if (nameEn.includes('amazon')) return 'amazon';
  if (nameEn.includes('noon')) return 'noon';
  if (nameEn.includes('jarir')) return 'jarir';
  if (nameEn.includes('extra')) return 'extra';
  if (nameEn.includes('almanea') || nameEn.includes('منيع')) return 'almanea';
  // For scraped products, store.id is the slug itself
  if (STORE_POLICIES[store.id]) return store.id;
  return null;
}

/**
 * ADR-388 — a search-originated item in the tray is a SNAPSHOT of the moment it was added
 * (prices, availability, observation times frozen in localStorage). The founder's rule: the
 * cache is not the authority — the saved identifier is, and current data is restored from it.
 * For an item that carries a TPS identity key, the knowledge layer's own comparison (the same
 * `getComparison` derivation /compare/[key] renders, via the public `/api/compare` route) is
 * fetched client-side and its offers REPLACE the cached ones. On any failure the snapshot is
 * kept as-is (it still carries its own observation times, so the eligibility rule still
 * applies) — never a blank column, never a fabricated offer. Exported for tests.
 */
export interface KnowledgeLayerOffer {
  store_slug: string;
  store_name: string;
  price: number;
  availability: string | null;
  product_url: string | null;
  observed_at: string;
}
export interface KnowledgeLayerComparison {
  canonical?: { name_ar?: string | null; name_en?: string | null; image_url?: string | null; brand?: string | null } | null;
  offers?: KnowledgeLayerOffer[] | null;
}

export function applyKnowledgeLayerComparison(product: Product, comparison: KnowledgeLayerComparison | null | undefined): Product {
  // ADR-389: a well-formed response is authoritative even when it lists NO offers — an offer
  // the knowledge layer no longer holds must not be resurrected from the snapshot. Only a
  // malformed/absent response leaves the snapshot in place (status 'failed').
  if (!comparison || !Array.isArray(comparison.offers)) return { ...product, refresh_status: 'failed' };
  const offers = comparison.offers.filter((o) => o && typeof o.price === 'number' && o.price > 0 && o.store_slug);
  const product_stores: ProductStore[] = offers.map((o) => ({
    id: `tps-${o.store_slug}`,
    current_price: o.price,
    original_price: null,
    // null = the merchant page stated nothing — NOT out of stock (the shared rule and
    // /compare/[key] agree); `normalizeAvailability(null)` would have said out_of_stock and
    // wrongly excluded the offer (live: Extra dropped from ArtCool/FreshDV, spread 30 vs 400).
    availability: o.availability == null ? 'in_stock' : normalizeAvailability(o.availability),
    availability_unstated: o.availability == null,
    delivery_time_days: null,
    delivery_cost: null,
    is_free_delivery: null,
    product_url: o.product_url ?? null,
    affiliate_url: o.product_url ?? null,
    observed_at: o.observed_at ?? null,
    stores: {
      id: o.store_slug,
      name_ar: o.store_name || o.store_slug,
      name_en: o.store_name || o.store_slug,
      logo_url: null,
      website_url: '',
      delivery_info_ar: null,
      delivery_info_en: null,
      return_policy_ar: null,
      return_policy_en: null,
      warranty_info_ar: null,
      warranty_info_en: null,
    },
  }));
  const c = comparison?.canonical ?? null;
  return {
    ...product,
    name_ar: c?.name_ar || product.name_ar,
    name_en: c?.name_en || product.name_en,
    brand: product.brand || c?.brand || '',
    image_urls: product.image_urls && product.image_urls.length > 0 ? product.image_urls : c?.image_url ? [c.image_url] : product.image_urls,
    product_stores,
    refresh_status: 'ok',
  };
}

/** Availability wording for one offer row — «التوفر غير مذكور عند آخر رصد» when the merchant
 *  page stated nothing, otherwise the shared label. Exported for tests. */
export function storeAvailabilityLabel(s: ProductStore, stale: boolean, isAr: boolean): { text: string; tone: 'ok' | 'muted' | 'bad' } | null {
  // ADR-389: the shared label owns all three states (in stock / out of stock / not stated).
  return availabilityLabelFor(s.availability_unstated ? null : s.availability, stale, isAr);
}

/**
 * ADR-389 — failure semantics, stated: a NETWORK/SERVER failure (thrown fetch, 5xx, 429)
 * keeps the saved snapshot with its original observation times (`refresh_status: 'failed'`,
 * disclosed on the page); a 404 means the identity no longer resolves — no current offers
 * (`'gone'`); a 200 is applied as-is, empty offers included. Reading localStorage never
 * becomes an observation time. Exported for tests (injectable fetch).
 */
export async function refreshFromKnowledgeLayer(
  items: Product[],
  locale: string,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<Product[]> {
  return Promise.all(items.map(async (p) => {
    if (!p.tps_identity_key) return p;
    try {
      const res = await fetchImpl(`/api/compare?key=${encodeURIComponent(p.tps_identity_key)}&locale=${locale === 'en' ? 'en' : 'ar'}`, { headers: { accept: 'application/json' } });
      if (res.status === 404) return { ...p, product_stores: [], refresh_status: 'gone' };
      if (!res.ok) return { ...p, refresh_status: 'failed' };
      const json = (await res.json()) as KnowledgeLayerComparison;
      return applyKnowledgeLayerComparison(p, json);
    } catch {
      return { ...p, refresh_status: 'failed' };
    }
  }));
}

export default function ComparePage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();

  const [productIds, setProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // ADR-389: long product names are clamped, and the full name is one tap away.
  const [expandedNames, setExpandedNames] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const stored = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        const ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
        setProductIds(Array.from(new Set(ids)).slice(0, MAX_COMPARE_PRODUCTS));
      } catch (err) {
        console.error('Error parsing stored comparison:', err);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    async function fetchProducts() {
      if (productIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cachedProductsById = parseCachedCompareProducts(localStorage.getItem(COMPARE_CACHE_STORAGE_KEY));
        const validProductIds = productIds.filter(isUuid);
        const skippedIds = productIds.filter((id) => !isUuid(id));
        const staleSkippedIds = skippedIds.filter((id) => !cachedProductsById[id]);

        if (staleSkippedIds.length > 0) {
          console.warn('[Compare] Removing stale comparison IDs:', staleSkippedIds);
          const cleanedIds = productIds.filter((id) => !staleSkippedIds.includes(id));
          localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(cleanedIds));
          writeCompareCache(cachedProductsById, cleanedIds);
          window.dispatchEvent(new Event('compare-products-updated'));
          setProductIds(cleanedIds);
          return;
        }

        if (validProductIds.length === 0) {
          const orderedCachedProducts = productIds
            .map((id) => cachedProductsById[id])
            .filter(Boolean) as Product[];
          setProducts(orderedCachedProducts);
          // ADR-388: restore current offers for identity-bearing snapshots (see helper).
          const refreshed = await refreshFromKnowledgeLayer(orderedCachedProducts, locale);
          if (cancelled) return;
          setProducts(refreshed);
          writeCompareCache(Object.fromEntries(refreshed.map((p) => [p.id, p])), productIds);
          return;
        }

        const { data: richData, error: richError } = await supabase
          .from('products')
          .select(EXTENDED_COMPARE_SELECT)
          .in('id', validProductIds)
          .eq('is_active', true)
          .returns<ProductRecord[]>();

        let finalData = richData || [];

        if (richError) {
          console.warn('[Compare] Extended compare select failed, retrying with fallback:', {
            message: richError.message,
            details: richError.details,
            hint: richError.hint,
            code: richError.code,
          });

          const { data: fallbackData, error: fallbackError } = await supabase
            .from('products')
            .select(FALLBACK_COMPARE_SELECT)
            .in('id', validProductIds)
            .eq('is_active', true)
            .returns<ProductRecord[]>();

          if (fallbackError) {
            throw fallbackError;
          }

          finalData = fallbackData || [];
        }

        const normalizedProducts = finalData.map(normalizeProductRecord);
        const dbProductsById = new Map(normalizedProducts.map((product) => [product.id, product]));

        const ordered = productIds
          .map((id) => dbProductsById.get(id) || cachedProductsById[id])
          .filter(Boolean) as Product[];

        setProducts(ordered);

        // ADR-388: a TPS canonical has no `products` row, so it always comes from the cache
        // snapshot above — restore its CURRENT offers from the knowledge layer by identity key,
        // then persist the refreshed snapshot so the tray and the next load agree.
        const needsRefresh = ordered.some((p) => p.tps_identity_key && !dbProductsById.has(p.id));
        if (needsRefresh) {
          const refreshed = await refreshFromKnowledgeLayer(ordered.map((p) => (dbProductsById.has(p.id) ? { ...p, tps_identity_key: null } : p)), locale);
          if (cancelled) return;
          // keep the DB rows' identity keys (they were only masked to skip the fetch)
          const merged = refreshed.map((p, i) => (dbProductsById.has(p.id) ? ordered[i] : p));
          setProducts(merged);
          writeCompareCache({ ...cachedProductsById, ...Object.fromEntries(merged.filter((p) => !dbProductsById.has(p.id)).map((p) => [p.id, p])) }, productIds);
        }

        validProductIds.forEach((productId) => {
          if (!dbProductsById.has(productId)) {
            return;
          }

          fetch(`/api/products/${productId}/comparison`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).catch((err) => {
            console.error(`Error tracking comparison for product ${productId}:`, err);
          });
        });
      } catch (err) {
        if (isCompareQueryError(err)) {
          console.error('Error fetching comparison products:', {
            message: err.message,
            details: err.details,
            hint: err.hint,
            code: err.code,
            raw: err,
          });
        } else {
          console.error('Error fetching comparison products:', err);
        }
        const errorMessage = getErrorMessage(err, t('compare.errorLoading'));
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
    return () => { cancelled = true; };
  }, [productIds, t, locale]);

  const getStoresByPrice = (product: Product): ProductStore[] => {
    return [...product.product_stores]
      .filter((store) => store.current_price > 0)
      .sort((a, b) => a.current_price - b.current_price);
  };

  const getStoreName = (store: ProductStore | null): string => {
    if (!store?.stores) return t('compare.notAvailable');
    return locale === 'ar' ? store.stores.name_ar : store.stores.name_en;
  };

  const getAvailabilityBadge = (availability: AvailabilityStatus) => {
    if (availability === 'in_stock') {
      return <Badge variant="success">{t('product.inStock')}</Badge>;
    }
    if (availability === 'limited_stock') {
      return <Badge variant="warning">{t('product.limitedStock')}</Badge>;
    }
    return <Badge variant="secondary">{t('product.outOfStock')}</Badge>;
  };

  const getDeliveryTimeLabel = (store: ProductStore | null): string => {
    if (store?.delivery_time_days && store.delivery_time_days > 0) {
      if (store.delivery_time_days === 1) return `1 ${t('compare.day')}`;
      return `${store.delivery_time_days} ${t('compare.days')}`;
    }
    // Fall back to store policy
    const slug = getStoreSlug(store?.stores || null);
    const policy = slug ? STORE_POLICIES[slug] : null;
    if (policy) return locale === 'ar' ? policy.delivery_ar : policy.delivery_en;
    return t('compare.notSpecified');
  };

  const getShippingLabel = (store: ProductStore | null): string | React.ReactNode => {
    if (!store) return t('compare.notAvailable');
    if (store.is_free_delivery) return t('compare.freeDelivery');
    // `> 0`, NOT `>= 0`. A zero here is ABSENCE OF DATA, not free shipping.
    //
    // Measured 2026-07-31: `product_stores.delivery_cost` is 0 on ALL 12,980 rows and
    // `is_free_delivery` is false on all of them — we hold no delivery data whatsoever. With
    // `>= 0` this rendered «٠ ريال» for every retailer, which asserts free shipping we cannot
    // support. Principle 1 (no claim without data), Principle 2 (unknown beats incorrect),
    // Appendix F1 (claim boundaries are evidence) and REDESIGN_BRIEF §7.2 (an unknown cost is
    // never zero) all forbid it.
    //
    // `comparison-table.tsx` already guarded on `> 0`; this page did not. The two surfaces now
    // agree. Falls through to «غير محدد» / "Not specified", which already exists as approved
    // copy — no new claim is introduced.
    //
    // When real delivery data exists, a genuine 0 must be expressed as `is_free_delivery`,
    // never inferred from a zero cost.
    if (typeof store.delivery_cost === 'number' && store.delivery_cost > 0) {
      return <Price amount={store.delivery_cost} className="text-sm font-semibold" symbolClassName="w-3 h-3" />;
    }
    return t('compare.notSpecified');
  };

  const handleRemove = (productId: string) => {
    const nextIds = productIds.filter((id) => id !== productId);
    setProductIds(nextIds);
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(nextIds));
    const cachedProductsById = parseCachedCompareProducts(localStorage.getItem(COMPARE_CACHE_STORAGE_KEY));
    writeCompareCache(cachedProductsById, nextIds);
    window.dispatchEvent(new Event('compare-products-updated'));
  };

  const handleClearAll = () => {
    setProductIds([]);
    localStorage.removeItem(COMPARE_STORAGE_KEY);
    localStorage.removeItem(COMPARE_CACHE_STORAGE_KEY);
    window.dispatchEvent(new Event('compare-products-updated'));
  };

  const handleAddMore = () => {
    router.push(`/${locale}/products`);
  };

  const getProductName = (product: Product): string => {
    return locale === 'ar' ? product.name_ar : product.name_en;
  };

  const getStoreUrl = (store: ProductStore | null): string | null => {
    if (!store) return null;
    return store.product_url || store.affiliate_url || store.stores?.website_url || null;
  };

  // ADR-388: ONE derivation per product feeds the header price, the crown, the store counts,
  // the spread and the observation line — they cannot disagree with each other.
  const factsByProductId = new Map<string, ProductOfferFacts>();
  const bestStoreByProductId = new Map<string, ProductStore | null>();
  products.forEach((product) => {
    const facts = deriveProductOfferFacts(getStoresByPrice(product));
    factsByProductId.set(product.id, facts);
    bestStoreByProductId.set(product.id, facts.best);
  });

  // «الأقل سعرًا بين المختارة» is awarded only among ELIGIBLE best offers — a stale price
  // never wins the badge (it can still be shown, labelled as last observed).
  const eligibleBestPrices = Array.from(factsByProductId.values())
    .filter((f) => f.bestIsEligible && f.best)
    .map((f) => f.best!.current_price);
  const lowestBestPrice = eligibleBestPrices.length > 0 ? Math.min(...eligibleBestPrices) : null;
  const isAr = locale === 'ar';
  const windowDays = PICK_FRESHNESS_MAX_HOURS / 24;
  const identityTable = mergeIdentitySpecTable(products.map((p) => identitySpecRows(p.tps_identity_key, p.category, isAr ? 'ar' : 'en')));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-1/2 mx-auto" />
              <Skeleton className="h-8 w-24 mx-auto" />
            </div>
          ))}
        </div>
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
        {t('compare.title')}
      </h1>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {products.length === 0 && (
        <EmptyState
          icon={<BarChart3 className="h-12 w-12" />}
          title={t('compare.noProducts')}
          description={t('compare.emptyDescription')}
          action={{
            label: t('compare.addMore'),
            onClick: handleAddMore,
          }}
        />
      )}

      {products.length > 0 && (() => {
        // ADR-387: no forced 700px table. A 96–140px label column + ≥140px per product lets
        // two products sit side by side at 390px; three or four scroll horizontally inside
        // the container while the label column stays pinned (sticky start).
        // ADR-389 (founder: "completeness of view beats absence of scroll"): with ≤2 products the
        // columns share whatever width is left after a narrower label column, so nothing is ever
        // clipped at 390px; with 3–4 the container scrolls horizontally BY DESIGN (min 150px per
        // product, label column pinned) and says so above the table.
        const gridCols = products.length <= 2
          ? `minmax(84px, 112px) repeat(${products.length}, minmax(0, 1fr))`
          : `minmax(96px, 140px) repeat(${products.length}, minmax(150px, 1fr))`;
        const scrollsHorizontally = products.length >= 3;
        const totalCols = products.length + 1;
        const categories = new Set(products.map((p) => p.category).filter(Boolean));
        const mixedCategories = categories.size > 1;
        // Specification rows: every primitive key any product carries, differences highlighted,
        // unknown shown as «غير متاح» — never a zero, never an implied match.
        const specKeys = Array.from(new Set(products.flatMap((p) => Object.entries(p.specifications ?? {})
          .filter(([, v]) => v !== null && v !== undefined && (typeof v !== 'object'))
          .map(([k]) => k)))).slice(0, 14);
        const specValue = (p: Product, k: string): string | null => {
          const v = (p.specifications ?? {})[k];
          if (v === null || v === undefined || typeof v === 'object') return null;
          const s = String(v).trim();
          return s ? s : null;
        };
        const humanizeKey = (k: string) => k.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const differs = (k: string) => { const vals = products.map((p) => specValue(p, k)); return vals.every((v) => v !== null) && new Set(vals).size > 1; };

        /** Renders one grid-row with a label cell + one cell per product */
        const renderDataRow = (
          label: string,
          renderCell: (product: Product, colIdx: number) => React.ReactNode,
          rowIdx: number,
        ) => (
          <div
            key={label}
            className={cn(
              'grid border-b border-outline-variant/50',
              rowIdx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/30'
            )}
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="sticky start-0 z-[1] flex items-center border-e border-outline-variant/50 bg-inherit px-3 py-3 text-xs font-bold text-on-surface sm:px-4 sm:text-sm">
              {label}
            </div>
            {products.map((product, colIdx) => (
              <div
                key={product.id}
                className={cn(
                  'py-3 px-4 text-sm text-on-surface flex items-center justify-center text-center',
                  colIdx < products.length - 1 && 'border-e border-outline-variant/30'
                )}
              >
                {renderCell(product, colIdx)}
              </div>
            ))}
          </div>
        );

        return (
          <div className="space-y-3">
          {mixedCategories && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {locale === 'ar'
                  ? 'هذه منتجات من فئات مختلفة — قارن المواصفات بينها، أما فرق السعر بينها فليس توفيرًا على المنتج نفسه.'
                  : 'These products are from different categories — compare their specifications; a price gap between them is not a saving on the same product.'}
              </AlertDescription>
            </Alert>
          )}
          {scrollsHorizontally && (
            <p className="text-[11px] text-on-surface-variant md:hidden" data-scroll-hint>
              {isAr ? '← اسحب أفقيًا لعرض بقية المنتجات؛ عمود العناوين يبقى ثابتًا' : 'Swipe horizontally to see the other products; the label column stays pinned →'}
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-outline-variant/70">
            {/* ── Product Header Row ── */}
            <div
              className="grid border-b border-outline-variant/50 bg-surface-container-lowest"
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Empty label column */}
              <div className="sticky start-0 z-[1] border-e border-outline-variant/50 bg-inherit p-2.5 sm:p-4" />
              {products.map((product, colIdx) => {
                const productName = getProductName(product);
                const facts = factsByProductId.get(product.id) ?? deriveProductOfferFacts([]);
                const bestStore = facts.best;
                const imageUrl = product.image_urls?.[0] || PLACEHOLDER_IMAGE;
                const isBestPriceProduct = lowestBestPrice !== null && facts.bestIsEligible && bestStore?.current_price === lowestBestPrice && products.length > 1;
                const primaryStoreUrl = getStoreUrl(bestStore);
                const bestAvail = bestStore ? storeAvailabilityLabel(bestStore, !facts.bestIsEligible, isAr) : null;

                return (
                  <div
                    key={product.id}
                    className={cn(
                      'p-2.5 text-center sm:p-4',
                      colIdx < products.length - 1 && 'border-e border-outline-variant/30'
                    )}
                  >
                    <div className="relative flex flex-col items-center">
                      {/* Remove button */}
                      <button
                        onClick={() => handleRemove(product.id)}
                        className="absolute -top-1 -end-1 z-10 w-6 h-6 rounded-full bg-surface-container border border-outline-variant/70 flex items-center justify-center text-on-surface-variant hover:text-error-600 hover:border-error-300 transition-colors"
                        aria-label={`${t('compare.clearAll')} ${productName}`}
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* ADR-389: the badge is in normal flow, ABOVE the image, and may wrap — it was
                          absolutely positioned inside a 128px image box, so at 390px it spilled past
                          the column edge and under the remove button. */}
                      <div className="mb-1.5 flex min-h-[20px] w-full items-center justify-center px-5">
                        {isBestPriceProduct && (
                          <Badge variant="success" className="max-w-full whitespace-normal text-center text-[10px] leading-tight" data-lowest-badge>
                            {/* "lowest among the selected", never "best": these may be different models */}
                            {locale === 'ar' ? 'الأقل سعرًا بين المختارة' : 'Lowest of the selected'}
                          </Badge>
                        )}
                      </div>

                      {/* Product Image */}
                      <div className="relative mb-3 flex h-28 w-28 items-center justify-center rounded-lg bg-white p-2 dark:bg-gray-900 sm:h-32 sm:w-32">
                        <Image
                          src={imageUrl}
                          alt={productName}
                          width={120}
                          height={120}
                          className="max-h-[112px] w-auto object-contain"
                          unoptimized
                        />
                      </div>

                      {/* Product Name — clamped, full name one tap away (never a shortened store name) */}
                      <h3
                        dir="auto"
                        title={productName}
                        className={cn('mb-0.5 text-sm font-semibold leading-snug text-on-surface break-words', !expandedNames.has(product.id) && 'line-clamp-2')}
                      >
                        {productName}
                      </h3>
                      {productName.length > 40 && (
                        <button
                          type="button"
                          className="mb-1 text-[11px] text-primary-600 hover:underline"
                          aria-expanded={expandedNames.has(product.id)}
                          onClick={() => setExpandedNames((prev) => { const next = new Set(prev); if (next.has(product.id)) next.delete(product.id); else next.add(product.id); return next; })}
                        >
                          {expandedNames.has(product.id) ? (isAr ? 'اختصار الاسم' : 'Shorten name') : (isAr ? 'الاسم كاملًا' : 'Full name')}
                        </button>
                      )}

                      {/* Brand / Model — brand in the reader's language; a missing model is omitted, never a placeholder */}
                      <p className="text-xs text-on-surface-variant mb-2" dir="auto">
                        {brandDisplayName(product.brand, isAr ? 'ar' : 'en')}{product.model && !/^(NO_|NA$)/.test(product.model) ? ` · ${product.model}` : ''}
                      </p>

                      {/* Price — the cheapest ELIGIBLE offer; an ineligible one is labelled as last observed.
                          ADR-388: the merchant's struck-through «was» price is gone from this surface —
                          71% of advertised reference prices were never observed (ADR-134); a figure we
                          cannot source is not one we repeat beside our own observation. */}
                      <div className="mb-3">
                        {bestStore ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {!facts.bestIsEligible && (
                              <span className="text-[10px] font-medium text-on-surface-variant">{t('compare.lastObservedPrice')}</span>
                            )}
                            <Price amount={bestStore.current_price} className={cn('text-lg font-bold', facts.bestIsEligible ? 'text-on-surface' : 'text-on-surface-variant')} symbolClassName="w-4 h-4" />
                            <span className="text-[11px] leading-snug text-on-surface-variant" dir="auto">
                              {bestStore.stores ? (isAr ? bestStore.stores.name_ar : bestStore.stores.name_en) : null}
                              {bestStore.observed_at ? ` · ${observedLabel(bestStore.observed_at, isAr)}` : facts.freshnessUnknown ? ` · ${t('compare.observationUnknown')}` : ''}
                            </span>
                            {bestAvail && (
                              <span className={cn('text-[11px]', bestAvail.tone === 'ok' ? 'text-[var(--brand-green-dark)]' : bestAvail.tone === 'bad' ? 'text-[var(--color-error)]' : 'text-on-surface-variant')}>
                                {bestAvail.text}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-outline">
                            {product.refresh_status === 'gone'
                              ? (isAr ? 'لا عروض حالية لهذا المنتج' : 'No current offers for this product')
                              : t('compare.notAvailable')}
                          </span>
                        )}
                        {/* ADR-389: a failed refresh is disclosed — the snapshot is shown with its
                            ORIGINAL observation time; eligibility above is judged against now. */}
                        {product.refresh_status === 'failed' && (
                          <p className="mt-1 text-[10px] leading-snug text-amber-700 dark:text-amber-400" data-refresh-failed>
                            {isAr ? 'تعذر تحديث العروض الآن — نعرض آخر لقطة محفوظة بزمن رصدها الأصلي' : 'Could not refresh offers — showing the last saved snapshot with its original observation time'}
                          </p>
                        )}
                      </div>

                      {/* CTA — full column width, names the destination store when known */}
                      {isUuid(product.id) ? (
                        <Button asChild variant="default" size="sm" className="h-auto min-h-9 w-full max-w-full whitespace-normal rounded-md px-2 py-2 text-sm font-semibold leading-snug">
                          <Link href={`/${locale}/products/${product.slug}`}>
                            {t('compare.viewProduct')}
                          </Link>
                        </Button>
                      ) : (
                        // The label WRAPS — a store name is never shortened (live 390: «اذه…»).
                        primaryStoreUrl && (
                          <Button asChild variant="default" size="sm" className="h-auto min-h-9 w-full max-w-full whitespace-normal rounded-md px-2 py-2 text-sm font-semibold leading-snug">
                            <a href={primaryStoreUrl} target="_blank" rel="noopener noreferrer"
                              onClick={() => recordFirstPartyInteraction({ goId: null, canonicalId: isUuid(product.id) ? product.id : null, surface: 'compare_list' })}
                            >
                              <span className="text-center">
                                {bestStore?.stores
                                  ? (isAr ? `اذهب إلى ${bestStore.stores.name_ar}` : `Go to ${bestStore.stores.name_en}`)
                                  : t('compare.viewStore')}
                              </span>
                              <ExternalLink className="ms-1 h-3.5 w-3.5 shrink-0" />
                            </a>
                          </Button>
                        )
                      )}
                      {/* ADR-389: a clear path from the multi-product view to ALL of this product's
                          offers (the single-product comparison), when the identity is known. */}
                      {product.tps_identity_key && product.product_stores.length > 0 && (
                        <Link
                          href={`/${locale}/compare/${encodeURIComponent(product.tps_identity_key)}`}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline"
                          data-all-offers-link
                        >
                          {isAr
                            ? `كل عروض هذا المنتج (${product.product_stores.length})`
                            : `All offers for this product (${product.product_stores.length})`}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Controls Row ── */}
            <div className="flex items-center justify-end border-b border-outline-variant/50 bg-surface-container-low/50 py-2.5 px-4">
              <button
                onClick={handleClearAll}
                className="text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors"
              >
                {t('compare.clearSelection')}
              </button>
            </div>

            {/* ── Store Comparison Section Header ── */}
            <div className="border-b border-outline-variant/50 bg-surface-container py-2.5 px-4">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                {t('compare.storeComparison')}
              </h2>
              {/* ADR-388: the same rule /compare/[key] states — which offers count, and that the
                  price is for the device alone. Stated once, above the rows it governs. */}
              <p className="text-[11px] text-on-surface-variant">
                {isAr
                  ? `تدخل في المقارنة العروض التي رُصدت خلال ${windowDays} أيام ومتوفرة عند آخر رصد؛ منها يُحسب فرق السعر. الأسعار للجهاز فقط — لا تشمل الشحن أو التركيب.`
                  : `Offers observed within ${windowDays} days and in stock at last observation take part; the spread is computed from them. Prices are for the device only — shipping and installation excluded.`}
              </p>
            </div>

            {/* ── Store Comparison Rows ── */}
            {[
              {
                key: 'bestStore', label: t('compare.bestStore'), render: (product: Product) => {
                  const f = factsByProductId.get(product.id);
                  if (!f?.best) return <span className="text-on-surface-variant">{t('compare.notAvailable')}</span>;
                  if (!f.bestIsEligible) return <span className="text-on-surface-variant">{t('compare.noEligibleOffer')}</span>;
                  return getStoreName(f.best);
                },
              },
              {
                key: 'observed', label: t('compare.lastObserved'), render: (product: Product) => {
                  const f = factsByProductId.get(product.id);
                  const bs = f?.best ?? null;
                  if (!bs) return <span className="text-on-surface-variant">{t('compare.notAvailable')}</span>;
                  if (!bs.observed_at) return <span className="text-on-surface-variant">{t('compare.observationUnknown')}</span>;
                  return <span className={f && !f.bestIsEligible ? 'text-on-surface-variant' : 'text-on-surface'}>{observedLabel(bs.observed_at, isAr)}</span>;
                },
              },
              {
                // Availability is bound to the observation it came from — never present tense for an old offer.
                key: 'availability', label: t('compare.availability'), render: (product: Product) => {
                  const f = factsByProductId.get(product.id);
                  const bs = f?.best ?? null;
                  if (!bs) return <Badge variant="secondary">{t('product.outOfStock')}</Badge>;
                  const a = storeAvailabilityLabel(bs, !f!.bestIsEligible, isAr);
                  if (!a) return getAvailabilityBadge(bs.availability);
                  return <Badge variant={a.tone === 'ok' ? 'success' : a.tone === 'bad' ? 'secondary' : 'outline'}>{a.text}</Badge>;
                },
              },
              {
                // DISTINCT eligible retailers, with the excluded ones counted separately — never «5 متاحة»
                // when only 3 offers may take part (ArtCool, 2026-09-26).
                key: 'storesAvailable', label: t('compare.storesAvailable'), render: (product: Product) => {
                  const f = factsByProductId.get(product.id);
                  if (!f) return null;
                  const inPart = isAr
                    ? (f.eligibleStoreCount === 0 ? 'لا متاجر مؤهلة' : f.eligibleStoreCount === 1 ? 'متجر واحد مؤهل' : f.eligibleStoreCount === 2 ? 'متجران مؤهلان' : `${f.eligibleStoreCount} متاجر مؤهلة`)
                    : `${f.eligibleStoreCount} eligible ${f.eligibleStoreCount === 1 ? 'store' : 'stores'}`;
                  return (
                    <span className="flex flex-col items-center gap-0.5 leading-snug">
                      <span>{inPart}</span>
                      {f.excludedStoreCount > 0 && (
                        <span className="text-[11px] text-on-surface-variant" title={f.excluded.map((e) => `${e.item.stores ? (isAr ? e.item.stores.name_ar : e.item.stores.name_en) : ''}: ${exclusionLabelFor(e.reason, e.item.observed_at, isAr)}`).join('\n')}>
                          {isAr ? `${f.excludedStoreCount} خارج المقارنة` : `${f.excludedStoreCount} outside the comparison`}
                        </span>
                      )}
                    </span>
                  );
                },
              },
              // ADR-389: service rows (delivery / shipping / warranty / returns) render only when
              // at least one product states a value; the all-unknown ones collapse into ONE row
              // that says so — four rows of «غير محدد» told the shopper nothing, at length.
              ...(() => {
                const notSpecified = t('compare.notSpecified');
                const serviceRows: Array<{ key: string; label: string; value: (p: Product) => string | null }> = [
                  { key: 'deliveryTime', label: t('compare.deliveryTime'), value: (p) => { const v = getDeliveryTimeLabel(bestStoreByProductId.get(p.id) || null); return v === notSpecified ? null : v; } },
                  { key: 'shippingCost', label: t('compare.shippingCost'), value: (p) => { const v = getShippingLabel(bestStoreByProductId.get(p.id) || null); return typeof v === 'string' && (v === notSpecified || v === t('compare.notAvailable')) ? null : (typeof v === 'string' ? v : null); } },
                  { key: 'warranty', label: t('compare.warranty'), value: (p) => {
                    const bs = bestStoreByProductId.get(p.id) || null;
                    const warranty = bs?.stores ? (locale === 'ar' ? bs.stores.warranty_info_ar : bs.stores.warranty_info_en) : null;
                    if (warranty) return warranty;
                    const slug = getStoreSlug(bs?.stores || null);
                    const policy = slug ? STORE_POLICIES[slug] : null;
                    return policy ? (locale === 'ar' ? policy.warranty_ar : policy.warranty_en) : null;
                  } },
                  { key: 'returnPolicy', label: t('compare.returnPolicy'), value: (p) => {
                    const bs = bestStoreByProductId.get(p.id) || null;
                    const returnPolicy = bs?.stores ? (locale === 'ar' ? bs.stores.return_policy_ar : bs.stores.return_policy_en) : null;
                    if (returnPolicy) return returnPolicy;
                    const slug = getStoreSlug(bs?.stores || null);
                    const policy = slug ? STORE_POLICIES[slug] : null;
                    return policy ? (locale === 'ar' ? policy.return_ar : policy.return_en) : null;
                  } },
                ];
                const present = serviceRows.filter((r) => products.some((p) => r.value(p) !== null));
                const missing = serviceRows.filter((r) => !present.includes(r));
                const rows = present.map((r) => ({
                  key: r.key, label: r.label,
                  render: (p: Product) => { const v = r.value(p); return v ? <span className="text-on-surface">{v}</span> : <span className="text-on-surface-variant">{notSpecified}</span>; },
                }));
                if (missing.length > 0) {
                  rows.push({
                    key: 'services-unknown',
                    label: missing.map((r) => r.label).join(' · '),
                    render: () => (
                      <span className="text-[11px] leading-snug text-on-surface-variant" data-services-unknown>
                        {isAr ? 'غير مذكورة لهذه العروض — راجعها عند المتجر' : 'Not stated for these offers — check with the store'}
                      </span>
                    ),
                  });
                }
                return rows;
              })(),
              {
                // ADR-387: this row used to render the MERCHANT'S claimed discount
                // (original_price − current_price) as «توفير». Tawveeri's own measurement
                // (ADR-134: 71% of advertised reference prices were never observed) is exactly
                // why that claim is not ours to repeat. What we CAN state is observed: the spread
                // between this product's own stores' prices.
                // ADR-388: computed over ELIGIBLE offers only — the same set the count above names.
                // Live defect: ArtCool read 720 here (3,669 − a 12-day-old 2,949) against 400 on
                // /compare/[key] (3,669 − 3,269 among the three eligible stores).
                key: 'spread', label: locale === 'ar' ? 'فرق السعر بين المتاجر' : 'Price spread across stores', render: (product: Product) => {
                  const f = factsByProductId.get(product.id);
                  if (!f || f.eligibleStoreCount === 0) return <span className="text-on-surface-variant">{t('compare.noEligibleOffer')}</span>;
                  if (f.eligibleStoreCount < 2 || f.spread == null) return <span className="text-on-surface-variant">{isAr ? 'متجر واحد مؤهل — لا فرق يُحسب' : 'One eligible store — no spread'}</span>;
                  return f.spread > 0
                    ? <Price amount={f.spread} className="text-sm font-semibold text-[var(--brand-gold-dark)]" symbolClassName="w-3 h-3" />
                    : <span className="text-on-surface-variant">{locale === 'ar' ? 'نفس السعر' : 'Same price'}</span>;
                },
              },
            ].map((row, rowIdx) => renderDataRow(row.label, (product) => <>{row.render(product)}</>, rowIdx))}

            {/* ── Specifications — differences highlighted, unknowns stated ── */}
            <div className="border-b border-outline-variant/50 bg-surface-container py-2.5 px-4">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                {locale === 'ar' ? 'المواصفات' : 'Specifications'}
              </h2>
              <p className="text-[11px] text-on-surface-variant">
                {locale === 'ar' ? 'الصفوف المظللة تختلف بين المنتجات. «غير متاح» يعني أن المتجر لم يذكرها — لا أنها متطابقة.' : 'Shaded rows differ between products. “Not available” means the store did not state it — not that it matches.'}
              </p>
            </div>
            {[
              { key: '__category', label: locale === 'ar' ? 'الفئة' : 'Category', get: (p: Product) => (p.category ? t(`products.categories.${p.category}`) : null), diff: mixedCategories },
              { key: '__brand', label: locale === 'ar' ? 'العلامة' : 'Brand', get: (p: Product) => (p.brand ? brandDisplayName(p.brand, isAr ? 'ar' : 'en') : null), diff: new Set(products.map((p) => (p.brand || '').toLowerCase())).size > 1 },
              // Model: shown only when at least one product states one — a row of «غير متاح» helps nobody.
              ...(products.some((p) => p.model && !/^(NO_|NA$)/.test(p.model))
                ? [{ key: '__model', label: locale === 'ar' ? 'الموديل' : 'Model', get: (p: Product) => (p.model && !/^(NO_|NA$)/.test(p.model) ? p.model : null), diff: false }]
                : []),
              // ADR-388: identity-derived specifications (the knowledge layer's parsed identity —
              // capacity, series, inverter, cooling mode for an AC). Unknown stays «غير متاح».
              ...identityTable.map((row) => ({
                key: `__id_${row.key}`, label: row.label,
                get: (p: Product) => row.values[products.indexOf(p)] ?? null,
                diff: row.differs,
              })),
              ...specKeys.map((k) => ({ key: k, label: humanizeKey(k), get: (p: Product) => specValue(p, k), diff: differs(k) })),
            ].map((row, rowIdx) => (
              <div
                key={row.key}
                className={cn('grid border-b border-outline-variant/50', row.diff ? 'bg-amber-50/60 dark:bg-amber-950/10' : rowIdx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/30')}
                style={{ gridTemplateColumns: gridCols }}
              >
                <div className="sticky start-0 z-[1] flex items-center border-e border-outline-variant/50 bg-inherit px-3 py-3 text-xs font-bold text-on-surface sm:px-4 sm:text-sm">{row.label}</div>
                {products.map((product, colIdx) => {
                  const v = row.get(product);
                  return (
                    <div key={product.id} className={cn('flex items-center justify-center px-3 py-3 text-center text-sm', colIdx < products.length - 1 && 'border-e border-outline-variant/30', v ? 'text-on-surface' : 'text-on-surface-variant')} dir="auto">
                      {v ?? t('compare.notAvailable')}
                    </div>
                  );
                })}
              </div>
            ))}

          </div>
          </div>
        );
      })()}

      {products.length >= MAX_COMPARE_PRODUCTS && (
        <Alert className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('compare.maxProducts')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
