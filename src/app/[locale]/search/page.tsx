'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { ProductCard } from '@/components/products/product-card';
import type { ProductCardProduct } from '@/components/products/product-card';
import { SearchBar } from '@/components/search/search-bar';
import { SearchHistory } from '@/components/search/search-history';
import { FilterSidebar, type SearchFilters } from '@/components/search/filter-sidebar';
import { SavedSearches } from '@/components/search/saved-searches';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search, AlertCircle } from 'lucide-react';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';

type Product = ProductCardProduct & {
  product_stores: Array<{
    id: string;
    current_price: number;
    original_price: number | null;
    availability: AvailabilityStatus;
    stores: {
      id: string;
      name_ar: string;
      name_en: string;
      logo_url: string | null;
    };
  }>;
};

type SortOption = 'popularity' | 'price_low' | 'price_high' | 'rating';

const ITEMS_PER_PAGE = 24;

export default function SearchPage() {
  const supabase = getSupabaseBrowserClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addItem } = useMultiStoreCart();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [filters, setFilters] = useState<SearchFilters>({
    brands: [],
    stores: [],
    availability: [],
    dealsOnly: false,
    freeDeliveryOnly: false,
    minRating: undefined,
  });

  // Load filters from URL on mount
  useEffect(() => {
    const urlFilters: SearchFilters = {
      brands: searchParams.get('brands')?.split(',').filter(Boolean) || [],
      stores: searchParams.get('stores')?.split(',').filter(Boolean) || [],
      availability: (searchParams.get('availability')?.split(',').filter(Boolean) || []) as AvailabilityStatus[],
      dealsOnly: searchParams.get('deals') === 'true',
      freeDeliveryOnly: searchParams.get('freeDelivery') === 'true',
      minRating: searchParams.get('rating') ? parseFloat(searchParams.get('rating') || '0') : undefined,
    };
    setFilters(urlFilters);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filters.brands.length > 0) {
      params.set('brands', filters.brands.join(','));
    } else {
      params.delete('brands');
    }
    if (filters.stores.length > 0) {
      params.set('stores', filters.stores.join(','));
    } else {
      params.delete('stores');
    }
    if (filters.availability.length > 0) {
      params.set('availability', filters.availability.join(','));
    } else {
      params.delete('availability');
    }
    if (filters.dealsOnly) {
      params.set('deals', 'true');
    } else {
      params.delete('deals');
    }
    if (filters.freeDeliveryOnly) {
      params.set('freeDelivery', 'true');
    } else {
      params.delete('freeDelivery');
    }
    if (filters.minRating && filters.minRating > 0) {
      params.set('rating', filters.minRating.toString());
    } else {
      params.delete('rating');
    }
    router.replace(`/${locale}/search?${params.toString()}`, { scroll: false });
  }, [filters, locale, router]);

  const handleSearchSelect = (query: string, selectedFilters: SearchFilters) => {
    setSearchQuery(query);
    setFilters(selectedFilters);
    setCurrentPage(1);
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1); // Reset to first page on new search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    } else {
      params.delete('q');
    }
    router.replace(`/${locale}/search?${params.toString()}`, { scroll: false });
  }, [debouncedQuery, locale, router]);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      if (!debouncedQuery.trim()) {
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const offset = (currentPage - 1) * ITEMS_PER_PAGE;

        let query = supabase
          .from('products')
          .select(
            `
            id,
            name_ar,
            name_en,
            slug,
            category,
            brand,
            model,
            image_urls,
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
          `,
            { count: 'exact' }
          )
          .eq('is_active', true);

        // Apply text search (simple ILIKE search)
        if (debouncedQuery.trim()) {
          query = query.or(
            `name_ar.ilike.%${debouncedQuery}%,name_en.ilike.%${debouncedQuery}%,brand.ilike.%${debouncedQuery}%,model.ilike.%${debouncedQuery}%`
          );
        }

        // Apply category filter
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        // Apply brand filter
        if (filters.brands.length > 0) {
          query = query.in('brand', filters.brands);
        }

        // Apply store filter
        if (filters.stores.length > 0) {
          // This requires a join - simplified for now
          // TODO: Implement proper store filtering with joins
        }

        // Apply availability filter
        if (filters.availability.length > 0) {
          // This requires filtering product_stores - simplified for now
          // TODO: Implement proper availability filtering
        }

        // Apply deals filter
        if (filters.dealsOnly) {
          // This requires filtering product_stores - simplified for now
          // TODO: Implement proper deals filtering
        }

        // Apply price range filter
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
          // This requires filtering product_stores - simplified for now
          // TODO: Implement proper price range filtering
        }

        // Apply sorting
        if (sortBy === 'popularity') {
          query = query.order('view_count', { ascending: false });
        } else if (sortBy === 'price_low') {
          query = query.order('view_count', { ascending: false }); // Placeholder
        } else if (sortBy === 'price_high') {
          query = query.order('view_count', { ascending: false }); // Placeholder
        } else if (sortBy === 'rating') {
          query = query.order('save_count', { ascending: false });
        }

        const { data, error: queryError, count } = await query
          .range(offset, offset + ITEMS_PER_PAGE - 1);

        if (queryError) throw queryError;

        setProducts(data || []);
        setTotalCount(count || 0);

        // Save search history
        if (user && debouncedQuery.trim()) {
          supabase
            .from('search_history')
            .insert({
              user_id: user.id,
              search_query: debouncedQuery,
              category: selectedCategory !== 'all' ? selectedCategory : null,
              results_count: count || 0,
            })
            .then(() => {
              // Silently handle
            });
        }
      } catch (err) {
        console.error('Error searching products:', err);
        const errorMessage = err instanceof Error ? err.message : t('search.error');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [debouncedQuery, sortBy, currentPage, selectedCategory, filters, user]);

  const handleSearch = (query: string, category?: ProductCategory | 'all') => {
    setSearchQuery(query);
    setDebouncedQuery(query);
    if (category) setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleAddToCompare = (productId: string) => {
    // TODO: Implement comparison functionality
    console.log('Add to compare:', productId);
  };

  const handleSaveToWishlist = (productId: string) => {
    // TODO: Implement wishlist functionality
    console.log('Save to wishlist:', productId);
  };

  const handleAddProductToCart = (item: Product) => {
    const cartItem = createCartItemFromProduct(item, locale);
    if (!cartItem) {
      toast({
        title: t('product.addToCartUnavailable'),
        variant: 'destructive',
      });
      return;
    }
    addItem(cartItem);
    toast({
      title: t('product.addedToCart'),
      description: cartItem.storeName,
      variant: 'default',
    });
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>{t('common.home')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('search.title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Search Bar */}
        <div className="mb-8 space-y-6">
          <SearchBar
            initialQuery={searchQuery}
            onSearch={handleSearch}
            showSuggestions={true}
            showCategory={true}
          />
          {user && (
            <SearchHistory
              limit={10}
              onSelectQuery={(query) => setSearchQuery(query)}
            />
          )}
        </div>

        {/* Main Content with Filters */}
        {debouncedQuery && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filter Sidebar */}
            <div className="lg:w-64 flex-shrink-0">
              <div className="lg:sticky lg:top-4 space-y-4">
                {user && (
                  <SavedSearches
                    locale={locale}
                    currentQuery={debouncedQuery}
                    currentFilters={filters}
                    onSearchSelect={handleSearchSelect}
                  />
                )}
                <FilterSidebar
                  filters={filters}
                  onFilterChange={setFilters}
                  category={selectedCategory !== 'all' ? selectedCategory : undefined}
                  locale={locale}
                />
              </div>
            </div>

            {/* Results Section */}
            <div className="flex-1">
              {/* Sort Options */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {t('search.sortBy')}:
                  </label>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('search.sortBy')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popularity">{t('search.sortPopularity')}</SelectItem>
                      <SelectItem value="price_low">{t('search.sortPriceLow')}</SelectItem>
                      <SelectItem value="price_high">{t('search.sortPriceHigh')}</SelectItem>
                      <SelectItem value="rating">{t('search.sortRating')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Results Count */}
              {!loading && (
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  {totalCount} {t('search.resultsCount')}
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-4">
                      <Skeleton className="h-48 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
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

              {/* Empty State - No Results */}
              {!loading && !error && products.length === 0 && (
                <EmptyState
                  icon={<Search className="h-12 w-12" />}
                  title={t('search.noResults')}
                  description={t('search.noResultsFor', { query: debouncedQuery })}
                />
              )}

              {/* Products Grid */}
              {!loading && !error && products.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        locale={locale}
                        onCompare={handleAddToCompare}
                        onSave={handleSaveToWishlist}
                  onAddToCart={handleAddProductToCart}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
                              }}
                              aria-disabled={currentPage === 1}
                              className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                          {Array.from({ length: totalPages }).map((_, i) => (
                            <PaginationItem key={i}>
                              <PaginationLink
                                href="#"
                                isActive={i + 1 === currentPage}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(i + 1);
                                }}
                              >
                                {i + 1}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                              }}
                              aria-disabled={currentPage === totalPages}
                              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Empty State - No Query */}
        {!debouncedQuery && !loading && (
          <EmptyState
            icon={<Search className="h-12 w-12" />}
            title={t('search.startSearching')}
            description={t('search.searchForProducts')}
          />
        )}
      </div>
    </div>
  );
}

