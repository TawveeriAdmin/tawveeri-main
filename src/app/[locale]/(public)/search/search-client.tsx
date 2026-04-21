'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { ProductCard } from '@/components/products/product-card';
import type { ProductCardProduct } from '@/components/products/product-card';
import { SearchHistory } from '@/components/search/search-history';
import { FilterSidebar, type SearchFilters } from '@/components/search/filter-sidebar';
import { ActiveFilterChips } from '@/components/search/active-filter-chips';
import { SortSelector } from '@/components/search/sort-selector';
import { ResultsSkeleton } from '@/components/search/results-skeleton';
import { ResultsMeta } from '@/components/search/results-meta';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { getStoreDisplayName } from '@/lib/logos';
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
  DialogDescription,
  DialogFooter,
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
  Zap,
  BarChart3,
  BadgeCheck,
  Loader2,
} from 'lucide-react';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { getSupabaseBrowserClient } from '@/lib/database';
import { incrementSaveCount } from '@/lib/wishlist/utils';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import { mapGroupedToProductCard } from '@/lib/scraping/product-adapter';
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';
import { saveSearch } from '@/lib/search/saved-searches';
import { createNotification } from '@/lib/auth/notifications';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StoreComparisonPanel } from '@/components/search/store-comparison-panel';
import {
  DEFAULT_SEARCH_STORES,
  SUPPORTED_SEARCH_STORES,
  isSupportedSearchStore,
} from '@/lib/scraping/search/store-registry';
import { SEARCH_STORE_DISPLAY_NAMES } from '@/lib/scraping/product-adapter';
import { SearchVoiceBarcodeActions } from '@/components/search/search-voice-barcode-actions';

type Product = ProductCardProduct;

type SortOption = 'popularity' | 'price_low' | 'price_high' | 'rating';

const ITEMS_PER_PAGE = 25;
const COMPARE_STORAGE_KEY = 'compare_products';
const COMPARE_CACHE_STORAGE_KEY = 'compare_products_cache';
const SEARCH_CACHE_KEY = 'search_results_cache';

