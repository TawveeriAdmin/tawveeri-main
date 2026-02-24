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

export default function CouponsClient() {
  const [supabase] = useState(() =>
    typeof window !== 'undefined' ? getSupabaseBrowserClient() : null
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

  return (
    <div className="space-y-4">
      {/* Compact header: title + search + filters + stats all in one card */}
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-emerald-500/15 via-white to-teal-500/10 p-4 shadow-sm dark:border-gray-800 dark:from-emerald-500/20 dark:via-gray-900 dark:to-teal-500/20 md:p-5">
        <div className="pointer-events-none absolute -end-16 -top-14 h-36 w-36 rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-400/20" />

        <div className="relative z-10 space-y-4">
          {/* Title row */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 md:text-2xl">
                  {t('coupons.title')}
                </h1>
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  <Sparkles className="me-1 h-3 w-3" />
                  {t('coupons.featured')}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                {t('coupons.subtitle')}
              </p>
            </div>
            {/* Inline stats */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-900/75">
                <Ticket className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '…' : activeCouponsCount}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('coupons.totalActive')}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-900/75">
                <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '…' : highestDiscount > 0 ? `${highestDiscount}%` : '—'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('coupons.highestDiscount')}</span>
              </div>
              <div className="hidden items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-1.5 sm:flex dark:border-gray-700 dark:bg-gray-900/75">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '…' : expiringSoonCount}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('coupons.expiringSoon')}</span>
              </div>
            </div>
          </div>

          {/* Search + filters row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder={t('coupons.searchPlaceholder')}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-9 rounded-lg border-emerald-200 bg-white ps-9 dark:border-emerald-800/70 dark:bg-gray-950/70"
                />
              </div>
              <Button type="submit" size="sm" className="h-9 rounded-lg px-4">
                {t('coupons.searchAction')}
              </Button>
            </form>

            <div className="flex items-center gap-2">
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-9 w-[140px] border-gray-200 dark:border-gray-700">
                  <Store className="me-1.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
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

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[130px] border-gray-200 dark:border-gray-700">
                  <Tag className="me-1.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
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
                <SelectTrigger className="h-9 w-[140px] border-gray-200 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('coupons.sortNewest')}</SelectItem>
                  <SelectItem value="discount">{t('coupons.sortHighestDiscount')}</SelectItem>
                  <SelectItem value="expiring">{t('coupons.sortExpiringSoon')}</SelectItem>
                </SelectContent>
              </Select>

              {(storeFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-9 px-2">
                  <TimerReset className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Active filters / results count */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {filteredCoupons.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{' '}
              {t('coupons.resultsCount')}
            </span>
            {searchQuery && (
              <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs">
                &ldquo;{searchQuery}&rdquo;
                <button
                  onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                  className="ms-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        </div>
      </section>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
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
          description={searchQuery ? t('coupons.noCouponsDesc') : undefined}
        />
      )}

      {/* Coupon cards grid */}
      {!loading && !error && filteredCoupons.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                className="overflow-hidden rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/75"
              >
                <div className="space-y-2.5">
                  {/* Store header */}
                  <div className="flex items-center gap-2">
                    {coupon.stores?.logo_url ? (
                      <Image
                        src={coupon.stores.logo_url}
                        alt={storeName}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full border border-gray-200 object-contain dark:border-gray-700"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                        <Store className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                    )}
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {storeName}
                    </p>
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
