'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
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
import { Search, AlertCircle, Sparkles } from 'lucide-react';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import { mapScrapedToProductCard } from '@/lib/scraping/product-adapter';

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
  const [scrapingProgress, setScrapingProgress] = useState<string>('');
  const [storeErrors, setStoreErrors] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<SearchFilters>({
    brands: [],
    stores: [],
    availability: [],
    dealsOnly: false,
    freeDeliveryOnly: false,
    minRating: undefined,
  });

  // Extract filter-related params from URL string (excluding 'q' parameter)
  const filterParamsString = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q'); // Remove query param to only track filter changes
    return params.toString();
  }, [searchParams]);

  // Load filters from URL when filter params change (not when 'q' changes)
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
  }, [filterParamsString, searchParams]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Preserve the 'q' parameter
    const currentQuery = searchParams.get('q');
    if (currentQuery) {
      params.set('q', currentQuery);
    }
    
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
    
    const newUrl = `/${locale}/search?${params.toString()}`;
    const currentUrl = `/${locale}/search?${searchParams.toString()}`;
    
    // Only update URL if it actually changed
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [filters, locale, router, searchParams]);

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
    const currentQuery = searchParams.get('q') || '';
    
    // Only update if the query actually changed
    if (currentQuery === debouncedQuery) {
      return;
    }
    
    const params = new URLSearchParams(searchParams.toString());
    
    // Preserve filter parameters
    const brands = searchParams.get('brands');
    const stores = searchParams.get('stores');
    const availability = searchParams.get('availability');
    const deals = searchParams.get('deals');
    const freeDelivery = searchParams.get('freeDelivery');
    const rating = searchParams.get('rating');
    
    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    } else {
      params.delete('q');
    }
    
    // Restore filter parameters
    if (brands) params.set('brands', brands);
    if (stores) params.set('stores', stores);
    if (availability) params.set('availability', availability);
    if (deals) params.set('deals', deals);
    if (freeDelivery) params.set('freeDelivery', freeDelivery);
    if (rating) params.set('rating', rating);
    
    const newUrl = `/${locale}/search?${params.toString()}`;
    const currentUrl = `/${locale}/search?${searchParams.toString()}`;
    
    // Only update URL if it actually changed
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [debouncedQuery, locale, router, searchParams]);

  // Search with scraping
  async function searchWithScraping(query: string, stores: string[] = ['amazon', 'noon', 'jarir'], pages: number = 1) {
    setLoading(true);
    setError(null);
    setScrapingProgress('Connecting to scraping service...');
    setStoreErrors({});

    try {
      setScrapingProgress('Searching stores...');
      const response = await fetch('/api/search/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          stores,
          pages,
          sort: sortBy === 'price_low' ? 'price_asc' : sortBy === 'price_high' ? 'price_desc' : 'price_asc',
        }),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        let errorMessage = errorData.error || errorData.message || `Failed to scrape products (${response.status})`;
        
        // Add helpful hints for common errors
        if (response.status === 403) {
          errorMessage = 'Scraping service is not accessible. Please ensure Flask is running (npm run flask:start)';
        } else if (response.status === 503) {
          errorMessage = errorData.error || 'Scraping service is not available. Please start Flask.';
        }
        
        console.error('[Search] Scraping error:', {
          status: response.status,
          error: errorData,
          hint: errorData.hint
        });
        throw new Error(errorMessage);
      }

      const data: ScrapedSearchResult = await response.json();

      // Map scraped products to Product format
      // Note: The mapper already includes store info from Python response
      const mappedProducts: Product[] = data.products.map((scraped) => {
        return mapScrapedToProductCard(scraped) as Product;
      });

      // Apply client-side sorting for scraped results
      let sortedProducts = [...mappedProducts];
      if (sortBy === 'price_low') {
        sortedProducts.sort((a, b) => {
          const priceA = a.product_stores[0]?.current_price || Infinity;
          const priceB = b.product_stores[0]?.current_price || Infinity;
          return priceA - priceB;
        });
      } else if (sortBy === 'price_high') {
        sortedProducts.sort((a, b) => {
          const priceA = a.product_stores[0]?.current_price || 0;
          const priceB = b.product_stores[0]?.current_price || 0;
          return priceB - priceA;
        });
      }

      // Apply pagination
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedProducts = sortedProducts.slice(offset, offset + ITEMS_PER_PAGE);

      setProducts(paginatedProducts);
      setTotalCount(data.count);
      setStoreErrors(data.errors || {});
      setScrapingProgress('');

      // Show success message
      if (data.count > 0) {
        toast({
          title: `Found ${data.count} products`,
          description: `Search completed in ${data.searchTime}s`,
        });
      }
    } catch (err) {
      console.error('Error scraping products:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to scrape products';
      setError(errorMessage);
      setScrapingProgress('');
      toast({
        title: 'Scraping failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  // Fetch products - always use scraping
  useEffect(() => {
    async function fetchProducts() {
      if (!debouncedQuery.trim()) {
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      // Always use scraping
      await searchWithScraping(debouncedQuery, ['amazon', 'noon', 'jarir'], 1);
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
          
          {/* Scraping Info */}
          <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <Sparkles className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('search.scrapeNote')}
            </span>
          </div>

          {/* Scraping Progress */}
          {loading && scrapingProgress && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>{scrapingProgress}</AlertDescription>
            </Alert>
          )}

          {/* Store Errors */}
          {storeErrors && Object.keys(storeErrors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p>Some stores failed:</p>
                  {Object.entries(storeErrors).map(([store, error]) => (
                    <p key={store} className="text-xs">
                      {store}: {error}
                    </p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

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