const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Session-storage helpers for persisting search results across navigation
function getSearchCache(): { query: string; category: string; products: Product[]; timestamp: number } | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after TTL
    if (parsed.timestamp && Date.now() - parsed.timestamp > SEARCH_CACHE_TTL) {
      sessionStorage.removeItem(SEARCH_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function setSearchCache(query: string, category: string, products: Product[]) {
  try {
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ query, category, products, timestamp: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

export default function SearchClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const t = useTranslations();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addItem } = useMultiStoreCart();

  const urlQuery = searchParams.get('q') || '';
  const initialCategory = (searchParams.get('category') as ProductCategory | 'all') || 'all';

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!!urlQuery);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>(initialCategory);
  const [scrapingProgress, setScrapingProgress] = useState<string>('');
  const [storeErrors, setStoreErrors] = useState<Record<string, string>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [externalQueryKey, setExternalQueryKey] = useState(0);
  const [storeErrorsExpanded, setStoreErrorsExpanded] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchLatencyMs, setSearchLatencyMs] = useState<number | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [savedProductNames, setSavedProductNames] = useState<Set<string>>(new Set());
  const [storeStats, setStoreStats] = useState<{ total: number; successful: number } | null>(null);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  // Keep the in-compare badge in sync with the floating bar / other tabs
  useEffect(() => {
    const sync = () => {
      try {
        const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
        setCompareIds(new Set(raw ? (JSON.parse(raw) as string[]) : []));
      } catch {
        setCompareIds(new Set());
      }
    };
    window.addEventListener('compare-products-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('compare-products-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Fetch user's wishlist product names to show filled hearts
  useEffect(() => {
    if (!user) { setSavedProductNames(new Set()); return; }
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('user_wishlists')
      .select('products(name_en)')
      .eq('user_id', user.id)
      .returns<Array<{ products: { name_en: string } | null }>>()
      .then(({ data }) => {
        if (data) {
          setSavedProductNames(new Set(data.map(d => d.products?.name_en).filter(Boolean) as string[]));
        }
      });
  }, [user]);

  // Fetch trending products once to render as fallback in empty search state.
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('products')
      .select(`id, name_ar, name_en, slug, category, brand, model, image_urls, specifications,
        product_stores(id, current_price, original_price, availability, product_url,
          stores(id, name_ar, name_en, logo_url, average_rating, total_reviews))`)
      .eq('is_active', true)
      .order('view_count', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setTrendingProducts((data as unknown as Product[]) || []);
      });
    return () => { cancelled = true; };
  }, []);

  const [filters, setFilters] = useState<SearchFilters>({
    brands: [],
    stores: [],
    availability: [],
    dealsOnly: false,
    freeDeliveryOnly: false,
    minRating: undefined,
  });

  // Sync search query from URL params (e.g. when header search navigates here)
  const urlQueryRef = useRef(urlQuery);
  const filtersFromUrlRef = useRef(false);
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

  // ── URL write-back: mirror filter/sort/page state into the URL so reload + share preserve view ──
  const urlSyncReadyRef = useRef(false);
  useEffect(() => {
    // Skip the very first run so we don't blow away the URL before initial state hydrates
    if (!urlSyncReadyRef.current) {
      urlSyncReadyRef.current = true;
      return;
    }
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
    if (filters.brands.length > 0) params.set('brand', filters.brands.join(','));
    if (filters.stores.length > 0) params.set('stores', filters.stores.join(','));
    if (filters.availability.length > 0) params.set('availability', filters.availability.join(','));
    if (filters.minPrice !== undefined) params.set('priceMin', String(filters.minPrice));
    if (filters.maxPrice !== undefined) params.set('priceMax', String(filters.maxPrice));
    if (filters.dealsOnly) params.set('dealsOnly', '1');
    if (filters.freeDeliveryOnly) params.set('freeDeliveryOnly', '1');
    if (filters.minRating && filters.minRating > 0) params.set('minRating', String(filters.minRating));
    if (filters.discount !== undefined) params.set('discount', String(filters.discount));
    if (filters.condition?.length) params.set('condition', filters.condition.join(','));
    if (filters.shipping?.length) params.set('shipping', filters.shipping.join(','));
    if (filters.specs) {
      for (const [key, vals] of Object.entries(filters.specs)) {
        if (vals.length > 0) params.set(`spec:${key}`, vals.join(','));
      }
    }
    if (sortBy && sortBy !== 'popularity') params.set('sort', sortBy);
    if (currentPage > 1) params.set('page', String(currentPage));

    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    // Use replace so we don't bloat history on every chip toggle
    router.replace(next, { scroll: false });
  }, [
    debouncedQuery,
    selectedCategory,
    filters,
    sortBy,
    currentPage,
    pathname,
    router,
  ]);

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

  // Reset page when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy]);

  // Client-side filtering, sorting, and pagination of cached scrape results
  const { products, totalCount } = useMemo(() => {
    let result = [...rawProducts];

    // Store filter
    if (filters.stores.length > 0) {
      result = result.filter(p =>
        p.product_stores.some(ps => filters.stores.includes(ps.stores.id))
      );
    }

    // Brand filter
    if (filters.brands.length > 0) {
      result = result.filter(p =>
        filters.brands.some(b => b.toLowerCase() === p.brand.toLowerCase())
      );
    }

    // Availability filter
    if (filters.availability.length > 0) {
      result = result.filter(p =>
        p.product_stores.some(ps => filters.availability.includes(ps.availability))
      );
    }

    // Deals only
    if (filters.dealsOnly) {
      result = result.filter(p =>
        p.product_stores.some(ps => ps.original_price != null && ps.current_price < ps.original_price)
      );
    }

    // Free delivery only
    if (filters.freeDeliveryOnly) {
      result = result.filter(p =>
        p.product_stores.some(ps => ps.is_free_delivery)
      );
    }

    // Price range
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      result = result.filter(p => {
        const prices = p.product_stores.map(ps => ps.current_price).filter((pr): pr is number => pr != null && pr > 0);
        if (prices.length === 0) return false;
        const lowest = Math.min(...prices);
        if (filters.minPrice !== undefined && lowest < filters.minPrice) return false;
        if (filters.maxPrice !== undefined && lowest > filters.maxPrice) return false;
        return true;
      });
    }

    // Spec filters — prefer DB-populated products.specifications JSONB; fall back
    // to title-regex extraction for products the scraper hasn't enriched yet.
    if (filters.specs && Object.keys(filters.specs).length > 0) {
      result = result.filter(product => {
        const dbSpecs = (product.specifications ?? null) as Record<string, unknown> | null;
        const hasDbSpecs = dbSpecs && Object.keys(dbSpecs).length > 0;
        const fallbackSpecs = hasDbSpecs
          ? null
          : extractSpecsFromTitle(product.name_en || product.name_ar || '');
        return Object.entries(filters.specs!).every(([key, values]) => {
          if (values.length === 0) return true;
          const dbValue = hasDbSpecs ? dbSpecs![key] : undefined;
          const value =
            dbValue !== undefined && dbValue !== null
              ? String(dbValue).toLowerCase()
              : fallbackSpecs?.[key] ?? '';
          return values.map(v => v.toLowerCase()).includes(value);
        });
      });
    }

    // Discount filter
    if (filters.discount) {
      result = result.filter(product => {
        const ps = product.product_stores[0];
        if (!ps?.original_price || !ps.current_price) return false;
        const pct = ((ps.original_price - ps.current_price) / ps.original_price) * 100;
        return pct >= filters.discount!;
      });
    }

    // Sort
    if (sortBy === 'price_low') {
      result.sort((a, b) => {
        const pa = Math.min(...a.product_stores.map(ps => ps.current_price || Infinity));
        const pb = Math.min(...b.product_stores.map(ps => ps.current_price || Infinity));
        return pa - pb;
      });
    } else if (sortBy === 'price_high') {
      result.sort((a, b) => {
        const pa = Math.min(...a.product_stores.map(ps => ps.current_price || 0));
        const pb = Math.min(...b.product_stores.map(ps => ps.current_price || 0));
        return pb - pa;
      });
    }

    const totalCount = result.length;
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const products = result.slice(offset, offset + ITEMS_PER_PAGE);
    return { products, totalCount };
  }, [rawProducts, filters, sortBy, currentPage]);

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
  const storeLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const slug of SUPPORTED_SEARCH_STORES) {
      const n = SEARCH_STORE_DISPLAY_NAMES[slug];
      labels[slug] = locale === 'ar' ? (n?.name_ar ?? slug) : (n?.name_en ?? slug);
    }
    return labels;
  }, [locale]);

  // Extract ONLY filter-related params from URL (excludes q, page, sort, category)
  // so that pagination/sort/category changes don't trigger the filter sync effect
  const filterParamsString = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    ['q', 'page', 'sort', 'category'].forEach(k => p.delete(k));
    return p.toString();
  }, [searchParams]);

  // Load filters from URL when filter params change — reads from filterParamsString
  // so only actual filter changes (not page/sort) trigger this
  useEffect(() => {
    const p = new URLSearchParams(filterParamsString);
    const storesFromUrl = (p.get('stores')?.split(',') || [])
      .map((store) => store.trim().toLowerCase())
      .filter(isSupportedSearchStore);

    const urlFilters: SearchFilters = {
      brands: p.get('brands')?.split(',').filter(Boolean) || [],
      stores: storesFromUrl,
      availability: (p.get('availability')?.split(',').filter(Boolean) || []) as AvailabilityStatus[],
      dealsOnly: p.get('deals') === 'true',
      freeDeliveryOnly: p.get('freeDelivery') === 'true',
      minRating: p.get('rating') ? parseFloat(p.get('rating') || '0') : undefined,
    };
    filtersFromUrlRef.current = true;
    setFilters(urlFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParamsString]);

  // Update URL when filters change (skip if change came from URL sync)
  useEffect(() => {
    if (filtersFromUrlRef.current) {
      filtersFromUrlRef.current = false;
      return;
    }

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

  // Note: debouncedQuery is set explicitly on form submit / handleSearch.
  // No auto-debounce — search only triggers on Enter or button click.

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
  async function searchWithScraping(
    query: string,
    stores: string[] = DEFAULT_SEARCH_STORES,
    pages: number = 5,
    signal?: AbortSignal,
  ) {
    setLoading(true);
    setError(null);
    setScrapingProgress(t('search.searchingStores'));
    setStoreErrors({});

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          query: query.trim(),
          pages,
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


      setRawProducts(mappedProducts);
      setSearchCache(query, selectedCategory || 'all', mappedProducts);
      setStoreErrors(data.errors || {});
      // searchTime from API is in seconds; convert to ms
      if (typeof data.searchTime === 'number') {
        setSearchLatencyMs(Math.round(data.searchTime * 1000));
      }
      // Track store success/total for partial results banner
      if (data.totalStores && data.successfulStores !== undefined) {
        setStoreStats({ total: data.totalStores, successful: data.successfulStores });
      } else {
        setStoreStats(null);
      }
      setScrapingProgress('');

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setScrapingProgress('');
        return;
      }
      console.error('Error scraping products:', err);
      const rawMessage = err instanceof Error ? err.message : 'Failed to scrape products';
      // Show user-friendly error messages instead of raw HTTP errors
      let userMessage: string;
      if (rawMessage.includes('504') || rawMessage.includes('timeout') || rawMessage.includes('Timed out')) {
        userMessage = locale === 'ar'
          ? 'استغرق البحث وقتاً طويلاً. يرجى المحاولة مرة أخرى.'
          : 'Search took too long. Please try again.';
      } else if (rawMessage.includes('429') || rawMessage.includes('Too many')) {
        userMessage = locale === 'ar'
          ? 'طلبات كثيرة جداً. يرجى الانتظار لحظة ثم المحاولة مرة أخرى.'
          : 'Too many requests. Please wait a moment and try again.';
      } else if (rawMessage.includes('500')) {
        userMessage = locale === 'ar'
          ? 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.'
          : 'A server error occurred. Please try again.';
      } else {
        userMessage = locale === 'ar'
          ? 'فشل البحث. يرجى المحاولة مرة أخرى.'
          : 'Search failed. Please try again.';
      }
      setError(userMessage);
      setScrapingProgress('');
      setStoreStats(null);
      toast({
        title: locale === 'ar' ? 'فشل البحث' : 'Search failed',
        description: userMessage,
        variant: 'destructive',
      });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  // Fetch products when query/category changes, with sessionStorage cache restore
  const mountedRef = useRef(false);
  const cacheSkipRef = useRef(false);
  useEffect(() => {
    // Skip one trigger after cache restored query+category from back-navigation
    if (cacheSkipRef.current) {
      cacheSkipRef.current = false;
      return;
    }

    // On first mount, try restoring from sessionStorage before scraping
    if (!mountedRef.current) {
      mountedRef.current = true;
      const cached = getSearchCache();
      if (cached && cached.products.length > 0) {
        const q = debouncedQuery;
        if (q && cached.query === q && cached.category === selectedCategory) {
          // URL had matching query+category — restore products, skip scrape
          setRawProducts(cached.products);
          setLoading(false);
          return;
        }
        if (!q && cached.query) {
          // URL had no query (back-nav stripped ?q=) — restore everything
          setRawProducts(cached.products);
          cacheSkipRef.current = true;
          setSearchQuery(cached.query);
          setDebouncedQuery(cached.query);
          setSelectedCategory(cached.category as ProductCategory | 'all');
          return;
        }
      }
    } else {
      // After mount: check cache before scraping (same query+category = skip)
      const cached = getSearchCache();
      if (cached && cached.products.length > 0 && cached.query === debouncedQuery && cached.category === selectedCategory) {
        // Already have fresh results for this query — don't re-scrape
        if (rawProducts.length === 0) {
          setRawProducts(cached.products);
        }
        return;
      }
    }

    const ac = new AbortController();

    async function fetchProducts() {
      const hasQuery = debouncedQuery.trim().length > 0;
      const hasCategory = selectedCategory && selectedCategory !== 'all';
      if (!hasQuery && !hasCategory) {
        setRawProducts([]);
        setLoading(false);
        return;
      }

      await searchWithScraping(debouncedQuery, [...DEFAULT_SEARCH_STORES], 5, ac.signal);
    }
    fetchProducts();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, selectedCategory]);

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

  const handleSaveCurrentSearch = async () => {
    if (!user || !saveSearchName.trim()) return;
    setSavingSearch(true);
    try {
      const result = await saveSearch({
        userId: user.id,
        name: saveSearchName.trim(),
        query: debouncedQuery,
        filters: {
          ...filters,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        },
      });
      if (result.error) throw result.error;

      const savedId = result.data?.id ?? null;
      createNotification({
        user_id: user.id,
        type: 'system',
        title_ar: 'تم حفظ البحث',
        title_en: 'Search saved',
        message_ar: `تم حفظ البحث "${saveSearchName.trim()}" بنجاح.`,
        message_en: `Search "${saveSearchName.trim()}" saved successfully.`,
      }).catch(() => {});

      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saved_search_created',
          entity_type: 'saved_search',
          entity_id: savedId,
          details: { name: saveSearchName.trim(), query: debouncedQuery || null },
        }),
      }).catch(() => {});

      toast({
        title: locale === 'ar' ? 'تم حفظ البحث' : 'Search saved',
        description:
          locale === 'ar'
            ? 'يمكنك العثور عليه في "عمليات البحث المحفوظة".'
            : 'You can find it under "Saved searches".',
      });
      setSaveSearchOpen(false);
      setSaveSearchName('');
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : 'Failed to save search',
        variant: 'destructive',
      });
    } finally {
      setSavingSearch(false);
    }
  };

  const handleAddToCompare = (productId: string) => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      const existing: string[] = stored ? JSON.parse(stored) : [];
      const unique = Array.from(new Set(existing));
      const selectedProduct = products.find((product) => product.id === productId);

      // Toggle: if already in compare, remove it.
      if (unique.includes(productId)) {
        const next = unique.filter((id) => id !== productId);
        const rawCache = window.localStorage.getItem(COMPARE_CACHE_STORAGE_KEY);
        const existingCache: Record<string, Product> = rawCache ? JSON.parse(rawCache) : {};
        delete existingCache[productId];
        window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
        window.localStorage.setItem(COMPARE_CACHE_STORAGE_KEY, JSON.stringify(existingCache));
        window.dispatchEvent(new Event('compare-products-updated'));
        toast({
          title: locale === 'ar' ? 'تمت الإزالة' : 'Removed',
          description:
            locale === 'ar'
              ? 'تم حذف المنتج من المقارنة.'
              : 'Removed from your compare list.',
        });
        return;
      }
      if (unique.length >= 4) {
        toast({ title: t('common.error'), description: t('compare.maxProducts'), variant: 'destructive' });
        return;
      }

      const next = [productId, ...unique].slice(0, 4);

      const rawCache = window.localStorage.getItem(COMPARE_CACHE_STORAGE_KEY);
      const existingCache: Record<string, Product> = rawCache ? JSON.parse(rawCache) : {};
      if (selectedProduct) {
        existingCache[productId] = selectedProduct;
      }
      const nextCache = next.reduce<Record<string, Product>>((acc, id) => {
        const cachedProduct = existingCache[id];
        if (cachedProduct) {
          acc[id] = cachedProduct;
        }
        return acc;
      }, {});

      window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
      window.localStorage.setItem(COMPARE_CACHE_STORAGE_KEY, JSON.stringify(nextCache));
      window.dispatchEvent(new Event('compare-products-updated'));
    } catch {
      // ignore storage errors
    }
  };


  const handleSaveToWishlist = async (productId: string) => {
    if (!user) {
      router.push(`/${locale}/auth/login?redirect=/wishlist`);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // Search results use temporary IDs (SKU-based), not DB UUIDs.
    // Use the server API to find or create the product (bypasses RLS).
    let dbProductId = productId;
    const isDbUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);

    if (!isDbUuid) {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const res = await fetch('/api/products/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_en: product.name_en,
          name_ar: product.name_ar,
          slug: product.slug,
          category: product.category,
          brand: product.brand,
          model: product.model,
          image_urls: product.image_urls,
          product_stores: (product.product_stores || []).map(ps => ({
            store_slug: ps.stores?.id,
            current_price: ps.current_price,
            original_price: ps.original_price,
            product_url: ps.product_url,
            availability: ps.availability,
            is_deal: ps.is_deal,
            is_free_delivery: ps.is_free_delivery,
          })),
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.id) {
        toast({
          title: t('common.error'),
          description: result.error || t('products.saveError'),
          variant: 'destructive',
        });
        return;
      }
      dbProductId = result.id;
    }

    try {
      const { error: saveError } = await supabase.from('user_wishlists').insert({
        user_id: user.id,
        product_id: dbProductId,
      });

      if (saveError && saveError.code === '23505') {
        toast({ title: t('products.saved'), description: t('products.alreadySaved') });
        return;
      }

      if (saveError) throw saveError;

      incrementSaveCount(dbProductId).catch((err) => {
        console.error('Error incrementing save count:', err);
      });

      // Update local saved set so heart fills immediately
      const savedProduct = products.find(p => p.id === productId);
      if (savedProduct?.name_en) {
        setSavedProductNames(prev => new Set([...prev, savedProduct.name_en]));
      }

      window.dispatchEvent(new Event('wishlist-updated'));
      toast({ title: t('products.saved'), description: t('products.savedToWishlist') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : t('products.saveError'),
        variant: 'destructive',
      });
    }
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
    filters.stores.forEach(s =>
      chips.push({ label: storeLabels[s as keyof typeof storeLabels] || s, type: 'store', value: s })
    );
    filters.availability.forEach(a => chips.push({ label: a, type: 'availability', value: a }));
    if (filters.dealsOnly) chips.push({ label: t('search.filters.showDealsOnly'), type: 'deals' });
    if (filters.freeDeliveryOnly) chips.push({ label: t('search.filters.freeDeliveryOnly'), type: 'freeDelivery' });
    if (filters.minRating && filters.minRating > 0) chips.push({ label: `${filters.minRating}+`, type: 'rating' });
    if (filters.discount) chips.push({ label: `+${filters.discount}%`, type: 'discount' });
    filters.condition?.forEach(c => chips.push({ label: c, type: 'condition', value: c }));
    filters.shipping?.forEach(s => chips.push({ label: s, type: 'shipping', value: s }));
    if (filters.specs) {
      Object.entries(filters.specs).forEach(([key, values]) => {
        values.forEach(v => chips.push({ label: `${key}: ${v}`, type: `spec:${key}`, value: v }));
      });
    }
    return chips;
  }, [filters, storeLabels, t]);

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

      {/* Store errors logged to console only — not shown to users */}
      {!loading && storeErrors && Object.keys(storeErrors).length > 0 && (() => {
        if (typeof window !== 'undefined') {
          console.warn('[search] store errors:', storeErrors);
        }
        return null;
      })()}

      {/* ── No-Query State ── hidden when browsing by category */}
      {!debouncedQuery && !loading && (!selectedCategory || selectedCategory === 'all') && (
        <div className="py-8">
          <div className="mx-auto max-w-3xl space-y-8">
            {/* Hero */}
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
                {t('search.startSearching')}
              </h1>
              <p className="text-base text-on-surface-variant">
                {t('search.searchSubtitle')}
              </p>
            </div>

            {/* Hero search bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchQuery.trim();
                if (q) { setDebouncedQuery(q); setCurrentPage(1); }
              }}
              className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2"
            >
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search.searchPlaceholder')}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white pe-3 ps-9 text-sm text-on-surface outline-none transition-all placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-900 dark:placeholder:text-gray-500 dark:focus:border-primary-400 dark:focus:ring-primary-400/20"
                  autoFocus
                />
              </div>
              <SearchVoiceBarcodeActions
                locale={locale}
                onQuery={(q) => handleSearch(q)}
              />
              <button
                type="submit"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-600"
              >
                <Search className="h-4 w-4" />
                {t('button.search')}
              </button>
            </form>

            {/* Popular searches */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-on-surface-variant">{t('search.popularSearches')}:</span>
              {(locale === 'ar'
                ? ['ايفون 16', 'سامسونج S24', 'ماك بوك', 'ايربودز', 'بلايستيشن 5', 'شاشة 4K']
                : ['iPhone 16', 'Samsung S24', 'MacBook', 'AirPods', 'PlayStation 5', '4K Monitor']
              ).map((term) => (
                <button
                  key={term}
                  onClick={() => handleQuickCategory(term)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-700 dark:hover:bg-primary-950/60 dark:hover:text-primary-300"
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Category cards */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {quickCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleQuickCategory(cat.query)}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 transition-all hover:border-primary-300 hover:bg-primary-50 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/60"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400 dark:group-hover:bg-primary-900/50">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-on-surface">
                      {t(`search.quickCategories.${cat.key}`)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Store trust row */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-xs font-medium text-on-surface-variant">{t('search.weSearchAcross')}</span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {SUPPORTED_SEARCH_STORES.map((slug) => (
                  <span
                    key={slug}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-on-surface dark:border-gray-700 dark:bg-gray-800"
                  >
                    {locale === 'ar'
                      ? (SEARCH_STORE_DISPLAY_NAMES[slug]?.name_ar ?? slug)
                      : (SEARCH_STORE_DISPLAY_NAMES[slug]?.name_en ?? slug)}
                  </span>
                ))}
              </div>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                <Zap className="h-3 w-3" />
                {t('search.featureRealTime')}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                <BarChart3 className="h-3 w-3" />
                {t('search.featureCompare')}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <BadgeCheck className="h-3 w-3" />
                {t('search.featureBestPrice')}
              </div>
            </div>

            {/* Search history */}
            {user && (
              <div>
                <SearchHistory limit={10} onSelectQuery={handleHistorySelect} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Active Search State ── shows when user has a query OR is browsing a category */}
      {(debouncedQuery || (selectedCategory && selectedCategory !== 'all')) && (
        <>
          {/* ── Main Content ── */}
          <div className="py-6">
            <div className="flex gap-6">
              {/* Desktop Filter Sidebar */}
              <div className="hidden lg:block w-64 shrink-0">
                <div className="sticky top-[120px] max-h-[calc(100vh-148px)] min-h-0 overflow-y-auto flex flex-col gap-3 scrollbar-hide">
                  <FilterSidebar
                    filters={filters}
                    onFilterChange={setFilters}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    category={selectedCategory !== 'all' ? selectedCategory : undefined}
                    locale={locale}
                  />
                </div>
              </div>

              {/* Results Area */}
              <div className="flex-1 min-w-0">
                {/* Mobile toolbar + filter chips */}
                <div className="mb-4">
                  {/* Mobile: results count, sort, filters button */}
                  <div className="flex items-center justify-between gap-4 lg:hidden">
                    {loading
                      ? <p className="t-small text-on-surface-variant animate-pulse">{scrapingProgress}</p>
                      : <ResultsMeta count={totalCount} latencyMs={searchLatencyMs ?? undefined} />
                    }
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="relative"
                        onClick={() => setMobileFiltersOpen(true)}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline ms-1">{t('search.mobileFilters')}</span>
                        {activeFilterCount > 0 && (
                          <span className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-[var(--brand-gold)] text-[var(--brand-dark-text)] text-xs flex items-center justify-center font-bold">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                  <MobileFilterSheet
                    open={mobileFiltersOpen}
                    onOpenChange={setMobileFiltersOpen}
                    filters={filters}
                    onFilterChange={setFilters}
                    onClearAll={clearAllFilters}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    category={selectedCategory !== 'all' ? selectedCategory : undefined}
                    locale={locale}
                    activeCount={activeFilterCount}
                  />
                  {/* Desktop sort + active chips row */}
                  <div className="mt-3 hidden lg:flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      {loading
                        ? <p className="t-small text-on-surface-variant animate-pulse">{scrapingProgress}</p>
                        : <ResultsMeta count={totalCount} latencyMs={searchLatencyMs ?? undefined} />
                      }
                    </div>
                    <div className="flex items-center gap-2">
                      {user && (debouncedQuery || activeFilterCount > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSaveSearchOpen(true)}
                          className="text-xs"
                        >
                          <BadgeCheck className="h-3.5 w-3.5 me-1" />
                          {locale === 'ar' ? 'حفظ البحث' : 'Save search'}
                        </Button>
                      )}
                      <SortSelector value={sortBy} onChange={setSortBy} />
                    </div>
                  </div>
                  {activeFilterCount > 0 && (
                    <div className="mt-3">
                      <ActiveFilterChips
                        filters={filters}
                        onRemove={setFilters}
                        onClearAll={clearAllFilters}
                        storeNameResolver={(slug) => getStoreDisplayName(slug, locale as 'ar' | 'en')}
                      />
                    </div>
                  )}
                </div>

                {/* Loading State — skeleton grid only, no progress banner */}
                {loading && <ResultsSkeleton count={8} />}

                {/* Error State */}
                {error && !loading && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* No Results */}
                {!loading && !error && products.length === 0 && (debouncedQuery || (selectedCategory && selectedCategory !== 'all')) && (
                  <div className="space-y-6">
                    <EmptyState
                      variant="search"
                      description={
                        debouncedQuery
                          ? t('search.noResultsFor').replace('{{query}}', debouncedQuery)
                          : (locale === 'ar'
                              ? 'لا توجد منتجات في هذه الفئة حالياً.'
                              : 'No products in this category yet.')
                      }
                    />
                    {/* Quick category suggestions */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {quickCategories.slice(0, 4).map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.key}
                            onClick={() => handleQuickCategory(cat.query)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] px-3 py-1.5 t-small font-medium text-on-surface transition-all hover:border-[var(--brand-green)] hover:bg-[var(--brand-bg-green)] hover:text-[var(--brand-green-dark)]"
                          >
                            <Icon className="h-3.5 w-3.5 text-[var(--brand-green-dark)]" />
                            {t(`search.quickCategories.${cat.key}`)}
                          </button>
                        );
                      })}
                    </div>
                    {/* Trending products rail — fallback when user query yields no hits */}
                    {trendingProducts.length > 0 && (
                      <div className="space-y-3 pt-4">
                        <h3 className="text-headline-sm text-on-surface">
                          {locale === 'ar' ? 'منتجات رائجة' : 'Trending products'}
                        </h3>
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                          {trendingProducts.slice(0, 8).map((p) => (
                            <ProductCard
                              key={`trending-${p.id}`}
                              product={p}
                              locale={locale}
                              onCompare={handleAddToCompare}
                              onSave={handleSaveToWishlist}
                              isSaved={savedProductNames.has(p.name_en)}
                              isInCompare={compareIds.has(p.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Products Grid */}
                {!loading && !error && products.length > 0 && (
                  <>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                            onSave={handleSaveToWishlist}
                            isSaved={savedProductNames.has(product.name_en)}
                            isInCompare={compareIds.has(product.id)}
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

      {/* Save-this-search dialog */}
      <Dialog open={saveSearchOpen} onOpenChange={setSaveSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === 'ar' ? 'حفظ هذا البحث' : 'Save this search'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'ar'
                ? 'امنحه اسماً لتتمكن من إعادة تشغيله لاحقاً من صفحة عمليات البحث المحفوظة.'
                : 'Give it a name so you can rerun it later from Saved Searches.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="saveSearchName">
              {locale === 'ar' ? 'اسم البحث' : 'Search name'}
            </Label>
            <Input
              id="saveSearchName"
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              placeholder={debouncedQuery || (locale === 'ar' ? 'بحثي المفضل' : 'My saved search')}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveSearchOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSaveCurrentSearch}
              disabled={savingSearch || !saveSearchName.trim()}
            >
              {savingSearch
                ? locale === 'ar' ? 'جاري الحفظ…' : 'Saving…'
                : locale === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
