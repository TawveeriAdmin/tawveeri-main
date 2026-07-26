'use client';

import React, { useEffect, useState } from 'react';
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
import { cn, calculateSavings } from '@/lib/utils';
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
    if (typeof store.delivery_cost === 'number' && store.delivery_cost >= 0) {
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
        const gridCols = `160px repeat(${products.length}, 1fr)`;
        const totalCols = products.length + 1;

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
            <div className="py-3 px-4 text-sm font-bold text-on-surface whitespace-nowrap border-e border-outline-variant/50 flex items-center">
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
          <div className="overflow-x-auto rounded-lg border border-outline-variant/70 min-w-[700px]">
            {/* ── Product Header Row ── */}
            <div
              className="grid border-b border-outline-variant/50 bg-surface-container-lowest"
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Empty label column */}
              <div className="border-e border-outline-variant/50 p-4" />
              {products.map((product, colIdx) => {
                const productName = getProductName(product);
                const bestStore = bestStoreByProductId.get(product.id) || null;
                const imageUrl = product.image_urls?.[0] || PLACEHOLDER_IMAGE;
                const isBestPriceProduct = lowestBestPrice !== null && bestStore?.current_price === lowestBestPrice && products.length > 1;
                const primaryStoreUrl = getStoreUrl(bestStore);

                return (
                  <div
                    key={product.id}
                    className={cn(
                      'p-4 text-center',
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

                      {/* Product Image */}
                      <div className="relative w-32 h-32 mb-3 rounded-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center">
                        <Image
                          src={imageUrl}
                          alt={productName}
                          width={120}
                          height={120}
                          className="object-contain max-h-[112px] w-auto"
                          unoptimized
                        />
                        {isBestPriceProduct && (
                          <Badge variant="success" className="absolute top-1 start-1 text-[10px]">
                            {t('compare.bestPrice')}
                          </Badge>
                        )}
                      </div>

                      {/* Product Name */}
                      <h3 className="text-sm font-semibold text-on-surface line-clamp-2 leading-snug mb-0.5">
                        {productName}
                      </h3>

                      {/* Brand / Model */}
                      <p className="text-xs text-on-surface-variant mb-2">
                        {product.brand}{product.model ? ` - ${product.model}` : ''}
                      </p>

                      {/* Price */}
                      <div className="mb-3">
                        {bestStore ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Price amount={bestStore.current_price} className="text-lg font-bold text-on-surface" symbolClassName="w-4 h-4" />
                            {bestStore.original_price && bestStore.original_price > bestStore.current_price && (
                              <Price
                                amount={bestStore.original_price}
                                className="text-xs text-on-surface-variant line-through"
                                symbolClassName="w-3 h-3"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-outline">{t('compare.notAvailable')}</span>
                        )}
                      </div>

                      {/* CTA Button */}
                      {isUuid(product.id) ? (
                        <Button asChild variant="default" size="sm" className="h-9 px-5 rounded-md text-sm font-semibold">
                          <Link href={`/${locale}/products/${product.slug}`}>
                            {t('compare.viewProduct')}
                          </Link>
                        </Button>
                      ) : (
                        primaryStoreUrl && (
                          <Button asChild variant="default" size="sm" className="h-9 px-5 rounded-md text-sm font-semibold">
                            <a href={primaryStoreUrl} target="_blank" rel="noopener noreferrer">
                              {t('compare.viewStore')}
                              <ExternalLink className="w-3.5 h-3.5 ms-1.5" />
                            </a>
                          </Button>
                        )
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
            </div>

            {/* ── Store Comparison Rows ── */}
            {[
              { key: 'bestStore', label: t('compare.bestStore'), render: (product: Product) => getStoreName(bestStoreByProductId.get(product.id) || null) },
              { key: 'availability', label: t('compare.availability'), render: (product: Product) => { const bs = bestStoreByProductId.get(product.id) || null; return bs ? getAvailabilityBadge(bs.availability) : <Badge variant="secondary">{t('product.outOfStock')}</Badge>; } },
              { key: 'storesAvailable', label: t('compare.storesAvailable'), render: (product: Product) => `${product.product_stores.length} ${product.product_stores.length === 1 ? t('compare.store') : t('compare.stores')}` },
              { key: 'deliveryTime', label: t('compare.deliveryTime'), render: (product: Product) => getDeliveryTimeLabel(bestStoreByProductId.get(product.id) || null) },
              { key: 'shippingCost', label: t('compare.shippingCost'), render: (product: Product) => getShippingLabel(bestStoreByProductId.get(product.id) || null) },
              {
                key: 'warranty', label: t('compare.warranty'), render: (product: Product) => {
                  const bs = bestStoreByProductId.get(product.id) || null;
                  const warranty = bs?.stores ? (locale === 'ar' ? bs.stores.warranty_info_ar : bs.stores.warranty_info_en) : null;
                  if (warranty) return <span className="text-on-surface">{warranty}</span>;
                  const slug = getStoreSlug(bs?.stores || null);
                  const policy = slug ? STORE_POLICIES[slug] : null;
                  if (policy) return <span className="text-on-surface">{locale === 'ar' ? policy.warranty_ar : policy.warranty_en}</span>;
                  return <span className="text-on-surface-variant">{t('compare.notSpecified')}</span>;
                },
              },
              {
                key: 'returnPolicy', label: t('compare.returnPolicy'), render: (product: Product) => {
                  const bs = bestStoreByProductId.get(product.id) || null;
                  const returnPolicy = bs?.stores ? (locale === 'ar' ? bs.stores.return_policy_ar : bs.stores.return_policy_en) : null;
                  if (returnPolicy) return <span className="text-on-surface">{returnPolicy}</span>;
                  const slug = getStoreSlug(bs?.stores || null);
                  const policy = slug ? STORE_POLICIES[slug] : null;
                  if (policy) return <span className="text-on-surface">{locale === 'ar' ? policy.return_ar : policy.return_en}</span>;
                  return <span className="text-on-surface-variant">{t('compare.notSpecified')}</span>;
                },
              },
              {
                key: 'savings', label: t('compare.savings'), render: (product: Product) => {
                  const bs = bestStoreByProductId.get(product.id) || null;
                  const hasSavings = bs?.original_price && bs.original_price > bs.current_price;
                  return hasSavings ? (
                    <Badge variant="success-light" className="text-xs">
                      <Price amount={calculateSavings(bs.original_price!, bs.current_price)} className="text-xs font-semibold" symbolClassName="w-3 h-3" />
                    </Badge>
                  ) : <span className="text-on-surface-variant">-</span>;
                },
              },
            ].map((row, rowIdx) => renderDataRow(row.label, (product) => <>{row.render(product)}</>, rowIdx))}

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
