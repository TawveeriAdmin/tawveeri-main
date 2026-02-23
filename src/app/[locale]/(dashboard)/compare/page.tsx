'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  X,
  AlertCircle,
  BarChart3,
  Plus,
  Trash2,
  ExternalLink,
  Store,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { calculateSavings } from '@/lib/utils';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';

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

interface ProductStore {
  id: string;
  current_price: number;
  original_price: number | null;
  availability: AvailabilityStatus;
  delivery_time_days: number | null;
  delivery_cost: number | null;
  is_free_delivery: boolean | null;
  product_url: string | null;
  affiliate_url: string | null;
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
}

const MAX_COMPARE_PRODUCTS = 4;
const COMPARE_STORAGE_KEY = 'compare_products';
const COMPARE_CACHE_STORAGE_KEY = 'compare_products_cache';
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    affiliate_url,
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

function textByLocale(locale: string, ar: string | null | undefined, en: string | null | undefined): string {
  if (locale === 'ar') {
    return ar || en || '';
  }
  return en || ar || '';
}

function formatSpecValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(' / ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function ComparePage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();

  const [productIds, setProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [productIds, t]);

  const allSpecKeys = useMemo(() => {
    const keys = new Set<string>();
    products.forEach((product) => {
      if (product.specifications) {
        Object.keys(product.specifications).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [products]);

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

  const getDeliveryTimeLabel = (days: number | null | undefined): string => {
    if (!days || days <= 0) return t('compare.notSpecified');
    if (days === 1) return `1 ${t('compare.day')}`;
    return `${days} ${t('compare.days')}`;
  };

  const getShippingLabel = (store: ProductStore | null): string => {
    if (!store) return t('compare.notAvailable');
    if (store.is_free_delivery) return t('compare.freeDelivery');
    if (typeof store.delivery_cost === 'number' && store.delivery_cost >= 0) {
      return `${store.delivery_cost.toLocaleString('en-US')} ${locale === 'ar' ? 'ر.س' : 'SAR'}`;
    }
    return t('compare.notSpecified');
  };

  const getWarrantyText = (store: ProductStore | null): string => {
    if (!store?.stores) return t('compare.notAvailable');
    const text = textByLocale(locale, store.stores.warranty_info_ar, store.stores.warranty_info_en);
    return text || t('compare.notSpecified');
  };

  const getReturnPolicyText = (store: ProductStore | null): string => {
    if (!store?.stores) return t('compare.notAvailable');
    const text = textByLocale(locale, store.stores.return_policy_ar, store.stores.return_policy_en);
    return text || t('compare.notSpecified');
  };

  const getDeliveryInfoText = (store: ProductStore | null): string => {
    if (!store?.stores) return t('compare.notAvailable');
    const text = textByLocale(locale, store.stores.delivery_info_ar, store.stores.delivery_info_en);
    return text || t('compare.notSpecified');
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

  const sortedStoresByProductId = new Map<string, ProductStore[]>();
  const bestStoreByProductId = new Map<string, ProductStore | null>();

  products.forEach((product) => {
    const sortedStores = getStoresByPrice(product);
    sortedStoresByProductId.set(product.id, sortedStores);
    const availableStore = sortedStores.find((store) => store.availability !== 'out_of_stock');
    bestStoreByProductId.set(product.id, availableStore || sortedStores[0] || null);
  });

  const bestPriceValues = Array.from(bestStoreByProductId.values())
    .map((store) => store?.current_price)
    .filter((price): price is number => typeof price === 'number' && price > 0);

  const lowestBestPrice = bestPriceValues.length > 0 ? Math.min(...bestPriceValues) : null;
  const highestBestPrice = bestPriceValues.length > 0 ? Math.max(...bestPriceValues) : null;
  const priceSpread = lowestBestPrice !== null && highestBestPrice !== null ? highestBestPrice - lowestBestPrice : null;
  const totalStoreOffers = Array.from(sortedStoresByProductId.values()).reduce((sum, stores) => sum + stores.length, 0);

  const bestDeal = products.reduce<{ productName: string; savings: number } | null>((currentBest, product) => {
    const bestStore = bestStoreByProductId.get(product.id) || null;
    if (!bestStore?.original_price || bestStore.original_price <= bestStore.current_price) {
      return currentBest;
    }

    const savings = calculateSavings(bestStore.original_price, bestStore.current_price);
    if (!currentBest || savings > currentBest.savings) {
      return { productName: getProductName(product), savings };
    }
    return currentBest;
  }, null);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-outline-variant bg-gradient-to-br from-primary-500/10 via-surface-container-lowest to-secondary-500/10 p-5 md:p-6">
        <div className="pointer-events-none absolute -top-20 end-6 h-52 w-52 rounded-full bg-primary-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-headline-lg text-on-surface mb-2">{t('compare.title')}</h1>
            <p className="text-on-surface-variant text-sm">
              {products.length} {products.length === 1 ? t('compare.product') : t('compare.products')} • {t('compare.compareUpTo')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {products.length > 0 && (
              <Button variant="outline" onClick={handleClearAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('compare.clearAll')}
              </Button>
            )}
            {products.length < MAX_COMPARE_PRODUCTS && (
              <Button onClick={handleAddMore}>
                <Plus className="w-4 h-4 mr-2" />
                {t('compare.addMore')}
              </Button>
            )}
          </div>
        </div>

        {products.length > 0 && (
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest/90 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-on-surface-variant">{t('compare.storeOffers')}</p>
              <p className="text-xl font-semibold text-on-surface mt-1">{totalStoreOffers}</p>
            </div>

            <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest/90 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-on-surface-variant">{t('compare.bestPrice')}</p>
              <div className="mt-1">
                {lowestBestPrice !== null ? (
                  <Price amount={lowestBestPrice} className="text-xl font-semibold" symbolClassName="w-5 h-5" />
                ) : (
                  <p className="text-lg text-outline">{t('compare.notAvailable')}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest/90 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-on-surface-variant">{t('compare.priceSpread')}</p>
              <div className="mt-1">
                {priceSpread !== null ? (
                  <Price amount={priceSpread} className="text-xl font-semibold" symbolClassName="w-5 h-5" />
                ) : (
                  <p className="text-lg text-outline">{t('compare.notAvailable')}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest/90 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-on-surface-variant">{t('compare.bestDeal')}</p>
              <div className="mt-1">
                {bestDeal ? (
                  <>
                    <Price amount={bestDeal.savings} className="text-xl font-semibold" symbolClassName="w-5 h-5" />
                    <p className="text-xs text-on-surface-variant truncate mt-1" title={bestDeal.productName}>
                      {bestDeal.productName}
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-outline">{t('compare.notAvailable')}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

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

      {products.length > 0 && (
        <div className="space-y-6">
          <Card className="overflow-hidden border-outline-variant bg-surface-container-lowest">
            <CardHeader className="border-b border-outline-variant/70 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                {t('compare.comparisonMatrix')}
              </CardTitle>
              <p className="text-sm text-on-surface-variant">{t('compare.matrixDescription')}</p>
            </CardHeader>

            <CardContent className="p-0">
              <Table className="min-w-[980px] border-separate border-spacing-0">
                <TableHeader className="border-b-0">
                  <TableRow className="hover:bg-transparent border-b border-outline-variant/80">
                    <TableHead className="w-56 min-w-56 sticky start-0 z-20 border-e border-outline-variant bg-surface-container px-4 py-4 text-sm font-semibold text-on-surface">
                      {t('compare.specifications')}
                    </TableHead>
                    {products.map((product) => {
                      const productName = getProductName(product);
                      const bestStore = bestStoreByProductId.get(product.id) || null;
                      const imageUrl = product.image_urls?.[0] || PLACEHOLDER_IMAGE;
                      const isBestPriceProduct = lowestBestPrice !== null && bestStore?.current_price === lowestBestPrice;
                      const primaryStoreUrl = getStoreUrl(bestStore);

                      return (
                        <TableHead
                          key={`summary-${product.id}`}
                          className="min-w-[250px] border-e border-outline-variant bg-surface-container-lowest align-top last:border-e-0 p-0"
                        >
                          <div className="p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-3 min-w-0">
                                <Image
                                  src={imageUrl}
                                  alt={productName}
                                  width={60}
                                  height={60}
                                  className="h-14 w-14 rounded-lg bg-white object-contain"
                                  unoptimized
                                />
                                <div className="min-w-0">
                                  <h3 className="text-sm font-semibold text-on-surface line-clamp-2">{productName}</h3>
                                  <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">
                                    {product.brand} - {product.model}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemove(product.id)}
                                className="text-outline hover:text-on-surface transition-colors"
                                aria-label={`${t('compare.clearAll')} ${productName}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              {bestStore ? (
                                <Price amount={bestStore.current_price} className="text-lg font-bold" symbolClassName="w-4 h-4" />
                              ) : (
                                <span className="text-sm text-outline">{t('compare.notAvailable')}</span>
                              )}
                              {isBestPriceProduct && (
                                <Badge variant="success" className="text-[10px]">
                                  {t('price.best')}
                                </Badge>
                              )}
                            </div>

                            <div className="mt-3">
                              {isUuid(product.id) ? (
                                <Button asChild variant="outline" size="sm" className="h-8">
                                  <Link href={`/${locale}/products/${product.slug}`}>{t('compare.viewProduct')}</Link>
                                </Button>
                              ) : (
                                primaryStoreUrl && (
                                  <Button asChild variant="outline" size="sm" className="h-8">
                                    <a href={primaryStoreUrl} target="_blank" rel="noopener noreferrer">
                                      {t('compare.viewStore')}
                                    </a>
                                  </Button>
                                )
                              )}
                            </div>
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  <TableRow className="hover:bg-transparent border-b border-outline-variant/70">
                    <TableCell className="sticky start-0 z-10 border-e border-outline-variant bg-surface-container-low font-semibold">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary-600" />
                        <span>{t('compare.price')}</span>
                      </div>
                    </TableCell>
                    {products.map((product) => {
                      const bestStore = bestStoreByProductId.get(product.id) || null;
                      return (
                        <TableCell key={`price-${product.id}`} className="text-center border-e border-outline-variant/70 bg-surface-container-lowest last:border-e-0">
                          {bestStore ? (
                            <div className="flex flex-col items-center gap-1">
                              <Price amount={bestStore.current_price} className="text-base font-semibold" symbolClassName="w-4 h-4" />
                              {bestStore.original_price && bestStore.original_price > bestStore.current_price && (
                                <>
                                  <Price
                                    amount={bestStore.original_price}
                                    className="text-xs text-outline line-through"
                                    symbolClassName="w-3 h-3"
                                  />
                                  <Badge variant="success-light" className="text-[11px]">
                                    <Price
                                      amount={calculateSavings(bestStore.original_price, bestStore.current_price)}
                                      className="text-[11px] font-semibold"
                                      symbolClassName="w-3 h-3"
                                    />
                                  </Badge>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-outline">{t('compare.notAvailable')}</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="hover:bg-transparent border-b border-outline-variant/70">
                    <TableCell className="sticky start-0 z-10 border-e border-outline-variant bg-surface-container font-semibold">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary-600" />
                        <span>{t('compare.availability')}</span>
                      </div>
                    </TableCell>
                    {products.map((product) => {
                      const bestStore = bestStoreByProductId.get(product.id) || null;
                      return (
                        <TableCell key={`availability-${product.id}`} className="text-center border-e border-outline-variant/70 bg-surface-container last:border-e-0">
                          {bestStore ? getAvailabilityBadge(bestStore.availability) : <Badge variant="secondary">{t('product.outOfStock')}</Badge>}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="hover:bg-transparent border-b border-outline-variant/70">
                    <TableCell className="sticky start-0 z-10 border-e border-outline-variant bg-surface-container-low font-semibold">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-primary-600" />
                        <span>{t('compare.stores')}</span>
                      </div>
                    </TableCell>
                    {products.map((product) => (
                      <TableCell key={`stores-${product.id}`} className="text-center border-e border-outline-variant/70 bg-surface-container-lowest last:border-e-0">
                        {product.product_stores.length} {product.product_stores.length === 1 ? t('compare.store') : t('compare.stores')}
                      </TableCell>
                    ))}
                  </TableRow>

                  <TableRow className="hover:bg-transparent border-b border-outline-variant/70">
                    <TableCell className="sticky start-0 z-10 border-e border-outline-variant bg-surface-container font-semibold">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-primary-600" />
                        <span>{t('compare.bestStore')}</span>
                      </div>
                    </TableCell>
                    {products.map((product) => {
                      const bestStore = bestStoreByProductId.get(product.id) || null;
                      return (
                        <TableCell key={`best-store-${product.id}`} className="text-center border-e border-outline-variant/70 bg-surface-container last:border-e-0">
                          {getStoreName(bestStore)}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="hover:bg-transparent border-b border-outline-variant/70">
                    <TableCell className="sticky start-0 z-10 border-e border-outline-variant bg-surface-container-low font-semibold">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary-600" />
                        <span>{t('compare.deliveryTime')}</span>
                      </div>
                    </TableCell>
                    {products.map((product) => {
                      const bestStore = bestStoreByProductId.get(product.id) || null;
                      return (
                        <TableCell key={`delivery-${product.id}`} className="text-center border-e border-outline-variant/70 bg-surface-container-lowest last:border-e-0">
                          {getDeliveryTimeLabel(bestStore?.delivery_time_days)}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="hover:bg-transparent border-b border-outline-variant/70">
                    <TableCell className="sticky start-0 z-10 border-e border-outline-variant bg-surface-container font-semibold">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-primary-600" />
                        <span>{t('compare.shippingCost')}</span>
                      </div>
                    </TableCell>
                    {products.map((product) => {
                      const bestStore = bestStoreByProductId.get(product.id) || null;
                      return (
                        <TableCell key={`shipping-${product.id}`} className="text-center border-e border-outline-variant/70 bg-surface-container last:border-e-0">
                          {getShippingLabel(bestStore)}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="hover:bg-transparent border-b border-outline-variant/70">
                    <TableCell className="sticky start-0 z-10 border-e border-outline-variant bg-surface-container-low font-semibold">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary-600" />
                        <span>{t('compare.warranty')}</span>
                      </div>
                    </TableCell>
                    {products.map((product) => {
                      const bestStore = bestStoreByProductId.get(product.id) || null;
                      const warrantyText = getWarrantyText(bestStore);
                      return (
                        <TableCell key={`warranty-${product.id}`} className="text-start border-e border-outline-variant/70 bg-surface-container-lowest last:border-e-0">
                          <p className="line-clamp-2" title={warrantyText}>{warrantyText}</p>
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableCell className="sticky start-0 z-10 border-e border-outline-variant bg-surface-container font-semibold">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-primary-600" />
                        <span>{t('compare.returnPolicy')}</span>
                      </div>
                    </TableCell>
                    {products.map((product) => {
                      const bestStore = bestStoreByProductId.get(product.id) || null;
                      const returnPolicyText = getReturnPolicyText(bestStore);
                      return (
                        <TableCell key={`return-policy-${product.id}`} className="text-start border-e border-outline-variant/70 bg-surface-container last:border-e-0">
                          <p className="line-clamp-2" title={returnPolicyText}>{returnPolicyText}</p>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-outline-variant bg-surface-container-lowest">
            <CardHeader className="border-b border-outline-variant/70 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('compare.technicalSpecs')}
              </CardTitle>
              <p className="text-sm text-on-surface-variant">{t('compare.technicalSpecsDescription')}</p>
            </CardHeader>

            <CardContent className="p-0">
              {allSpecKeys.length === 0 ? (
                <div className="p-5 text-sm text-on-surface-variant">{t('compare.noTechnicalSpecs')}</div>
              ) : (
                <Table className="min-w-[980px] border-separate border-spacing-0">
                  <TableHeader className="border-b-0">
                    <TableRow className="hover:bg-transparent border-b border-outline-variant/80">
                      <TableHead className="w-56 min-w-56 sticky start-0 z-20 border-e border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface">
                        {t('compare.specifications')}
                      </TableHead>
                      {products.map((product) => (
                        <TableHead
                          key={`spec-head-${product.id}`}
                          className="min-w-[250px] border-e border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface last:border-e-0"
                        >
                          <span className="line-clamp-2">{getProductName(product)}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {allSpecKeys.map((specKey, index) => (
                      <TableRow key={specKey} className={`hover:bg-transparent border-b border-outline-variant/70 ${index === allSpecKeys.length - 1 ? 'border-b-0' : ''}`}>
                        <TableCell className={`sticky start-0 z-10 border-e border-outline-variant font-semibold ${index % 2 === 0 ? 'bg-surface-container-low' : 'bg-surface-container'}`}>
                          <span className="break-words">{specKey}</span>
                        </TableCell>
                        {products.map((product) => (
                          <TableCell
                            key={`${specKey}-${product.id}`}
                            className={`text-start border-e border-outline-variant/70 last:border-e-0 ${index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container'}`}
                          >
                            {formatSpecValue(product.specifications?.[specKey])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-outline-variant bg-surface-container-lowest">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="w-4 h-4" />
                {t('compare.storeComparison')}
              </CardTitle>
              <p className="text-sm text-on-surface-variant">{t('compare.storeBreakdownDescription')}</p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {products.map((product) => {
                  const productName = getProductName(product);
                  const sortedStores = sortedStoresByProductId.get(product.id) || [];

                  return (
                    <div key={product.id} className="rounded-xl border border-outline-variant/80 bg-surface-container-low p-3.5 space-y-3">
                      <h3 className="font-semibold text-sm line-clamp-2">{productName}</h3>

                      {sortedStores.length === 0 && (
                        <p className="text-sm text-on-surface-variant">{t('compare.notAvailable')}</p>
                      )}

                      {sortedStores.map((store, index) => {
                        const storeName = getStoreName(store);
                        const storeUrl = getStoreUrl(store);
                        const deliveryInfo = getDeliveryInfoText(store);
                        const warranty = getWarrantyText(store);
                        const returnPolicy = getReturnPolicyText(store);
                        const isBestForProduct = index === 0;
                        const shipping = getShippingLabel(store);
                        const deliveryTime = getDeliveryTimeLabel(store.delivery_time_days);

                        return (
                          <div key={store.id} className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-3 space-y-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium truncate">{storeName}</p>
                                  {isBestForProduct && (
                                    <Badge variant="success" className="text-[10px]">{t('price.best')}</Badge>
                                  )}
                                </div>
                                <div className="mt-1">
                                  {getAvailabilityBadge(store.availability)}
                                </div>
                              </div>

                              <div className="text-end">
                                <Price amount={store.current_price} className="text-sm font-bold" symbolClassName="w-4 h-4" />
                                {store.original_price && store.original_price > store.current_price && (
                                  <Price
                                    amount={store.original_price}
                                    className="text-xs text-outline line-through"
                                    symbolClassName="w-3 h-3"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="grid gap-1 text-xs text-on-surface-variant">
                              <div className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5" />
                                <span>{t('compare.deliveryTime')}: {deliveryTime}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{t('compare.shippingCost')}: {shipping}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span className="line-clamp-2">{t('compare.warranty')}: {warranty}</span>
                              </div>
                              <p className="line-clamp-2">{t('compare.returnPolicy')}: {returnPolicy}</p>
                              <p className="line-clamp-2">{deliveryInfo}</p>
                            </div>

                            {storeUrl && (
                              <a
                                href={storeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-500"
                              >
                                {t('compare.viewStore')}
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {products.length >= MAX_COMPARE_PRODUCTS && (
        <Alert className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('compare.maxProducts')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
