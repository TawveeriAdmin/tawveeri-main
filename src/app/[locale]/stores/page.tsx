'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { StoreCard } from '@/components/stores/store-card';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, AlertCircle, Store } from 'lucide-react';
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

export default function StoresPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const supabase = getSupabaseBrowserClient();

  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [filteredStores, setFilteredStores] = useState<StoreSummary[]>([]);

  useEffect(() => {
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

        setStores(mappedStores);
        setFilteredStores(mappedStores);
      } catch (err) {
        console.error('Error fetching stores:', err);
        const errorMessage = err instanceof Error ? err.message : t('stores.error');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchStores();
  }, [t]);

  // Filter and sort stores
  useEffect(() => {
    let result = [...stores];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (store: StoreSummary) =>
          store.name_ar.toLowerCase().includes(query) ||
          store.name_en.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = locale === 'ar' ? a.name_ar : a.name_en;
        const nameB = locale === 'ar' ? b.name_ar : b.name_en;
        return nameA.localeCompare(nameB, locale);
      } else if (sortBy === 'rating') {
        const ratingA = a.average_rating || 0;
        const ratingB = b.average_rating || 0;
        return ratingB - ratingA;
      } else if (sortBy === 'products') {
        const productsA = a.total_products || 0;
        const productsB = b.total_products || 0;
        return productsB - productsA;
      }
      return 0;
    });

    setFilteredStores(result);
  }, [stores, searchQuery, sortBy, locale]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>{locale === 'ar' ? 'الرئيسية' : 'Home'}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('stores.title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('stores.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('stores.subtitle')}</p>
        </div>

        {/* Filters and Sort */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-auto sm:flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder={t('stores.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {t('stores.sortBy')}:
            </label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('stores.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('stores.sortName')}</SelectItem>
                <SelectItem value="rating">{t('stores.sortRating')}</SelectItem>
                <SelectItem value="products">{t('stores.sortProducts')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        {!loading && !error && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {filteredStores.length} {t('stores.resultsCount')}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !error && filteredStores.length === 0 && (
          <EmptyState
            icon={<Store className="h-12 w-12" />}
            title={t('stores.noStores')}
            description={
              searchQuery
                ? locale === 'ar'
                  ? `لا توجد متاجر تطابق "${searchQuery}"`
                  : `No stores match "${searchQuery}"`
                : undefined
            }
          />
        )}

        {/* Stores Grid */}
        {!loading && !error && filteredStores.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStores.map((store) => (
              <StoreCard key={store.id} store={store} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

