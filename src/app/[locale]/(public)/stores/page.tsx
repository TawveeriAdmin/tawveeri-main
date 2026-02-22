'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Search, ShieldCheck, Sparkles, Store } from 'lucide-react';
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

export default function StoresPage() {
  const supabase = useMemo(
    () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
    []
  );
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();

  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all');
  const [filteredStores, setFilteredStores] = useState<StoreSummary[]>([]);

  const fetchErrorFallback =
    locale === 'ar' ? 'تعذر تحميل بيانات المتاجر حالياً.' : 'Failed to load stores right now.';

  const uiCopy = useMemo(
    () =>
      locale === 'ar'
        ? {
            featured: 'شبكة متاجر موثوقة وتجربة اكتشاف سريعة',
            searchAction: 'بحث',
            searchHelper: 'ابحث عن المتجر المناسب بسرعة',
            searchHint: 'اكتب اسم المتجر للعثور عليه فوراً',
            featuredStores: 'متاجر مميزة',
            premiumStores: 'متاجر بريميوم',
            totalProducts: 'إجمالي المنتجات',
            allStores: 'كل المتاجر',
            allStoresHint: 'عرض جميع المتاجر بدون فلترة',
            featuredHint: 'متاجر موصى بها مع تقييمات قوية',
            premiumHint: 'متاجر موثقة بتجربة أعلى',
            filterAll: 'الكل',
            filterFeatured: 'مميزة',
            filterPremium: 'بريميوم',
            reset: 'تصفير',
            resetHint: 'إرجاع الفلاتر والبحث إلى الوضع الافتراضي',
            clearSearch: 'مسح البحث',
          }
        : {
            featured: 'Trusted Store Network with Fast Discovery',
            searchAction: 'Search',
            searchHelper: 'Find the right store quickly',
            searchHint: 'Type a store name to jump to it instantly',
            featuredStores: 'Featured Stores',
            premiumStores: 'Premium Stores',
            totalProducts: 'Total Products',
            allStores: 'All Stores',
            allStoresHint: 'Show all stores with no filtering',
            featuredHint: 'Recommended stores with strong ratings',
            premiumHint: 'Verified stores with higher trust',
            filterAll: 'All',
            filterFeatured: 'Featured',
            filterPremium: 'Premium',
            reset: 'Reset',
            resetHint: 'Return filters and search to default',
            clearSearch: 'Clear Search',
          },
    [locale]
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError(fetchErrorFallback);
      return;
    }

    let cancelled = false;

    async function fetchStores() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('stores')
          .select('*')
          .eq('status', 'active')
          .order('is_featured', { ascending: false })
          .order('average_rating', { ascending: false })
          .returns<StoreRow[]>();

        if (queryError) throw queryError;

        const mappedStores: StoreSummary[] = (data || []).map((store) => ({
          id: store.id,
          name_ar: store.name_ar,
          name_en: store.name_en,
          slug: store.slug,
          logo_url: store.logo_url,
          website_url: store.website_url,
          average_rating: store.average_rating,
          total_reviews: store.total_reviews,
          total_products: store.total_products,
          is_featured: store.is_featured,
          is_premium: store.is_premium,
          status: store.status,
        }));

        if (cancelled) return;

        setStores(mappedStores);
        setFilteredStores(mappedStores);
      } catch (err) {
        if (cancelled) return;

        console.error('Error fetching stores:', err);
        const errorMessage = err instanceof Error ? err.message : fetchErrorFallback;
        setError(errorMessage);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    void fetchStores();

    return () => {
      cancelled = true;
    };
  }, [supabase, fetchErrorFallback]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    let result = [...stores];

    if (normalizedQuery) {
      result = result.filter(
        (store) =>
          store.name_ar.toLowerCase().includes(normalizedQuery) ||
          store.name_en.toLowerCase().includes(normalizedQuery)
      );
    }

    if (storeFilter === 'featured') {
      result = result.filter((store) => Boolean(store.is_featured));
    } else if (storeFilter === 'premium') {
      result = result.filter((store) => Boolean(store.is_premium));
    }

    result.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = locale === 'ar' ? a.name_ar : a.name_en;
        const nameB = locale === 'ar' ? b.name_ar : b.name_en;
        return nameA.localeCompare(nameB, locale);
      }

      if (sortBy === 'rating') {
        const ratingA = a.average_rating || 0;
        const ratingB = b.average_rating || 0;
        return ratingB - ratingA;
      }

      const productsA = a.total_products || 0;
      const productsB = b.total_products || 0;
      return productsB - productsA;
    });

    setFilteredStores(result);
  }, [stores, searchQuery, sortBy, locale, storeFilter]);

  const featuredCount = useMemo(
    () => filteredStores.filter((store) => Boolean(store.is_featured)).length,
    [filteredStores]
  );

  const premiumCount = useMemo(
    () => filteredStores.filter((store) => Boolean(store.is_premium)).length,
    [filteredStores]
  );

  const productsTotal = useMemo(
    () => filteredStores.reduce((sum, store) => sum + (store.total_products || 0), 0),
    [filteredStores]
  );

  const handleReset = () => {
    setSearchInput('');
    setSearchQuery('');
    setSortBy('rating');
    setStoreFilter('all');
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const activeSortLabel =
    sortBy === 'name'
      ? t('stores.sortName')
      : sortBy === 'rating'
        ? t('stores.sortRating')
        : t('stores.sortProducts');

  const activeFilterLabel =
    storeFilter === 'all'
      ? uiCopy.filterAll
      : storeFilter === 'featured'
        ? uiCopy.filterFeatured
        : uiCopy.filterPremium;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-cyan-500/10 via-white to-blue-500/10 p-5 shadow-sm dark:border-gray-800 dark:from-cyan-500/20 dark:via-gray-900 dark:to-blue-500/20 md:p-7">
        <div className="pointer-events-none absolute -end-16 -top-14 h-44 w-44 rounded-full bg-cyan-500/20 blur-3xl dark:bg-cyan-400/20" />
        <div className="pointer-events-none absolute -bottom-20 start-1/4 h-44 w-44 rounded-full bg-blue-500/15 blur-3xl dark:bg-blue-400/20" />

        <div className="relative z-10 space-y-5">
          <div>
            <Badge
              variant="outline"
              className="mb-3 border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
            >
              <Sparkles className="me-1 h-3.5 w-3.5" />
              {uiCopy.featured}
            </Badge>

            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 md:text-3xl">
              {t('stores.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
              {t('stores.subtitle')}
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-200/70 bg-white/90 p-3 shadow-sm dark:border-cyan-800/70 dark:bg-gray-900/80 md:p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              <Search className="h-3.5 w-3.5" />
              <span>{uiCopy.searchHelper}</span>
            </div>
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder={t('stores.searchPlaceholder')}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-11 rounded-xl border-cyan-200 bg-white/90 ps-9 dark:border-cyan-800/70 dark:bg-gray-950/70"
                />
              </div>
              <Button type="submit" className="h-11 rounded-xl px-5">
                {uiCopy.searchAction}
              </Button>
            </form>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{uiCopy.searchHint}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => setStoreFilter('all')}
              className={`group rounded-2xl border p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                storeFilter === 'all'
                  ? 'border-cyan-300 bg-cyan-50/80 dark:border-cyan-700 dark:bg-cyan-900/20'
                  : 'border-gray-200 bg-white/90 hover:border-cyan-200 dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-cyan-700/60'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                  <Store className="h-4.5 w-4.5" />
                </div>
                <Badge variant="outline">{stores.length}</Badge>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{uiCopy.allStores}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.allStoresHint}</p>
            </button>

            <button
              onClick={() => setStoreFilter('featured')}
              className={`group rounded-2xl border p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                storeFilter === 'featured'
                  ? 'border-cyan-300 bg-cyan-50/80 dark:border-cyan-700 dark:bg-cyan-900/20'
                  : 'border-gray-200 bg-white/90 hover:border-cyan-200 dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-cyan-700/60'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <Badge variant="outline">{featuredCount}</Badge>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{uiCopy.filterFeatured}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.featuredHint}</p>
            </button>

            <button
              onClick={() => setStoreFilter('premium')}
              className={`group rounded-2xl border p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                storeFilter === 'premium'
                  ? 'border-cyan-300 bg-cyan-50/80 dark:border-cyan-700 dark:bg-cyan-900/20'
                  : 'border-gray-200 bg-white/90 hover:border-cyan-200 dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-cyan-700/60'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <Badge variant="outline">{premiumCount}</Badge>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{uiCopy.filterPremium}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.premiumHint}</p>
            </button>

            <button
              onClick={handleReset}
              className="group rounded-2xl border border-gray-200 bg-white/90 p-4 text-start transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-gray-600"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Search className="h-4.5 w-4.5" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{uiCopy.reset}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.resetHint}</p>
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <Store className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <Badge variant="outline">{uiCopy.filterAll}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {filteredStores.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <Sparkles className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <Badge variant="outline">{uiCopy.featuredStores}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{featuredCount}</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <Badge variant="outline">{uiCopy.premiumStores}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{premiumCount}</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <Badge variant="outline">{uiCopy.totalProducts}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {productsTotal.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white/85 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/70 bg-cyan-50/60 px-3 py-1.5 text-sm font-medium text-cyan-700 dark:border-cyan-800/70 dark:bg-cyan-900/20 dark:text-cyan-200">
              <Store className="h-4 w-4" />
              <span>
                {filteredStores.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{' '}
                {t('stores.resultsCount')}
              </span>
            </div>
            <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
              {t('stores.sortBy')}: {activeSortLabel}
            </Badge>
            <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
              {activeFilterLabel}
            </Badge>
            {searchQuery && (
              <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
                {searchQuery}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/85 p-2 dark:border-gray-700 dark:bg-gray-900/80">
            <label className="px-1 text-sm text-on-surface-variant">{t('stores.sortBy')}:</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-9 w-[190px] border-gray-200 dark:border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('stores.sortName')}</SelectItem>
                <SelectItem value="rating">{t('stores.sortRating')}</SelectItem>
                <SelectItem value="products">{t('stores.sortProducts')}</SelectItem>
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
                {uiCopy.clearSearch}
              </Button>
            )}
            {!searchQuery && (
              <div className="inline-flex h-9 items-center rounded-lg px-3 text-xs text-on-surface-variant">
                {uiCopy.reset}
              </div>
            )}
          </div>
        </div>

        {!loading && !error && searchQuery && (
          <div className="mt-3 text-xs text-on-surface-variant">
            {locale === 'ar'
              ? 'نتائج مطابقة لاسم المتجر الذي أدخلته'
              : 'Showing stores that match your search'}
          </div>
        )}
      </section>

      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-4">
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="mx-auto h-4 w-3/4" />
              <Skeleton className="mx-auto h-4 w-1/2" />
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
          description={
            searchQuery ? t('stores.noStoresMatch', { query: searchQuery }) : undefined
          }
        />
      )}

      {!loading && !error && filteredStores.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStores.map((store) => (
            <StoreCard key={store.id} store={store} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
