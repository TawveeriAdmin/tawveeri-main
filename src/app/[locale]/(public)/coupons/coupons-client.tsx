'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
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
import { AlertCircle, Clock, Percent, RotateCcw, Search, SlidersHorizontal, Sparkles, Store, Tag, Ticket } from 'lucide-react';
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

export default function CouponsClient() {
  const [supabase] = useState(() =>
    typeof window !== 'undefined' ? getSupabaseBrowserClient() : null
  );
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const isRTL = locale === 'ar';

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

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,rgba(45,178,139,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,1),rgba(244,249,247,1))] p-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(45,178,139,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,1),rgba(3,7,18,1))] md:p-7 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--brand-green-dark)] shadow-sm dark:bg-gray-900/80 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t('coupons.featured')}
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-normal text-gray-950 dark:text-white md:text-4xl">
              {t('coupons.title')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              {t('coupons.subtitle')}
            </p>
            <form onSubmit={handleSearchSubmit} className="mt-6 flex max-w-2xl flex-col gap-2 rounded-[1.5rem] border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder={t('coupons.searchPlaceholder')}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-12 rounded-2xl border-0 bg-gray-50 ps-11 shadow-none dark:bg-gray-900"
                />
              </div>
              <Button type="submit" className="h-12 rounded-2xl px-6">
                {t('coupons.searchAction')}
              </Button>
            </form>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              {
                label: t('coupons.totalActive'),
                value: loading ? '...' : activeCouponsCount.toLocaleString(isRTL ? 'ar-SA' : 'en-US'),
                icon: Ticket,
                className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
              },
              {
                label: t('coupons.highestDiscount'),
                value: loading ? '...' : highestDiscount > 0 ? `${highestDiscount}%` : '-',
                icon: Percent,
                className: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
              },
              {
                label: t('coupons.expiringSoon'),
                value: loading ? '...' : expiringSoonCount.toLocaleString(isRTL ? 'ar-SA' : 'en-US'),
                icon: Clock,
                className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
              },
            ].map(({ label, value, icon: Icon, className }) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-gray-950 dark:text-white">{value}</p>
                  <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
                </div>
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${className}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-950 dark:text-white">{t('coupons.availableCoupons')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('coupons.searchHelper')}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:flex lg:items-center">
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 lg:w-[180px]">
                <Store className="me-1.5 h-4 w-4 shrink-0 text-gray-400" />
                <SelectValue placeholder={t('coupons.filterByStore')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('coupons.allStores')}</SelectItem>
                {availableStores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {isRTL ? store.name_ar : store.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 lg:w-[170px]">
                <Tag className="me-1.5 h-4 w-4 shrink-0 text-gray-400" />
                <SelectValue placeholder={t('coupons.filterByType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('coupons.allTypes')}</SelectItem>
                <SelectItem value="percentage">{t('coupons.percentage')}</SelectItem>
                <SelectItem value="fixed_amount">{t('coupons.fixedAmount')}</SelectItem>
                <SelectItem value="free_shipping">{t('coupons.freeShipping')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 lg:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('coupons.sortNewest')}</SelectItem>
                <SelectItem value="discount">{t('coupons.sortHighestDiscount')}</SelectItem>
                <SelectItem value="expiring">{t('coupons.sortExpiringSoon')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-gray-50 px-3 py-1.5 font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-300">
            {filteredCoupons.length.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {t('coupons.resultsCount')}
          </span>
          {searchQuery && (
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              &ldquo;{searchQuery}&rdquo;
              <button
                type="button"
                onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                className="ms-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ×
              </button>
            </Badge>
          )}
          {(storeFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 rounded-full px-3">
              <RotateCcw className="me-1.5 h-3.5 w-3.5" />
              {t('coupons.resetFilters')}
            </Button>
          )}
        </div>
      </section>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-3xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-2xl" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-4 w-16" />
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
          description={searchQuery ? t('coupons.noCouponsDesc') : t('coupons.noCouponsDescription')}
        />
      )}

      {/* Coupon cards grid */}
      {!loading && !error && filteredCoupons.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-green)]/40 hover:shadow-md dark:border-gray-800 dark:bg-gray-950"
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
                        className="h-10 w-10 rounded-2xl border border-gray-200 object-contain p-1 dark:border-gray-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                        <Store className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-950 dark:text-white">
                        {storeName}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {coupon.product_id && productName ? t('coupons.productSpecific') : t('coupons.storeWide')}
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
