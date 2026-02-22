'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { CouponBadge } from '@/components/ui/coupon-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Clock, Search, Sparkles, Store, Tag, Ticket, TimerReset } from 'lucide-react';
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
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchErrorFallback =
    locale === 'ar' ? 'تعذر تحميل الكوبونات حالياً.' : 'Failed to load coupons right now.';

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError(fetchErrorFallback);
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
        setError(err instanceof Error ? err.message : fetchErrorFallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchCoupons();

    return () => {
      cancelled = true;
    };
  }, [supabase, fetchErrorFallback]);

  const availableStores = useMemo(() => {
    const storeMap = new Map<string, StoreSummary>();
    coupons.forEach((coupon) => {
      if (coupon.stores && !storeMap.has(coupon.stores.id)) {
        storeMap.set(coupon.stores.id, coupon.stores);
      }
    });
    return Array.from(storeMap.values());
  }, [coupons]);

  const filteredCoupons = useMemo(() => {
    let result = [...coupons];

    if (storeFilter !== 'all') {
      result = result.filter((c) => c.store_id === storeFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter((c) => c.discount_type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => {
        const storeName = c.stores
          ? (c.stores.name_ar + ' ' + c.stores.name_en).toLowerCase()
          : '';
        const desc = ((c.description_ar || '') + ' ' + (c.description_en || '')).toLowerCase();
        return (
          c.code.toLowerCase().includes(q) ||
          storeName.includes(q) ||
          desc.includes(q)
        );
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'discount') {
        return b.discount_value - a.discount_value;
      }
      const aExpiry = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
      const bExpiry = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
      return aExpiry - bExpiry;
    });

    return result;
  }, [coupons, storeFilter, typeFilter, sortBy, searchQuery]);

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

  const handleReset = () => {
    setSortBy('newest');
    setStoreFilter('all');
    setTypeFilter('all');
    setSearchInput('');
    setSearchQuery('');
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const activeSortLabel =
    sortBy === 'newest'
      ? t('coupons.sortNewest')
      : sortBy === 'discount'
        ? t('coupons.sortHighestDiscount')
        : t('coupons.sortExpiringSoon');

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-emerald-500/15 via-white to-teal-500/10 p-5 shadow-sm dark:border-gray-800 dark:from-emerald-500/20 dark:via-gray-900 dark:to-teal-500/20 md:p-7">
        <div className="pointer-events-none absolute -end-16 -top-14 h-44 w-44 rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-400/20" />
        <div className="pointer-events-none absolute -bottom-20 start-1/4 h-44 w-44 rounded-full bg-teal-500/15 blur-3xl dark:bg-teal-400/20" />

        <div className="relative z-10 space-y-5">
          <div>
            <Badge
              variant="outline"
              className="mb-3 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              <Sparkles className="me-1 h-3.5 w-3.5" />
              {t('coupons.featured')}
            </Badge>

            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 md:text-3xl">
              {t('coupons.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
              {t('coupons.subtitle')}
            </p>
          </div>

          {/* Search bar */}
          <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-3 shadow-sm dark:border-emerald-800/70 dark:bg-gray-900/80 md:p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Search className="h-3.5 w-3.5" />
              <span>{t('coupons.searchHelper')}</span>
            </div>
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder={t('coupons.searchPlaceholder')}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-11 rounded-xl border-emerald-200 bg-white ps-9 dark:border-emerald-800/70 dark:bg-gray-950/70"
                />
              </div>
              <Button type="submit" className="h-11 rounded-xl px-5">
                {t('coupons.searchAction')}
              </Button>
            </form>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('coupons.searchHint')}</p>
          </div>

          {/* Quick action cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-gray-700 dark:bg-gray-900/75">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <Store className="h-4.5 w-4.5" />
              </div>
              <div>
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                  <SelectTrigger className="h-9 w-full border-gray-200 dark:border-gray-700">
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
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-gray-700 dark:bg-gray-900/75">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                <Tag className="h-4.5 w-4.5" />
              </div>
              <div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 w-full border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder={t('coupons.filterByType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('coupons.allTypes')}</SelectItem>
                    <SelectItem value="percentage">{t('coupons.percentage')}</SelectItem>
                    <SelectItem value="fixed_amount">{t('coupons.fixedAmount')}</SelectItem>
                    <SelectItem value="free_shipping">{t('coupons.freeShipping')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="group rounded-2xl border border-gray-200 bg-white/90 p-4 text-start transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-gray-600"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <TimerReset className="h-4.5 w-4.5" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('coupons.resetFilters')}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('coupons.resetHint')}</p>
            </button>
          </div>
        </div>

        {/* Stats row inside hero */}
        <div className="relative z-10 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <Ticket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <Badge variant="outline">{t('coupons.totalActive')}</Badge>
            </div>
            <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {loading ? <Skeleton className="h-8 w-12 inline-block" /> : activeCouponsCount}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <Tag className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <Badge variant="outline">{t('coupons.highestDiscount')}</Badge>
            </div>
            <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {loading ? (
                <Skeleton className="h-8 w-12 inline-block" />
              ) : highestDiscount > 0 ? (
                `${highestDiscount}%`
              ) : (
                '—'
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <Badge variant="outline">{t('coupons.expiringSoon')}</Badge>
            </div>
            <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {loading ? <Skeleton className="h-8 w-12 inline-block" /> : expiringSoonCount}
            </div>
          </div>
        </div>
      </section>

      {/* Results bar */}
      <section className="rounded-2xl border border-gray-200 bg-white/85 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/20 dark:text-emerald-200">
              <Ticket className="h-4 w-4" />
              <span>
                {filteredCoupons.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{' '}
                {t('coupons.resultsCount')}
              </span>
            </div>
            <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
              {t('coupons.sortBy')}: {activeSortLabel}
            </Badge>
            {searchQuery && (
              <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
                {searchQuery}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/85 p-2 dark:border-gray-700 dark:bg-gray-900/80">
            <label className="px-1 text-sm text-on-surface-variant">{t('coupons.sortBy')}:</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-9 w-[190px] border-gray-200 dark:border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('coupons.sortNewest')}</SelectItem>
                <SelectItem value="discount">{t('coupons.sortHighestDiscount')}</SelectItem>
                <SelectItem value="expiring">{t('coupons.sortExpiringSoon')}</SelectItem>
              </SelectContent>
            </Select>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                }}
                className="h-9 rounded-lg"
              >
                <TimerReset className="me-2 h-4 w-4" />
                {t('coupons.clearSearch')}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-4">
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {!loading && !error && filteredCoupons.length === 0 && (
        <EmptyState
          icon={<Ticket className="h-12 w-12" />}
          title={t('coupons.noCoupons')}
          description={searchQuery ? t('coupons.noCouponsDesc') : undefined}
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
              <div
                key={coupon.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/75"
              >
                <div className="space-y-4">
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
