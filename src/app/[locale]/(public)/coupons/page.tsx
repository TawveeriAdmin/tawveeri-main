'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { CouponBadge } from '@/components/ui/coupon-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Ticket, Tag, Clock, Store } from 'lucide-react';
import type { Database } from '@/lib/database/types';

type CouponRow = Database['public']['Tables']['coupons']['Row'];

type StoreSummary = {
  id: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  slug: string;
};

type ProductSummary = {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  image_urls: string[] | null;
};

type CouponWithRelations = CouponRow & {
  stores: StoreSummary | null;
  products: ProductSummary | null;
};

type SortOption = 'newest' | 'discount' | 'expiring';

export default function CouponsPage() {
  const supabase = useMemo(
    () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
    []
  );
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();

  const [coupons, setCoupons] = useState<CouponWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Fetch coupons
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError(
        locale === 'ar'
          ? 'تعذر تحميل الكوبونات حالياً.'
          : 'Failed to load coupons right now.'
      );
      return;
    }

    let cancelled = false;

    async function fetchCoupons() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase!
          .from('coupons')
          .select(
            `*, stores:store_id (id, name_ar, name_en, logo_url, slug), products:product_id (id, name_ar, name_en, slug, image_urls)`,
            { count: 'exact' }
          )
          .eq('is_active', true)
          .or('expires_at.is.null,expires_at.gt.now()')
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;
        if (cancelled) return;

        setCoupons((data as unknown as CouponWithRelations[]) || []);
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching coupons:', err);
        setError(
          err instanceof Error
            ? err.message
            : locale === 'ar'
              ? 'تعذر تحميل الكوبونات حالياً.'
              : 'Failed to load coupons right now.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchCoupons();

    return () => {
      cancelled = true;
    };
  }, [supabase, locale]);

  // Derive unique stores from fetched coupons
  const availableStores = useMemo(() => {
    const storeMap = new Map<string, StoreSummary>();
    coupons.forEach((coupon) => {
      if (coupon.stores && !storeMap.has(coupon.stores.id)) {
        storeMap.set(coupon.stores.id, coupon.stores);
      }
    });
    return Array.from(storeMap.values());
  }, [coupons]);

  // Filtered and sorted coupons
  const filteredCoupons = useMemo(() => {
    let result = [...coupons];

    // Store filter
    if (storeFilter !== 'all') {
      result = result.filter((c) => c.store_id === storeFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((c) => c.discount_type === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'discount') {
        return b.discount_value - a.discount_value;
      }
      // expiring: soonest expiry first, null expiry at end
      const aExpiry = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
      const bExpiry = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
      return aExpiry - bExpiry;
    });

    return result;
  }, [coupons, storeFilter, typeFilter, sortBy]);

  // Stats
  const activeCouponsCount = filteredCoupons.length;

  const highestDiscount = useMemo(() => {
    let max = 0;
    filteredCoupons.forEach((c) => {
      if (c.discount_type === 'percentage' && c.discount_value > max) {
        max = c.discount_value;
      }
    });
    return max;
  }, [filteredCoupons]);

  const expiringSoonCount = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 1000 * 60 * 60 * 24 * 7;
    return filteredCoupons.filter((c) => {
      if (!c.expires_at) return false;
      const expiresAt = new Date(c.expires_at).getTime();
      return expiresAt > now && expiresAt - now <= sevenDaysMs;
    }).length;
  }, [filteredCoupons]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${locale}`}>{t('common.home')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('coupons.title')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Title section */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 md:text-3xl">
          {t('coupons.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
          {t('coupons.subtitle')}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
          <div className="mb-2 flex items-center justify-between">
            <Ticket className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <Badge variant="outline">{t('coupons.totalActive')}</Badge>
          </div>
          <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {loading ? <Skeleton className="h-8 w-12 inline-block" /> : activeCouponsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
          <div className="mb-2 flex items-center justify-between">
            <Tag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <Badge variant="outline">{t('coupons.highestDiscount')}</Badge>
          </div>
          <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {loading ? (
              <Skeleton className="h-8 w-12 inline-block" />
            ) : highestDiscount > 0 ? (
              `${highestDiscount}%`
            ) : (
              '—'
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
          <div className="mb-2 flex items-center justify-between">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <Badge variant="outline">{t('coupons.expiringSoon')}</Badge>
          </div>
          <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {loading ? <Skeleton className="h-8 w-12 inline-block" /> : expiringSoonCount}
          </p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Store filter */}
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="h-10 w-full sm:w-[200px]">
            <Store className="me-2 h-4 w-4 text-on-surface-variant" />
            <SelectValue placeholder={t('coupons.filterByStore')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('coupons.allStores')}</SelectItem>
            {availableStores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {locale === 'ar' ? store.name_ar : store.name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Discount type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-10 w-full sm:w-[200px]">
            <Tag className="me-2 h-4 w-4 text-on-surface-variant" />
            <SelectValue placeholder={t('coupons.filterByType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('coupons.allTypes')}</SelectItem>
            <SelectItem value="percentage">{t('coupons.percentage')}</SelectItem>
            <SelectItem value="fixed_amount">{t('coupons.fixedAmount')}</SelectItem>
            <SelectItem value="free_shipping">{t('coupons.freeShipping')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="h-10 w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t('coupons.sortNewest')}</SelectItem>
            <SelectItem value="discount">{t('coupons.sortHighestDiscount')}</SelectItem>
            <SelectItem value="expiring">{t('coupons.sortExpiringSoon')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredCoupons.length === 0 && (
        <EmptyState
          icon={<Ticket className="h-12 w-12" />}
          title={t('coupons.noCoupons')}
          description={t('coupons.noCouponsDesc')}
        />
      )}

      {/* Coupon cards grid */}
      {!loading && !error && filteredCoupons.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCoupons.map((coupon) => {
            const storeName = coupon.stores
              ? locale === 'ar'
                ? coupon.stores.name_ar
                : coupon.stores.name_en
              : '';
            const productName = coupon.products
              ? locale === 'ar'
                ? coupon.products.name_ar
                : coupon.products.name_en
              : null;

            return (
              <Card
                key={coupon.id}
                className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Store header */}
                  <div className="flex items-center gap-3">
                    {coupon.stores?.logo_url ? (
                      <Image
                        src={coupon.stores.logo_url}
                        alt={storeName}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full border border-gray-200 object-contain dark:border-gray-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                        <Store className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {storeName}
                      </p>
                    </div>
                  </div>

                  {/* Coupon badge (expanded) */}
                  <CouponBadge
                    coupon={{
                      id: coupon.id,
                      code: coupon.code,
                      description_ar: coupon.description_ar,
                      description_en: coupon.description_en,
                      discount_type: coupon.discount_type,
                      discount_value: coupon.discount_value,
                      min_purchase: coupon.min_purchase,
                      max_discount: coupon.max_discount,
                      expires_at: coupon.expires_at,
                      store_name_ar: coupon.stores?.name_ar,
                      store_name_en: coupon.stores?.name_en,
                    }}
                    variant="expanded"
                    locale={locale}
                  />

                  {/* Product-specific or store-wide badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    {coupon.product_id && productName ? (
                      <>
                        <Badge
                          variant="outline"
                          className="border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        >
                          {t('coupons.productSpecific')}
                        </Badge>
                        <span className="truncate text-xs text-gray-600 dark:text-gray-400">
                          {productName}
                        </span>
                      </>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      >
                        {t('coupons.storeWide')}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
