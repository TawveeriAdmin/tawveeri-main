'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { ProductCard } from '@/components/products/product-card';
import type { ProductCardProduct } from '@/components/products/product-card';
import { SearchHistory } from '@/components/search/search-history';
import { FilterSidebar, type SearchFilters } from '@/components/search/filter-sidebar';
import { SavedSearches } from '@/components/search/saved-searches';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Search,
  AlertCircle,
  Sparkles,
  SlidersHorizontal,
  X,
  Smartphone,
  Laptop,
  Headphones,
  Monitor,
  Gamepad2,
  Camera,
  ChevronDown,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  TrendingUp,
  Star,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import { mapGroupedToProductCard } from '@/lib/scraping/product-adapter';
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';
import { StoreComparisonPanel } from '@/components/search/store-comparison-panel';

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
  const isRTL = locale === 'ar';
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
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>(
    (searchParams.get('category') as ProductCategory | 'all') || 'all'
  );
  const [scrapingProgress, setScrapingProgress] = useState<string>('');
  const [storeErrors, setStoreErrors] = useState<Record<string, string>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [externalQueryKey, setExternalQueryKey] = useState(0);
  const [storeErrorsExpanded, setStoreErrorsExpanded] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    brands: [],
    stores: [],
    availability: [],
    dealsOnly: false,
    freeDeliveryOnly: false,
    minRating: undefined,
  });

  // Sync search query from URL params (e.g. when header search navigates here)
  const urlQueryRef = useRef(searchParams.get('q') || '');
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery !== urlQueryRef.current) {
      urlQueryRef.current = urlQuery;
      if (urlQuery !== searchQuery) {
        setSearchQuery(urlQuery);
        setDebouncedQuery(urlQuery);
      }
    }
  }, [searchParams]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.brands.length > 0) count += filters.brands.length;
    if (filters.stores.length > 0) count += filters.stores.length;
    if (filters.availability.length > 0) count += filters.availability.length;
    if (filters.dealsOnly) count++;
    if (filters.freeDeliveryOnly) count++;
    if (filters.minRating && filters.minRating > 0) count++;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.specs) count += Object.values(filters.specs).reduce((sum, arr) => sum + arr.length, 0);
    if (filters.discount) count++;
    if (filters.condition) count += filters.condition.length;
    if (filters.shipping) count += filters.shipping.length;
    return count;
  }, [filters]);

  // Remove a single filter
  const removeFilter = useCallback((type: string, value?: string) => {
    setFilters(prev => {
      const next = { ...prev };
      switch (type) {
        case 'brand':
          next.brands = prev.brands.filter(b => b !== value);
          break;
        case 'store':
          next.stores = prev.stores.filter(s => s !== value);
          break;
        case 'availability':
          next.availability = prev.availability.filter(a => a !== value);
          break;
        case 'deals':
          next.dealsOnly = false;
          break;
        case 'freeDelivery':
          next.freeDeliveryOnly = false;
          break;
        case 'rating':
          next.minRating = undefined;
          break;
        case 'minPrice':
          next.minPrice = undefined;
          break;
        case 'maxPrice':
          next.maxPrice = undefined;
          break;
        case 'discount':
          next.discount = undefined;
          break;
        case 'condition':
          next.condition = prev.condition?.filter(c => c !== value);
          if (next.condition?.length === 0) next.condition = undefined;
          break;
        case 'shipping':
          next.shipping = prev.shipping?.filter(s => s !== value);
          if (next.shipping?.length === 0) next.shipping = undefined;
          break;
        default:
          // Handle spec filters (type starts with "spec:")
          if (type.startsWith('spec:') && value) {
            const specKey = type.replace('spec:', '');
            const currentSpecs = { ...(prev.specs || {}) };
            currentSpecs[specKey] = (currentSpecs[specKey] || []).filter(v => v !== value);
            if (currentSpecs[specKey].length === 0) delete currentSpecs[specKey];
            next.specs = Object.keys(currentSpecs).length > 0 ? currentSpecs : undefined;
          }
          break;
      }
      return next;
    });
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({
      brands: [],
      stores: [],
      availability: [],
      dealsOnly: false,
      freeDeliveryOnly: false,
      minRating: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      specs: undefined,
      discount: undefined,
      condition: undefined,
      shipping: undefined,
    });
  }, []);

  // Quick category chips
  const quickCategories = useMemo(() => [
    { key: 'phones', icon: Smartphone, query: locale === 'ar' ? 'هواتف' : 'phones' },
    { key: 'laptops', icon: Laptop, query: locale === 'ar' ? 'لابتوب' : 'laptops' },
    { key: 'headphones', icon: Headphones, query: locale === 'ar' ? 'سماعات' : 'headphones' },
    { key: 'monitors', icon: Monitor, query: locale === 'ar' ? 'شاشات' : 'monitors' },
    { key: 'gaming', icon: Gamepad2, query: locale === 'ar' ? 'ألعاب' : 'gaming' },
    { key: 'cameras', icon: Camera, query: locale === 'ar' ? 'كاميرات' : 'cameras' },
  ], [locale]);

  // Sort options with icons and descriptions
  const sortOptions = useMemo(() => [
    { value: 'popularity' as SortOption, icon: TrendingUp, label: t('search.sortPopularity') },
    { value: 'price_low' as SortOption, icon: ArrowDownNarrowWide, label: t('search.sortPriceLow') },
    { value: 'price_high' as SortOption, icon: ArrowUpNarrowWide, label: t('search.sortPriceHigh') },
    { value: 'rating' as SortOption, icon: Star, label: t('search.sortRating') },
  ], [t]);

  const currentSortOption = sortOptions.find(o => o.value === sortBy) || sortOptions[0];

  // Extract filter-related params from URL string (excluding 'q' parameter)
  const filterParamsString = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('q');
    return p.toString();
  }, [searchParams]);

  // Load filters from URL when filter params change
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
    const p = new URLSearchParams(searchParams.toString());

    const currentQuery = searchParams.get('q');
    if (currentQuery) p.set('q', currentQuery);

    if (filters.brands.length > 0) p.set('brands', filters.brands.join(','));
    else p.delete('brands');
    if (filters.stores.length > 0) p.set('stores', filters.stores.join(','));
    else p.delete('stores');
    if (filters.availability.length > 0) p.set('availability', filters.availability.join(','));
    else p.delete('availability');
    if (filters.dealsOnly) p.set('deals', 'true');
    else p.delete('deals');
    if (filters.freeDeliveryOnly) p.set('freeDelivery', 'true');
    else p.delete('freeDelivery');
    if (filters.minRating && filters.minRating > 0) p.set('rating', filters.minRating.toString());
    else p.delete('rating');
    if (selectedCategory !== 'all') p.set('category', selectedCategory);
    else p.delete('category');

    const newUrl = `/${locale}/search?${p.toString()}`;
    const currentUrl = `/${locale}/search?${searchParams.toString()}`;

    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [filters, selectedCategory, locale, router, searchParams]);

  const handleSearchSelect = (query: string, selectedFilters: SearchFilters) => {
    setSearchQuery(query);
    setFilters(selectedFilters);
    setCurrentPage(1);
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update URL when search changes
  useEffect(() => {
    const currentQuery = searchParams.get('q') || '';
    if (currentQuery === debouncedQuery) return;

    // Update the ref so the sync effect doesn't re-trigger
    urlQueryRef.current = debouncedQuery;

    const p = new URLSearchParams(searchParams.toString());

    if (debouncedQuery) p.set('q', debouncedQuery);
    else p.delete('q');

    const newUrl = `/${locale}/search?${p.toString()}`;
    const currentUrl = `/${locale}/search?${searchParams.toString()}`;

    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [debouncedQuery, locale, router, searchParams]);

  // Search with scraping
  async function searchWithScraping(query: string, stores: string[] = ['amazon', 'noon', 'jarir'], pages: number = 1) {
    setLoading(true);
    setError(null);
    setScrapingProgress(t('search.searchingStores'));
    setStoreErrors({});

    try {
      const response = await fetch('/api/search/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          stores,
          pages,
          sort: sortBy === 'price_low' ? 'price_asc' : sortBy === 'price_high' ? 'price_desc' : 'relevance',
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        }),
      });

      if (!response.ok) {
        let errorData: Record<string, string> = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        let errorMessage = errorData.error || errorData.message || `Failed to scrape products (${response.status})`;

        if (response.status === 403) {
          errorMessage = 'Scraping service is not accessible. Please ensure Flask is running (npm run flask:start)';
        } else if (response.status === 503) {
          errorMessage = errorData.error || 'Scraping service is not available. Please start Flask.';
        }

        console.error('[Search] Scraping error:', { status: response.status, error: errorData });
        throw new Error(errorMessage);
      }

      const data: ScrapedSearchResult = await response.json();

      const mappedProducts: Product[] = data.products.map((grouped) => {
        return mapGroupedToProductCard(grouped) as Product;
      });

      let sortedProducts = [...mappedProducts];
      if (sortBy === 'price_low') {
        sortedProducts.sort((a, b) => {
          const priceA = Math.min(...a.product_stores.map(ps => ps.current_price || Infinity));
          const priceB = Math.min(...b.product_stores.map(ps => ps.current_price || Infinity));
          return priceA - priceB;
        });
      } else if (sortBy === 'price_high') {
        sortedProducts.sort((a, b) => {
          const priceA = Math.min(...a.product_stores.map(ps => ps.current_price || 0));
          const priceB = Math.min(...b.product_stores.map(ps => ps.current_price || 0));
          return priceB - priceA;
        });
      }

      // Apply spec filters client-side
      if (filters.specs && Object.keys(filters.specs).length > 0) {
        sortedProducts = sortedProducts.filter(product => {
          const title = product.name_en || product.name_ar || '';
          const specs = extractSpecsFromTitle(title);
          return Object.entries(filters.specs!).every(([key, values]) => {
            if (values.length === 0) return true;
            return values.includes(specs[key] || '');
          });
        });
      }

      // Apply discount filter
      if (filters.discount) {
        sortedProducts = sortedProducts.filter(product => {
          const ps = product.product_stores[0];
          if (!ps?.original_price || !ps.current_price) return false;
          const discountPct = ((ps.original_price - ps.current_price) / ps.original_price) * 100;
          return discountPct >= filters.discount!;
        });
      }

      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedProducts = sortedProducts.slice(offset, offset + ITEMS_PER_PAGE);

      setProducts(paginatedProducts);
      setTotalCount(sortedProducts.length);
      setStoreErrors(data.errors || {});
      setScrapingProgress('');

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

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      if (!debouncedQuery.trim()) {
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
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

  const handleQuickCategory = (query: string) => {
    setSearchQuery(query);
    setDebouncedQuery(query);
    setCurrentPage(1);
    setExternalQueryKey(prev => prev + 1);
  };

  const handleHistorySelect = (query: string) => {
    setSearchQuery(query);
    setDebouncedQuery(query);
    setCurrentPage(1);
    setExternalQueryKey(prev => prev + 1);
  };

  const handleComparePrices = useCallback((productId: string) => {
    setExpandedProductId(prev => prev === productId ? null : productId);
  }, []);

  const handleAddToCompare = (productId: string) => {
    console.log('Add to compare:', productId);
  };

  const handleSaveToWishlist = (productId: string) => {
    console.log('Save to wishlist:', productId);
  };

  const handleAddProductToCart = (item: Product) => {
    const cartItem = createCartItemFromProduct(item, locale);
    if (!cartItem) {
      toast({ title: t('product.addToCartUnavailable'), variant: 'destructive' });
      return;
    }
    addItem(cartItem);
    toast({ title: t('product.addedToCart'), description: cartItem.storeName, variant: 'default' });
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Build active filter chips
  const filterChips = useMemo(() => {
    const chips: Array<{ label: string; type: string; value?: string }> = [];
    filters.brands.forEach(b => chips.push({ label: b, type: 'brand', value: b }));
    filters.stores.forEach(s => chips.push({ label: s, type: 'store', value: s }));
    filters.availability.forEach(a => chips.push({ label: a, type: 'availability', value: a }));
    if (filters.dealsOnly) chips.push({ label: t('search.filters.showDealsOnly'), type: 'deals' });
    if (filters.freeDeliveryOnly) chips.push({ label: t('search.filters.freeDeliveryOnly'), type: 'freeDelivery' });
    if (filters.minRating && filters.minRating > 0) chips.push({ label: `${filters.minRating}+ ⭐`, type: 'rating' });
    if (filters.discount) chips.push({ label: `+${filters.discount}%`, type: 'discount' });
    filters.condition?.forEach(c => chips.push({ label: c, type: 'condition', value: c }));
    filters.shipping?.forEach(s => chips.push({ label: s, type: 'shipping', value: s }));
    if (filters.specs) {
      Object.entries(filters.specs).forEach(([key, values]) => {
        values.forEach(v => chips.push({ label: `${key}: ${v}`, type: `spec:${key}`, value: v }));
      });
    }
    return chips;
  }, [filters, t]);

  // Smart pagination numbers with ellipsis
  const paginationPages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | 'ellipsis')[] = [];
    pages.push(1);
    if (currentPage > 3) pages.push('ellipsis');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }, [totalPages, currentPage]);

  return (
    <div>
      {/* ── Toolbar ── */}

      {/* ── Store Errors (collapsible) ── */}
      {storeErrors && Object.keys(storeErrors).length > 0 && (
        <div className="mt-2">
          <Alert variant="destructive" className="cursor-pointer" onClick={() => setStoreErrorsExpanded(!storeErrorsExpanded)}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="font-medium">{t('search.someStoresFailed')}</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', storeErrorsExpanded && 'rotate-180')} />
              </div>
              {storeErrorsExpanded && (
                <div className="mt-2 space-y-1">
                  {Object.entries(storeErrors).map(([store, err]) => (
                    <p key={store} className="text-body-sm">{store}: {err}</p>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* ── No-Query State ── */}
      {!debouncedQuery && !loading && (
        <div className="py-16">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            {/* Gradient search icon */}
            <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
              <Search className="w-10 h-10 text-primary-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-on-surface">{t('search.startSearching')}</h1>
              <p className="text-on-surface-variant">{t('search.searchForProducts')}</p>
            </div>

            {/* Quick category chips */}
            <div className="flex flex-wrap justify-center gap-3">
              {quickCategories.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleQuickCategory(cat.query)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-on-surface hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:hover:border-primary-700 transition-all duration-200 hover:shadow-sm"
                  >
                    <Icon className="w-4 h-4 text-primary-500" />
                    {t(`search.quickCategories.${cat.key}`)}
                  </button>
                );
              })}
            </div>

            {/* Subtle scraping info badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-on-surface-variant">
              <Sparkles className="w-3 h-3" />
              {t('search.scrapeNote')}
            </div>

            {/* Search history */}
            {user && (
              <div className="mt-8">
                <SearchHistory
                  limit={10}
                  onSelectQuery={handleHistorySelect}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Active Search State ── */}
      {debouncedQuery && (
        <>
          {/* ── Main Content ── */}
          <div className="py-6">
            <div className="flex gap-6">
              {/* Desktop Filter Sidebar */}
              <div className="hidden lg:block w-72 shrink-0">
                <div className="sticky top-[120px] max-h-[calc(100vh-148px)] overflow-y-auto flex flex-col gap-4 scrollbar-hide">
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
                    topContent={
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm text-on-surface-variant">
                          <span className="tabular-nums font-bold text-primary-600">{totalCount}</span>{' '}
                          {t('search.resultsCount')}
                        </div>
                        <Popover open={sortOpen} onOpenChange={setSortOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-gray-200 dark:border-gray-700">
                              <ArrowUpDown className="w-3.5 h-3.5" />
                              <span className="text-xs">{currentSortOption.label}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-52 p-1.5">
                            {sortOptions.map(option => {
                              const Icon = option.icon;
                              const isActive = sortBy === option.value;
                              return (
                                <button
                                  key={option.value}
                                  onClick={() => { setSortBy(option.value); setSortOpen(false); }}
                                  className={cn(
                                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-start transition-colors',
                                    isActive ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                  )}
                                >
                                  <div className={cn(
                                    'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                                    isActive ? 'bg-primary-100 dark:bg-primary-800/50 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-gray-700 text-on-surface-variant'
                                  )}>
                                    <Icon className="w-3.5 h-3.5" />
                                  </div>
                                  <p className={cn('flex-1 min-w-0 text-sm font-medium', isActive ? 'text-primary-700 dark:text-primary-300' : 'text-on-surface')}>
                                    {option.label}
                                  </p>
                                  {isActive && <Check className="w-4 h-4 text-primary-500 shrink-0" />}
                                </button>
                              );
                            })}
                          </PopoverContent>
                        </Popover>
                      </div>
                    }
                  />
                </div>
              </div>

              {/* Results Area */}
              <div className="flex-1 min-w-0">
                {/* Mobile toolbar + filter chips */}
                <div className="mb-4">
                  {/* Mobile: results count, sort, filters button */}
                  <div className="flex items-center justify-between gap-4 lg:hidden">
                    <div className="text-sm text-on-surface-variant shrink-0">
                      <span className="tabular-nums font-bold text-primary-600">{totalCount}</span>{' '}
                      {t('search.resultsCount')}
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover open={sortOpen} onOpenChange={setSortOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-gray-200 dark:border-gray-700">
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-xs">{currentSortOption.label}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-52 p-1.5">
                          {sortOptions.map(option => {
                            const Icon = option.icon;
                            const isActive = sortBy === option.value;
                            return (
                              <button
                                key={option.value}
                                onClick={() => { setSortBy(option.value); setSortOpen(false); }}
                                className={cn(
                                  'flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-start transition-colors',
                                  isActive ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                )}
                              >
                                <div className={cn(
                                  'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                                  isActive ? 'bg-primary-100 dark:bg-primary-800/50 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-gray-700 text-on-surface-variant'
                                )}>
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <p className={cn('flex-1 min-w-0 text-sm font-medium', isActive ? 'text-primary-700 dark:text-primary-300' : 'text-on-surface')}>
                                  {option.label}
                                </p>
                                {isActive && <Check className="w-4 h-4 text-primary-500 shrink-0" />}
                              </button>
                            );
                          })}
                        </PopoverContent>
                      </Popover>
                      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="relative">
                            <SlidersHorizontal className="w-4 h-4" />
                            <span className="hidden sm:inline ms-1">{t('search.mobileFilters')}</span>
                            {activeFilterCount > 0 && (
                              <span className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">{activeFilterCount}</span>
                            )}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{t('search.filtersTitle')}</DialogTitle>
                          </DialogHeader>
                          <FilterSidebar filters={filters} onFilterChange={(newFilters) => { setFilters(newFilters); setMobileFiltersOpen(false); }} category={selectedCategory !== 'all' ? selectedCategory : undefined} locale={locale} />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  {filterChips.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                      <span className="text-xs text-on-surface-variant shrink-0">{t('search.activeFilters')}:</span>
                      {filterChips.map((chip, i) => (
                        <button key={`${chip.type}-${chip.value || i}`} onClick={() => removeFilter(chip.type, chip.value)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium shrink-0 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors">
                          {chip.label}
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                      <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-600 font-medium shrink-0 transition-colors">{t('search.clearAll')}</button>
                    </div>
                  )}
                </div>

                {/* Loading State */}
                {loading && (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
                        <Skeleton className="h-44 w-full rounded-lg" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex justify-between">
                          <Skeleton className="h-6 w-20" />
                          <Skeleton className="h-8 w-24 rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error State */}
                {error && !loading && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* No Results */}
                {!loading && !error && products.length === 0 && debouncedQuery && (
                  <div className="text-center py-20 space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Search className="w-7 h-7 text-on-surface-variant" />
                    </div>
                    <h2 className="text-lg font-semibold text-on-surface">{t('search.noResults')}</h2>
                    <p className="text-sm text-on-surface-variant">{t('search.noResultsFor').replace('{{query}}', debouncedQuery)}</p>
                  </div>
                )}

                {/* Products Grid */}
                {!loading && !error && products.length > 0 && (
                  <>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                      {products.map((product, index) => (
                        <div
                          key={`${product.id}-${index}`}
                          className="animate-fadeInUp"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <ProductCard
                            product={product}
                            locale={locale}
                            onCompare={handleAddToCompare}
                            onComparePrices={handleComparePrices}
                            onSave={handleSaveToWishlist}
                          />
                          {/* Inline Store Comparison Panel */}
                          {expandedProductId === product.id && product.product_stores.length > 1 && (
                            <div className="mt-2">
                              <StoreComparisonPanel
                                product={product}
                                locale={locale}
                                onClose={() => setExpandedProductId(null)}
                              />
                            </div>
                          )}
                        </div>
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
                                label={t('search.paginationPrevious')}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage > 1) setCurrentPage(currentPage - 1);
                                }}
                                aria-disabled={currentPage === 1}
                                className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>
                            {paginationPages.map((page, i) =>
                              page === 'ellipsis' ? (
                                <PaginationItem key={`ellipsis-${i}`}>
                                  <span className="px-2 text-on-surface-variant">...</span>
                                </PaginationItem>
                              ) : (
                                <PaginationItem key={page}>
                                  <PaginationLink
                                    href="#"
                                    isActive={page === currentPage}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setCurrentPage(page as number);
                                    }}
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              )
                            )}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                label={t('search.paginationNext')}
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
          </div>
        </>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out both;
        }
        @keyframes progress {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-progress {
          animation: progress 1.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fadeInUp {
            animation: none;
          }
          .animate-progress {
            animation: none;
          }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
