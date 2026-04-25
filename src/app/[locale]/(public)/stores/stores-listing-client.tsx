'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { StoreCard } from '@/components/stores/store-card';
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
import { AlertCircle, Search, Store, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/lib/database/types';

type StoreRow = Database['public']['Tables']['stores']['Row'];
type StoreSummary = Pick<
  StoreRow,
  | 'id'
  | 'name_ar'
  | 'name_en'
  | 'slug'
  | 'logo_url'
  | 'website_url'
  | 'average_rating'
  | 'total_reviews'
  | 'total_products'
  | 'is_featured'
  | 'is_premium'
  | 'status'
>;

type SortOption = 'name' | 'rating' | 'products';
type StoreFilter = 'all' | 'featured' | 'premium';

export default function StoresListingClient() {
  const [supabase] = useState(() =>
    typeof window !== 'undefined' ? getSupabaseBrowserClient() : null,
  );
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const t = useTranslations();

  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all');
  const [filteredStores, setFilteredStores] = useState<StoreSummary[]>([]);

  const fetchErrorFallback = isRTL
    ? 'تعذر تحميل بيانات المتاجر حالياً.'
    : 'Failed to load stores right now.';

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError(fetchErrorFallback);
      return;
    }

    let cancelled = false;

    async function fetchStores() {
      // Re-capture the client inside the closure so TS narrows the union.
      const sb = supabase;
      if (!sb) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await sb
          .from('stores')
          .select('*')
          .eq('status', 'active')
          .order('is_featured', { ascending: false })
          .order('average_rating', { ascending: false })
          .returns<StoreRow[]>();

        if (queryError) throw queryError;

        const mapped: StoreSummary[] = (data || []).map((s) => ({
          id: s.id,
          name_ar: s.name_ar,
          name_en: s.name_en,
          slug: s.slug,
          logo_url: s.logo_url,
          website_url: s.website_url,
          average_rating: s.average_rating,
          total_reviews: s.total_reviews,
          total_products: s.total_products,
          is_featured: s.is_featured,
          is_premium: s.is_premium,
          status: s.status,
        }));

        if (cancelled) return;
        setStores(mapped);
        setFilteredStores(mapped);

        // Fire one parallel count query per store to overwrite the (often
        // stale) DB total with a live active-product count. Keeps cards
        // from showing "0 products" when rows actually exist.
        const counts = await Promise.all(
          mapped.map(async (store) => {
            const { count } = await sb
              .from('product_stores')
              .select('id, products!inner(is_active)', { count: 'exact', head: true })
              .eq('store_id', store.id)
              .eq('products.is_active', true);
            return [store.id, count ?? 0] as const;
          }),
        );

        if (cancelled) return;
        const countMap = new Map(counts);
        const withCounts = mapped.map((s) => ({
          ...s,
          total_products: countMap.get(s.id) ?? s.total_products ?? 0,
        }));
        setStores(withCounts);
        setFilteredStores(withCounts);
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching stores:', err);
        const msg = err instanceof Error ? err.message : fetchErrorFallback;
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchStores();
    return () => { cancelled = true; };
  }, [supabase, fetchErrorFallback]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = [...stores];

    if (q) {
      result = result.filter(
        (s) => s.name_ar.toLowerCase().includes(q) || s.name_en.toLowerCase().includes(q),
      );
    }
    if (storeFilter === 'featured') result = result.filter((s) => Boolean(s.is_featured));
    if (storeFilter === 'premium') result = result.filter((s) => Boolean(s.is_premium));

    result.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = isRTL ? a.name_ar : a.name_en;
        const nameB = isRTL ? b.name_ar : b.name_en;
        return nameA.localeCompare(nameB, locale);
      }
      if (sortBy === 'rating') return (b.average_rating ?? 0) - (a.average_rating ?? 0);
      return (b.total_products ?? 0) - (a.total_products ?? 0);
    });

    setFilteredStores(result);
  }, [stores, searchQuery, sortBy, locale, storeFilter, isRTL]);

  const featuredCount = useMemo(
    () => filteredStores.filter((s) => Boolean(s.is_featured)).length,
    [filteredStores],
  );
  const premiumCount = useMemo(
    () => filteredStores.filter((s) => Boolean(s.is_premium)).length,
    [filteredStores],
  );
  const productsTotal = useMemo(
    () => filteredStores.reduce((sum, s) => sum + (s.total_products ?? 0), 0),
    [filteredStores],
  );

  const handleReset = () => {
    setSearchInput('');
    setSearchQuery('');
    setSortBy('rating');
    setStoreFilter('all');
  };

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const hasActiveFilters = storeFilter !== 'all' || searchQuery;

  return (
    <div className="space-y-5">
      {/* Page header — everything on one row at lg+:
            [Title (start)]  ──  [Search (middle)]  ──  [Controls (end)]
          `justify-between` pins the first item to the inline-start, the
          last to the inline-end, and the middle item sits between them
          with equal gaps. On small screens `flex-wrap` takes over and the
          search drops to its own row via `order-last`. */}
      <div className="flex flex-wrap items-center gap-4 lg:flex-nowrap lg:justify-between">
        {/* Title + meta — doesn't grow */}
        <div className="min-w-0 shrink-0">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-on-surface">
            {t('stores.title')}
            <span className="ms-2 text-sm font-semibold text-on-surface-variant tabular-nums">
              ({loading ? '…' : filteredStores.length.toLocaleString(isRTL ? 'ar-SA' : 'en-US')})
            </span>
          </h1>
          <p className="mt-1 text-xs text-on-surface-variant">
            {loading
              ? t('stores.subtitle')
              : [
                  featuredCount > 0 && `${featuredCount.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ${isRTL ? 'مميزة' : 'featured'}`,
                  premiumCount > 0 && `${premiumCount.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ${isRTL ? 'بريميوم' : 'premium'}`,
                  productsTotal > 0 && `${productsTotal.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ${isRTL ? 'منتج' : 'products'}`,
                ].filter(Boolean).join(isRTL ? ' · ' : ' · ') || t('stores.subtitle')}
          </p>
        </div>

        {/* Compact centered search — fixed max width, no flex-grow. The
            parent's `justify-between` drops it in the middle at lg+. On
            narrow screens `order-last` + `w-full` makes it the last
            wrapped row so title and controls stay together on top. */}
        <form
          onSubmit={onSearchSubmit}
          className="order-last w-full min-w-0 lg:order-none lg:w-80 lg:flex-none"
        >
          <div className="relative flex h-9 items-stretch overflow-hidden rounded-full border border-outline-variant bg-surface-container-lowest transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <Search
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('stores.searchPlaceholder')}
              aria-label={t('stores.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent ps-9 pe-2 text-xs text-on-surface placeholder:text-on-surface-variant/70 outline-none"
            />
            <button
              type="submit"
              aria-label={isRTL ? 'بحث' : 'Search'}
              className="inline-flex h-full w-10 shrink-0 items-center justify-center bg-primary text-on-primary transition-colors hover:bg-primary-600"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </div>
        </form>

        {/* Controls — filter chips + sort + reset. The parent's
            `justify-between` pins this block to the inline-end at lg+. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low p-0.5">
            {(['all', 'featured', 'premium'] as const).map((filter) => {
              const active = storeFilter === filter;
              const label =
                filter === 'all'
                  ? (isRTL ? 'الكل' : 'All')
                  : filter === 'featured'
                    ? (isRTL ? 'مميزة' : 'Featured')
                    : (isRTL ? 'بريميوم' : 'Premium');
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStoreFilter(filter)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-9 w-[140px] rounded-full border-outline-variant bg-surface-container-low text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">{t('stores.sortRating')}</SelectItem>
              <SelectItem value="products">{t('stores.sortProducts')}</SelectItem>
              <SelectItem value="name">{t('stores.sortName')}</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              aria-label={isRTL ? 'تصفير' : 'Reset'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Active-search indicator — only when there's a live query */}
      {searchQuery && (
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span>{isRTL ? 'نتائج البحث عن' : 'Results for'}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            &ldquo;{searchQuery}&rdquo;
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearchQuery(''); }}
              aria-label={isRTL ? 'مسح البحث' : 'Clear search'}
              className="inline-flex items-center justify-center rounded-full p-0.5 transition-colors hover:bg-primary-100 dark:hover:bg-primary-800/40"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* ─────────────── States ─────────────── */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-6"
            >
              <Skeleton className="h-20 w-20 rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="mt-4 h-9 w-full rounded-full" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && filteredStores.length === 0 && (
        <EmptyState
          icon={<Store className="h-12 w-12" />}
          title={t('stores.noStores')}
          description={searchQuery ? t('stores.noStoresMatch', { query: searchQuery }) : undefined}
        />
      )}

      {!loading && !error && filteredStores.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStores.map((store) => (
            <StoreCard key={store.id} store={store} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

