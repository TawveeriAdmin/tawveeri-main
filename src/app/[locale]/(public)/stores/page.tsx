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

  return (
    <div className="space-y-4">
      {/* Compact header */}
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-cyan-500/10 via-white to-blue-500/10 p-4 shadow-sm dark:border-gray-800 dark:from-cyan-500/20 dark:via-gray-900 dark:to-blue-500/20 md:p-5">
        <div className="pointer-events-none absolute -end-16 -top-14 h-36 w-36 rounded-full bg-cyan-500/20 blur-3xl dark:bg-cyan-400/20" />

        <div className="relative z-10 space-y-4">
          {/* Title + inline stats */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 md:text-2xl">
                  {t('stores.title')}
                </h1>
                <Badge
                  variant="outline"
                  className="border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
                >
                  <Sparkles className="me-1 h-3 w-3" />
                  {uiCopy.featured}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                {t('stores.subtitle')}
              </p>
            </div>
            {/* Inline stats */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-900/75">
                <Store className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '…' : filteredStores.length}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{uiCopy.filterAll}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-900/75">
                <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '…' : featuredCount}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{uiCopy.featuredStores}</span>
              </div>
              <div className="hidden items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-1.5 sm:flex dark:border-gray-700 dark:bg-gray-900/75">
                <ShieldCheck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '…' : premiumCount}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{uiCopy.premiumStores}</span>
              </div>
              <div className="hidden items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-1.5 md:flex dark:border-gray-700 dark:bg-gray-900/75">
                <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '…' : productsTotal.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{uiCopy.totalProducts}</span>
              </div>
            </div>
          </div>

          {/* Search + filters + sort row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder={t('stores.searchPlaceholder')}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-9 rounded-lg border-cyan-200 bg-white ps-9 dark:border-cyan-800/70 dark:bg-gray-950/70"
                />
              </div>
              <Button type="submit" size="sm" className="h-9 rounded-lg px-4">
                {uiCopy.searchAction}
              </Button>
            </form>

            <div className="flex items-center gap-2">
              {/* Filter chips */}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
                {(['all', 'featured', 'premium'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStoreFilter(filter)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      storeFilter === filter
                        ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {filter === 'all' ? uiCopy.filterAll : filter === 'featured' ? uiCopy.filterFeatured : uiCopy.filterPremium}
                  </button>
                ))}
              </div>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="h-9 w-[140px] border-gray-200 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t('stores.sortName')}</SelectItem>
                  <SelectItem value="rating">{t('stores.sortRating')}</SelectItem>
                  <SelectItem value="products">{t('stores.sortProducts')}</SelectItem>
                </SelectContent>
              </Select>

              {(storeFilter !== 'all' || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-9 px-2">
                  <Search className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {filteredStores.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{' '}
              {t('stores.resultsCount')}
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

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStores.map((store) => (
            <StoreCard key={store.id} store={store} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
