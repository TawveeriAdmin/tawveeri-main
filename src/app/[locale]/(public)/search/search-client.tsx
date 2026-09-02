'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import { needPhrasings, needPrompt } from '@/lib/agent/need-phrasings';
import { useAuth } from '@/lib/auth/auth-context';
import { track, initTestModeFromUrl } from '@/lib/analytics/track';
import { initCampaignFromUrl } from '@/lib/analytics/campaign';
import { ProductCard } from '@/components/products/product-card';
import { SmartPickCard, type SmartPick } from '@/components/search/smart-pick-card';
import { ClosestOptions, type ClosestOption } from '@/components/search/closest-options';
import { AdvisorAnswer } from '@/components/agent/advisor-answer';
import { askAdvisor, type AdvisorResponse } from '@/lib/agent/advisor-api';
import { saveJourneyTask } from '@/lib/agent/journey-context';
import { classifyDecisionIntent } from '@/lib/agent/decision-intent';
import { isAmbiguousBareOvenQuery } from '@/lib/agent/task-parser';
import {
  readDecisionState, clearDecisionState, createDecisionState, applyParsedTask,
  applyDecisionResult, saveDecisionState, decisionStateToAdvisorBody, removeConstraint,
  type DecisionState,
} from '@/lib/agent/decision-state';
import { handleMutationTurn } from '@/lib/agent/mutation-turn';
import type { CounterfactualComparison } from '@/lib/agent/counterfactual';
import { CounterfactualCard } from '@/components/agent/counterfactual-card';
import { FollowUpSuggestions } from '@/components/agent/follow-up-suggestions';
import { ComparisonAnswer, type CompareRoute } from '@/components/search/comparison-answer';
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
import { PostSearchCampaignCard } from '@/components/campaigns/post-search-campaign-card';

type Product = ProductCardProduct;

type SortOption = 'popularity' | 'price_low' | 'price_high' | 'rating';

const ITEMS_PER_PAGE = 25;
const COMPARE_STORAGE_KEY = 'compare_products';
const COMPARE_CACHE_STORAGE_KEY = 'compare_products_cache';
const SEARCH_CACHE_KEY = 'search_results_cache';

const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const CATEGORY_SEARCH_LABELS: Partial<Record<ProductCategory, { ar: string; en: string }>> = {
  smartphone: { ar: 'الهواتف', en: 'Phones' },
  laptop: { ar: 'اللابتوبات', en: 'Laptops' },
  tablet: { ar: 'الأجهزة اللوحية', en: 'Tablets' },
  tv: { ar: 'التلفزيونات', en: 'TVs' },
  audio: { ar: 'الصوتيات', en: 'Audio' },
  gaming: { ar: 'الألعاب', en: 'Gaming' },
  camera: { ar: 'الكاميرات', en: 'Cameras' },
  monitor: { ar: 'الشاشات', en: 'Monitors' },
  wearable: { ar: 'الساعات الذكية', en: 'Wearables' },
  networking: { ar: 'الشبكات', en: 'Networking' },
  smart_home: { ar: 'المنزل الذكي', en: 'Smart Home' },
  printer: { ar: 'الطابعات', en: 'Printers' },
  appliance: { ar: 'الأجهزة المنزلية', en: 'Appliances' },
  refrigerator: { ar: 'الثلاجات', en: 'Fridges' },
  kitchen: { ar: 'المطبخ', en: 'Kitchen' },
  personal_care: { ar: 'العناية الشخصية', en: 'Personal Care' },
  accessories: { ar: 'الإكسسوارات', en: 'Accessories' },
};

function getCategorySearchLabel(category: ProductCategory | 'all' | null, locale: string) {
  if (!category || category === 'all') return '';
  const label = CATEGORY_SEARCH_LABELS[category];
  return locale === 'ar' ? label?.ar || '' : label?.en || '';
}

function parseCsvParam(...values: Array<string | null>): string[] {
  const raw = values.find((value) => value && value.trim().length > 0);
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseNumberParam(...values: Array<string | null>): number | undefined {
  const raw = values.find((value) => value && value.trim().length > 0);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanParam(...values: Array<string | null>): boolean {
  return values.some((value) => value === '1' || value === 'true');
}

// Session-storage helpers for persisting search results across navigation.
// `total` is the server's exact match count so pagination can render
// correctly after a cache-restored back-nav without a refetch.
function getSearchCache(): { query: string; category: string; products: Product[]; total: number; timestamp: number } | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after TTL
    if (parsed.timestamp && Date.now() - parsed.timestamp > SEARCH_CACHE_TTL) {
      sessionStorage.removeItem(SEARCH_CACHE_KEY);
      return null;
    }
    return { ...parsed, total: typeof parsed.total === 'number' ? parsed.total : (parsed.products?.length ?? 0) };
  } catch { return null; }
}

function setSearchCache(query: string, category: string, products: Product[], total: number) {
  try {
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ query, category, products, total, timestamp: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

// MEASURED DEFECT (2026-08-20, «أبي تليفزيون ب 250ريال»): the empty-search state fell through
// to a "Trending products" rail — an unfiltered last-8-inserted-products query with no relation
// to the search or its budget. When the API's `categoryEnforcedZero` honestly zeroed out a query
// that named an explicit budget (`appliedBudget`), this rail silently replaced a true "nothing
// in your budget" with whatever was last added to the catalog (which happened to be TVs), making
// a stated budget look ignored. Suppression must be conditioned on BOTH signals together — a
// plain no-budget empty search (categoryEnforcedZero without a budget, or a budget without an
// enforced zero) must keep the trending fallback, which is deliberate and useful there.
export function shouldSuppressTrendingRail(categoryEnforcedZero: boolean, appliedBudget: number | null): boolean {
  return categoryEnforcedZero && appliedBudget !== null;
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
  const initialDisplayQuery = urlQuery || getCategorySearchLabel(initialCategory, locale);

  const [searchQuery, setSearchQuery] = useState(initialDisplayQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  // Server's exact match count across the whole catalog — drives real
  // pagination (not the capped client-side slice we used to do).
  const [serverTotal, setServerTotal] = useState(0);
  const [loading, setLoading] = useState(!!urlQuery || initialCategory !== 'all');
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>(initialCategory);
  const [scrapingProgress, setScrapingProgress] = useState<string>('');
  const [storeErrors, setStoreErrors] = useState<Record<string, string>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  // P2-7: the sheet is opened by state, not by a Radix Dialog.Trigger, so Radix has no
  // element to hand focus back to when it closes. Give it one.
  const mobileFiltersTriggerRef = useRef<HTMLButtonElement>(null);
  const [externalQueryKey, setExternalQueryKey] = useState(0);
  const [storeErrorsExpanded, setStoreErrorsExpanded] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchLatencyMs, setSearchLatencyMs] = useState<number | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [savedProductNames, setSavedProductNames] = useState<Set<string>>(new Set());
  const [storeStats, setStoreStats] = useState<{ total: number; successful: number } | null>(null);
  const [smartPick, setSmartPick] = useState<SmartPick | null>(null);
  // A budget PARSED FROM THE QUERY TEXT (never a sidebar choice) that the route applied as
  // a real retrieval-level price ceiling (2026-08-09) — Constitution/trust requires this be
  // disclosed to the customer, never silent, so the grid isn't quietly narrower than what
  // the header count implies without the shopper knowing why.
  const [appliedBudget, setAppliedBudget] = useState<number | null>(null);
  // MEASURED DEFECT (2026-08-20, «أبي تليفزيون ب 250ريال»): the API's `categoryEnforcedZero`
  // ("zero beats wrong" — no product matched the explicit category+budget, so retrieval
  // honestly returned nothing) was never captured client-side. The empty state below fell
  // through to the "Trending products" rail, which is an unfiltered last-8-inserted query
  // with no relation to the search or its budget — so a luxury TV could appear as if it were
  // an answer to a 250 SAR ask. This flag lets the empty-state render suppress that rail
  // ONLY when the zero was budget-caused, never for a plain no-budget empty search.
  const [categoryEnforcedZero, setCategoryEnforcedZero] = useState(false);
  // ADR-270 Fix 4 (2026-08-22) — "Tawveeri never shows an empty result": when a stated/
  // inferred budget zeroed retrieval, the API's `closestOptions` names the 1-3 cheapest
  // still-relevant candidates with why each missed. Never rendered as "اختيار توفيري".
  const [closestOptions, setClosestOptions] = useState<ClosestOption[]>([]);
  // P2-8 (UNIFIED SEARCH). One entry point; the system decides internally which capability
  // the query needs. `routeQuery` makes that decision deterministically and this holds the
  // reasoning engine's answer when it does. Fetched ALONGSIDE the results, never before
  // them — the results must not wait on reasoning.
  const [advisorResult, setAdvisorResult] = useState<AdvisorResponse | null>(null);
  // MEASURED DEFECT (2026-08-09, Golden Query «مكيف لغرفة 30 متر هادي تحت 4000»): the advisor
  // is fetched async and un-awaited (by design, see below), but the "No Results" empty state
  // only checked `products.length === 0` — never `advisorResult` or an in-flight request. A
  // needs-based query whose literal retrieval legitimately returns 0 (or returns 0 for the
  // seconds before the advisor resolves) showed a discouraging «لم نعثر على نتائج» ABOVE a
  // correct, evidence-backed Waffar answer that had already loaded or was about to. This
  // tracks the in-flight window so the empty state can be suppressed while Waffar is working,
  // not only after it has answered.
  const [advisorPending, setAdvisorPending] = useState(false);
  const advisorAbortRef = useRef<AbortController | null>(null);
  // The query the advisor answer belongs to, so a clarification can re-ask the SAME text
  // rather than whatever is in the input box by the time the shopper answers.
  const advisorQueryRef = useRef<string>('');
  // Counterfactual reasoning (Section 12, "لو زدت الميزانية 500 وش بيتغير؟") — a real
  // before/after decision-engine comparison, built only when a delta and the prior budget
  // are both nameable. See classifyDecisionIntent's COUNTERFACTUAL branch below.
  const [counterfactualComparison, setCounterfactualComparison] = useState<CounterfactualComparison | null>(null);
  // Section 44 closure — EXTERNAL_PRODUCT_REFERENCE (a pasted URL). An honest "not yet"
  // notice instead of running the URL string as a garbage catalog search.
  const [externalReferenceNotice, setExternalReferenceNotice] = useState(false);
  // Comparison routing. Computed server-side by /api/search and only when the query carries
  // comparison intent — the client never decides whether a comparison can be delivered.
  const [compareRoute, setCompareRoute] = useState<CompareRoute | null>(null);
  const [relaxed, setRelaxed] = useState(false); // true when results are "nearby/related", not an exact match
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
  // Persist test/real opt-in (?test=1) so storefront funnel events separate testers from real users.
  useEffect(() => { initTestModeFromUrl(); initCampaignFromUrl(); }, []);

  // MEASURED (2026-08-10, follow-up-continuation mission): re-clicking a follow-up chip whose
  // resulting query URL was already visited earlier in the session (e.g. tapping the same
  // suggestion twice) silently undid the `scrollIntoView` + highlight below — the browser's
  // native scroll-position memory for that history entry snapped the page back right after our
  // own scroll ran. `history.scrollRestoration = 'manual'` is the standard SPA fix: this page
  // fully owns its own scroll behavior via `router.replace(..., { scroll: false })` and the
  // explicit scrollIntoView calls, so the browser's automatic restoration must never compete.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

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
      .order('created_at', { ascending: false })
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

  // Wrappers used on every user-initiated filter/sort change. They reset
  // pagination to page 1 so the user doesn't land on "page 5" of a freshly
  // filtered result set. Raw `setFilters` is still used by the URL-sync
  // path (which carries page separately) and `removeFilter`/`clearAllFilters`
  // (which explicitly reset page themselves).
  const setFiltersAndResetPage = useCallback((
    update: SearchFilters | ((prev: SearchFilters) => SearchFilters),
  ) => {
    setFilters(update);
    setCurrentPage(1);
  }, []);
  const setSortByAndResetPage = useCallback((next: SortOption) => {
    setSortBy(next);
    setCurrentPage(1);
  }, []);

  // Sync search query from URL params (e.g. when header search navigates here)
  const urlQueryRef = useRef(urlQuery);
  const urlCategoryRef = useRef(initialCategory);
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    const urlCategory = (searchParams.get('category') as ProductCategory | 'all') || 'all';
    const queryOrCategoryLabel = urlQuery || getCategorySearchLabel(urlCategory, locale);

    if (urlQuery !== urlQueryRef.current || urlCategory !== urlCategoryRef.current) {
      urlQueryRef.current = urlQuery;
      urlCategoryRef.current = urlCategory;
      setSearchQuery(queryOrCategoryLabel);
      setDebouncedQuery(urlQuery);
      setSelectedCategory(urlCategory);
      setCurrentPage(1);
    }
  }, [searchParams, locale]);

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
    // ADR-282: this effect is the SOLE owner of URL writes for q/category/filters/sort/page —
    // a sibling effect used to ALSO write `q` to the URL independently (removed, see below), and
    // this effect never updated urlQueryRef/urlCategoryRef even though it writes `q` too. That
    // let the "URL → state sync" effect above mistake OUR OWN router.replace echo for a genuine
    // external URL change and re-apply it, racing this effect's next run — the two effects could
    // then keep re-triggering each other. Measured in production 2026-08: at least 4 sessions
    // this way fired an identical `search` track() call 150-242 times in under a minute.
    // Stamp the refs with what we are ABOUT to write so that echo is inert.
    urlQueryRef.current = debouncedQuery;
    urlCategoryRef.current = selectedCategory;
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

  // Founder taxonomy audit (2026-08-19): a bare «فرن كهربائي»/«فرن غاز» is genuinely ambiguous
  // in the SOURCE market data (LG's own official product title for a full 5-burner range reads
  // «فرن كهربائي», identically to a built-in oven's own title) — never silently guessed. This
  // never touches decide()/shouldAsk(): a bare category browse like this has no need signal and
  // never reaches the advisor's own clarify mechanism at all.
  const showOvenClarify = useMemo(
    () => (debouncedQuery ? isAmbiguousBareOvenQuery(debouncedQuery) : false),
    [debouncedQuery],
  );

  // Remove a single filter (also resets to page 1 so the user doesn't
  // land on a page that doesn't exist in the smaller result set).
  const removeFilter = useCallback((type: string, value?: string) => {
    setCurrentPage(1);
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
    setCurrentPage(1);
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

  const serverFilterKey = useMemo(() => JSON.stringify({
    brands: filters.brands,
    stores: filters.stores,
    availability: filters.availability,
    dealsOnly: filters.dealsOnly,
    freeDeliveryOnly: filters.freeDeliveryOnly,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    discount: filters.discount,
    specs: filters.specs,
  }), [
    filters.brands,
    filters.stores,
    filters.availability,
    filters.dealsOnly,
    filters.freeDeliveryOnly,
    filters.minPrice,
    filters.maxPrice,
    filters.discount,
    filters.specs,
  ]);

  // Reset page when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy]);

  // Server-side pagination + filters + sort: the API does all the heavy
  // lifting now, so `rawProducts` already holds exactly the current page
  // and `serverTotal` holds the full match count across the catalog.
  // Two filters remain client-side because the current schema has no
  // precomputed column for them — applied to the current page only:
  //   - `discount` (percentage threshold): computed from original_price/current_price.
  //   - Spec filters when DB specs are empty: title-regex fallback via
  //     extractSpecsFromTitle. Most Noon rows have no structured specs
  //     yet, so this fallback keeps the filter chips useful until we
  //     ingest specs during scraping.
  const { products, totalCount } = useMemo(() => {
    let result = rawProducts;

    if (filters.discount) {
      result = result.filter(product => {
        const ps = product.product_stores[0];
        if (!ps?.original_price || !ps.current_price) return false;
        const pct = ((ps.original_price - ps.current_price) / ps.original_price) * 100;
        return pct >= filters.discount!;
      });
    }

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

    return { products: result, totalCount: serverTotal };
  }, [rawProducts, serverTotal, filters.discount, filters.specs]);

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
    const specFilters: NonNullable<SearchFilters['specs']> = {};
    for (const [key, value] of p.entries()) {
      if (key.startsWith('spec:') && value) {
        specFilters[key.replace('spec:', '')] = parseCsvParam(value);
      }
    }
    const storesFromUrl = parseCsvParam(p.get('stores'))
      .map((store) => store.toLowerCase())
      .filter(isSupportedSearchStore);

    const urlFilters: SearchFilters = {
      brands: parseCsvParam(p.get('brand'), p.get('brands')),
      stores: storesFromUrl,
      availability: parseCsvParam(p.get('availability')) as AvailabilityStatus[],
      dealsOnly: parseBooleanParam(p.get('dealsOnly'), p.get('deals')),
      freeDeliveryOnly: parseBooleanParam(p.get('freeDeliveryOnly'), p.get('freeDelivery')),
      minRating: parseNumberParam(p.get('minRating'), p.get('rating')),
      minPrice: parseNumberParam(p.get('priceMin'), p.get('min_price')),
      maxPrice: parseNumberParam(p.get('priceMax'), p.get('max_price')),
      specs: Object.keys(specFilters).length > 0 ? specFilters : undefined,
      discount: parseNumberParam(p.get('discount')),
      condition: parseCsvParam(p.get('condition')),
      shipping: parseCsvParam(p.get('shipping')),
    };
    if (urlFilters.condition?.length === 0) urlFilters.condition = undefined;
    if (urlFilters.shipping?.length === 0) urlFilters.shipping = undefined;
    setFilters(urlFilters);
  }, [filterParamsString]);

  // Note: debouncedQuery is set explicitly on form submit / handleSearch.
  // No auto-debounce — search only triggers on Enter or button click.
  //
  // ADR-282 (2026-09): a second "Update URL when search changes" effect used to live here,
  // independently calling router.replace to write ONLY `q` to the URL on the exact same
  // debouncedQuery/searchParams triggers the "state → URL write-back" effect above already
  // handles (it writes q + category + every filter + sort + page in one place). Two effects
  // racing separate router.replace calls off overlapping deps, one of them updating
  // urlQueryRef and the other not, is what let the URL→state sync effect mistake its own
  // echo for an external change and re-fire — removed; the write-back effect above is now
  // the SOLE writer of `q` (and everything else) into the URL, and it stamps urlQueryRef/
  // urlCategoryRef itself before calling router.replace so this class of loop cannot recur.

  // Fetch one page from the DB-backed search API. Every page change,
  // filter change, or sort change re-enters this function — the server
  // owns pagination/filtering/sorting now, so the client just sends
  // state and renders what comes back.
  async function searchWithScraping(
    query: string,
    _unusedStores: string[] = DEFAULT_SEARCH_STORES,
    _unusedPages: number = 5,
    signal?: AbortSignal,
  ) {
    void _unusedStores;
    void _unusedPages;

    // ── D→E MISSION, SECTION 5 · "FOLLOW-UP IS A STATE MUTATION, NOT A SEARCH" ──────────
    // THE FOUNDER'S OWN PRODUCTION FAILURE: «طيب لو رفعت ميزانيتي إلى 4000 ريال وش بيتغير؟»,
    // typed into this SAME primary box after a phone mission, used to fall through to the
    // plain product-catalog search below — a whole Arabic sentence run as a literal query,
    // which is how a $49 phone-accessory cable ended up "recommended" alongside 18 generic
    // results. `handleMutationTurn` (mutation-turn.ts) is the ONE shared function — also
    // called by the dedicated post-decision refinement composer, Section 9 — that decides
    // whether this turn continues an existing mission and, if so, EXECUTES it without ever
    // reaching the catalog search. Computed FIRST, before any state mutation, so a turn that
    // resolves to "leave the screen alone" (FOLLOW_UP_REASONING) never even flashes a loading
    // state first.
    if (currentPage === 1) {
      const mutationCtrl = new AbortController();
      advisorAbortRef.current?.abort();
      advisorAbortRef.current = mutationCtrl;
      setAdvisorPending(true);
      const { intent: decisionIntent, outcome } = await handleMutationTurn(query.trim(), advisorResult, { signal: mutationCtrl.signal });
      if (mutationCtrl.signal.aborted) return;
      if (outcome.kind !== 'not_a_mutation') {
        setAdvisorPending(false);
        switch (outcome.kind) {
          case 'noop': {
            // MEASURED DEFECT (2026-08-10, D→E mission Part C, extended in the follow-up-
            // continuation mission to «وين أشتريه؟» too): a "why"/"where" question is
            // architecturally a no-op — the answer is already on screen — but that used to
            // mean literally ZERO visible reaction to a prominent, tappable suggestion chip.
            // A shopper tapping it and seeing nothing happen reads as broken, not "already
            // answered". Scroll to and briefly highlight the existing content that answers it,
            // rather than fabricating new text (or, for "where", firing a redundant re-fetch
            // that returns the identical recommendation).
            track('advisor_query', { query_text: query.trim(), source: 'search', meta: { reason: `${outcome.reason}_noop` } });
            const targetId = outcome.reason === 'where' ? 'advisor-exit-buttons' : 'advisor-why-reasons';
            const target = document.getElementById(targetId)
              ?? document.querySelector('[data-testid="advisor-answer"]');
            if (target) {
              // MEASURED (2026-08-10, follow-up-continuation mission, production verification):
              // `behavior: 'smooth'` scrollIntoView is a rAF-driven animation that can silently
              // fail to complete depending on the tab's paint/compositor scheduling — an instant
              // jump is the only version of "the user SEES the response" that has no dependency
              // on an animation finishing. The ring highlight's own `transition-shadow
              // duration-700` still gives the moment a soft, non-jarring feel.
              target.scrollIntoView({ behavior: 'auto', block: 'center' });
              const highlightClasses = ['ring-2', 'ring-primary-300', 'rounded-xl', 'transition-shadow', 'duration-700'];
              target.classList.add(...highlightClasses);
              window.setTimeout(() => target.classList.remove(...highlightClasses), 1800);
            }
            break;
          }
          case 'external_reference_notice':
            track('advisor_query', { query_text: query.trim(), source: 'search', meta: { reason: 'external_product_reference' } });
            setExternalReferenceNotice(true);
            break;
          case 'no_context':
            // A mutation-shaped question with nothing to act on (no active mission, or no
            // nameable delta/target) — honest silence, never a fabricated answer. The screen
            // is left exactly as it was, same as `noop`.
            track('advisor_query', { query_text: query.trim(), source: 'search', meta: { reason: `mutation_no_context:${decisionIntent.intent}` } });
            break;
          case 'counterfactual':
            setCounterfactualComparison(outcome.comparison);
            track('advisor_result', { query_text: query.trim(), source: 'search', meta: { reason: 'counterfactual', changed: outcome.comparison.changed, worth_it: outcome.comparison.worth_it } });
            break;
          case 'mutation':
            setAdvisorResult(outcome.advisorResult);
            track('advisor_result', {
              query_text: query.trim(), category: outcome.advisorResult.parsed?.category ?? null, source: 'search',
              meta: { count: outcome.advisorResult.count, supported: outcome.advisorResult.supported, has_smart_pick: !!outcome.advisorResult.smart_pick, mismatch: !!outcome.advisorResult.smart_pick?.size_mismatch, reason: decisionIntent.intent },
            });
            break;
        }
        return; // NEVER falls through to the plain catalog search for a mutation-shaped turn.
      }
      setAdvisorPending(false);
      setExternalReferenceNotice(false);
    }

    // classifyDecisionIntent WRAPS routeQuery (Phase 2, ADR-230) — `.route` is byte-identical
    // to what a bare `routeQuery(query.trim())` call would have returned, so every existing
    // `route.mode` branch below is unchanged. Re-classified here (cheap, pure, synchronous)
    // for the fields `handleMutationTurn`'s return does not expose — this path only runs when
    // the turn was NOT a mutation (a fresh search/browse/comparison/need), so re-deriving the
    // SAME classification here is not a second decision, just a second read of it.
    const decisionIntent = classifyDecisionIntent(query.trim(), { hasActiveDecisionState: !!readDecisionState() });
    const route = decisionIntent.route;

    // ── D→E MISSION, SECTION 10 · "STARTING A NEW MISSION" ──────────────────────────────
    // A turn that reaches here was NOT mutation-shaped (`handleMutationTurn` returned
    // 'not_a_mutation') — but it can still name a DIFFERENT category than an active mission's
    // own DecisionState, e.g. «طيب ابي مكيف للصالة» typed right after a phone mission. That
    // query has no need signal of its own (routeQuery correctly sends it to plain retrieval —
    // P2-8's own "a bare category is a browse, not a need" rule, untouched by this mission), so
    // it never reaches `applyParsedTask`'s own mission-switch check. Left alone, the OLD
    // mission's chips/budget/priorities would keep rendering as "current understanding" for a
    // category the customer has visibly moved on from. Clearing here is deliberately narrow:
    // only when a category was actually classified AND it differs from the active mission's —
    // an unclassifiable or same-category query never touches the existing mission.
    const activeStateForBrowse = readDecisionState();
    if (activeStateForBrowse && route.task?.category && route.task.category !== activeStateForBrowse.category) {
      clearDecisionState();
    }

    setLoading(true);
    setError(null);
    setSmartPick(null); // cleared per search; only a fresh trustworthy pick is shown
    setCompareRoute(null); // a stale comparison claim must never outlive its query
    setAppliedBudget(null); // a stale inferred-budget disclosure must never outlive its query
    setCategoryEnforcedZero(false); // a stale honest-zero flag must never outlive its query
    setScrapingProgress(t('search.searchingStores'));
    setStoreErrors({});

    // ── P2-8 · UNIFIED SEARCH — the routing decision ────────────────────────────────
    // "Routing is determined by the query, NEVER by the customer." The customer typed
    // into one box; `routeQuery` decides whether this query needs retrieval alone or
    // also needs the reasoning engine, and the answer renders in the same results view.
    //
    // Three deliberate constraints:
    //   1. NOT awaited. The advisor's read is heavier than search's. Awaiting it would
    //      make every need-based query slower to show ANY result, which trades the
    //      unified experience against the thing customers actually came for.
    //   2. Page 1 only. Pagination and filter changes re-enter this function with the
    //      same query; re-asking would spend a rate-limit token per filter click and
    //      re-render an answer that has not changed.
    //   3. Its own AbortController, so a superseded query's answer can never land on a
    //      newer query's results.
    advisorAbortRef.current?.abort();
    setAdvisorResult(null);
    setCounterfactualComparison(null); // a stale before/after must never outlive its query

    // NEEDS_DISCOVERY only from here — every other intent (DEAL_EVALUATION,
    // SAME_PRODUCT_VERIFICATION, MERCHANT_SELECTION, COUNTERFACTUAL, CONSTRAINT_CHANGE,
    // FOLLOW_UP_REASONING, EXTERNAL_PRODUCT_REFERENCE) was already fully handled — and
    // returned from — by `handleMutationTurn` above. This branch and the plain product
    // search below it are UNCHANGED from before the D→E mission.
    setAdvisorPending(route.mode === 'advisory' && currentPage === 1);
    if (route.mode === 'advisory' && currentPage === 1) {
      const advisorCtrl = new AbortController();
      advisorAbortRef.current = advisorCtrl;
      advisorQueryRef.current = query.trim();
      track('advisor_query', { query_text: query.trim(), source: 'search', meta: { reason: route.reason } });
      askAdvisor({ text: query.trim() }, { signal: advisorCtrl.signal, limit: 4 })
        .then((res) => {
          if (advisorCtrl.signal.aborted) return;
          setAdvisorPending(false);
          // Render only a real answer. An error or an empty set on the UNIFIED surface must
          // stay silent: the results below are a perfectly good answer. Silent to the
          // CUSTOMER, never to the ledger — every advisor non-answer ends in a recorded state.
          if (res.error || res.count === 0) {
            track(res.error ? 'error' : 'no_answer', {
              query_text: query.trim(), source: 'search',
              meta: { surface: 'advisor', advisor_state: res.error ? 'unavailable' : 'rejected' },
            });
            return;
          }
          setAdvisorResult(res);
          saveJourneyTask(res.parsed, query.trim()); // ONE TAWVEERI BRAIN: carries to a product-page Waffar question
          track('advisor_result', {
            query_text: query.trim(), category: res.parsed?.category ?? null, source: 'search',
            meta: { count: res.count, supported: res.supported, has_smart_pick: !!res.smart_pick, mismatch: !!res.smart_pick?.size_mismatch },
          });
        })
        .catch(() => {
          if (advisorCtrl.signal.aborted) return;
          setAdvisorPending(false);
          track('error', { query_text: query.trim(), source: 'search', meta: { surface: 'advisor', advisor_state: 'unavailable' } });
        });
    }

    // Funnel step 1 — Search (storefront surface). Only on page 1 (a real new query),
    // not on pagination/filter re-fetches which reuse the same query.
    if (currentPage === 1) {
      track('search', {
        query_text: query.trim(),
        category: selectedCategory !== 'all' ? selectedCategory : null,
        source: 'web',
      });
    }

    // Map the UI's sort values to the API's vocabulary. The API accepts
    // both naming styles (`price_asc`/`price_low` etc.) so either works.
    const sortForApi = sortBy === 'popularity' ? 'relevance' : sortBy;

    // A 429 from our own rate limiter used to surface as an empty results page — the
    // customer was told "nothing found" when the truth was "ask again in a moment".
    // Retry once, honouring Retry-After but capped so the UI never hangs, then fail
    // with an honest message rather than a false emptiness.
    const postSearch = async (body: string, attempt = 0): Promise<Response> => {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body,
      });
      if (res.status !== 429 || attempt >= 1) return res;
      const headerWait = Number(res.headers.get('Retry-After'));
      const waitMs = Math.min(Math.max(Number.isFinite(headerWait) ? headerWait * 1000 : 1200, 600), 3000);
      await new Promise((r) => setTimeout(r, waitMs));
      if (signal?.aborted) return res;
      return postSearch(body, attempt + 1);
    };

    try {
      const response = await postSearch(
        JSON.stringify({
          query: query.trim(),
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          brands: filters.brands.length > 0 ? filters.brands : undefined,
          stores: filters.stores.length > 0 ? filters.stores : undefined,
          availability: filters.availability.length > 0 ? filters.availability : undefined,
          deals_only: filters.dealsOnly || undefined,
          free_delivery_only: filters.freeDeliveryOnly || undefined,
          min_price: filters.minPrice,
          max_price: filters.maxPrice,
          discount: filters.discount,
          specs: filters.specs,
          sort: sortForApi,
          page: currentPage,
          pageSize: ITEMS_PER_PAGE,
        }),
      );

      if (!response.ok) {
        let errorData: Record<string, string> = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        let errorMessage = errorData.error || errorData.message || `Failed to scrape products (${response.status})`;

        if (response.status === 429) {
          // Say what actually happened. "No results" for a rate limit is a false statement
          // about our catalogue.
          errorMessage = locale === 'ar'
            ? 'الطلبات كثيرة الآن. أعد المحاولة بعد لحظات — النتائج موجودة، الخدمة مشغولة فقط.'
            : 'Too many requests right now. Try again in a moment — the results exist, the service is just busy.';
        } else if (response.status === 403) {
          // ADR-259: this said "Please ensure Flask is running (npm run flask:start)" — a
          // developer instruction for a Python service this app has not used in months,
          // shown to Saudi shoppers in English on a 403. Consumer-facing errors never name
          // internal services or tell a customer to run a command.
          errorMessage = locale === 'ar'
            ? 'تعذّر تحميل النتائج الآن. جرّب مرة أخرى بعد قليل.'
            : 'We could not load results just now. Please try again in a moment.';
        } else if (response.status === 503) {
          // Same reasoning as the 403 above. `errorData.error` is deliberately NOT surfaced
          // here — a 503 body can carry upstream/internal detail, and an error string is not
          // something to relay verbatim to a shopper.
          errorMessage = locale === 'ar'
            ? 'الخدمة مشغولة الآن. جرّب مرة أخرى بعد قليل.'
            : 'The service is busy right now. Please try again in a moment.';
        }

        console.error('[Search] Scraping error:', { status: response.status, error: errorData });
        throw new Error(errorMessage);
      }

      const data: ScrapedSearchResult & { total?: number } = await response.json();

      const mappedProducts: Product[] = data.products.map((grouped) => {
        return mapGroupedToProductCard(grouped) as Product;
      });

      const total = typeof data.total === 'number' ? data.total : mappedProducts.length;
      setRawProducts(mappedProducts);
      setServerTotal(total);
      setRelaxed(!!((data as unknown) as { relaxed?: boolean }).relaxed);
      const decisionCard = ((data as unknown) as { decisionCard?: SmartPick }).decisionCard ?? null;
      const inferredMaxPrice = ((data as unknown) as { inferredMaxPrice?: number | null }).inferredMaxPrice ?? null;
      const closestOptionsData = ((data as unknown) as { closestOptions?: ClosestOption[] }).closestOptions ?? [];
      // Funnel step 2 — Results (or off-funnel no_answer when the storefront returns nothing).
      if (currentPage === 1) {
        const cat = selectedCategory !== 'all' ? selectedCategory : null;
        if (total > 0) {
          track('results', {
            query_text: query.trim(), category: cat, source: 'web',
            meta: { count: total, has_smart_pick: !!decisionCard, mismatch: !!decisionCard?.size_mismatch, stores: data.successfulStores ?? null },
          });
        } else {
          track('no_answer', { query_text: query.trim(), category: cat, source: 'web', meta: { stores: data.successfulStores ?? null } });
        }
        // ADR-271 zero-state "closest options" fallback — distinct from no_answer (which
        // fires for ANY zero-result cause). Fires only when the fallback actually surfaced
        // candidates, so it measures the ADR-271 path specifically.
        if (closestOptionsData.length > 0) {
          track('closest_options_view', {
            query_text: query.trim(), category: cat, source: 'web',
            meta: { count: closestOptionsData.length, applied_budget: inferredMaxPrice },
          });
        }
      }
      // Smart Pick — the decision layer's trustworthy pick. The API gates this
      // server-side (null when the best match is an accessory for a product
      // query), so we render it verbatim without re-judging.
      setSmartPick(decisionCard);
      setAppliedBudget(inferredMaxPrice);
      setCategoryEnforcedZero(!!((data as unknown) as { categoryEnforcedZero?: boolean }).categoryEnforcedZero);
      setClosestOptions(closestOptionsData);
      setCompareRoute(((data as unknown) as { compareRoute?: CompareRoute | null }).compareRoute ?? null);
      setSearchCache(query, selectedCategory || 'all', mappedProducts, total);
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
      track('error', { query_text: query.trim(), source: 'web', meta: { message: err instanceof Error ? err.message : 'search_error' } });
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

  // Fetch products when query/category/filter/sort/page changes.
  // The sessionStorage cache restore path only fires on first mount (for
  // back-navigation); after that, every state change triggers a fresh
  // server fetch since the server now owns filtering + pagination.
  const mountedRef = useRef(false);
  const cacheSkipRef = useRef(false);
  useEffect(() => {
    // Skip one trigger after cache restored query+category from back-navigation
    if (cacheSkipRef.current) {
      cacheSkipRef.current = false;
      return;
    }

    // On first mount, try restoring from sessionStorage before scraping —
    // only valid when filters/page/sort are still at defaults, because the
    // cache doesn't remember filter state. If the user had filters set
    // before navigating away, the URL will carry them and the effect will
    // re-fire with non-default deps on the next render, fetching fresh.
    //
    // MEASURED DEFECT (2026-08-10, founder's own production report — reopened mission):
    // «ابي لاب توب...» then, moments later, «ابي مكيف بسعر رخيص وجودته عاليه» via the header
    // search box (a fresh navigation to a NEW `/search?q=...` URL) left the ENTIRE page frozen
    // on the laptop mission — stale budget banner, stale Waffar clarification question, stale
    // results — while the address bar and search box both showed the new AC query. Root cause:
    // this branch decided "is there a real current query" from `debouncedQuery` (React state,
    // initialized from `useSearchParams()`), which can still read empty on the FIRST render of
    // a fresh navigation before Next.js finishes reconciling search params — a genuine
    // hydration-timing race, not a phrasing issue. When that race hit, `!q && cached.query`
    // fired and silently overwrote the real new query with the PREVIOUS session's cached one.
    // The fix reads the URL directly (`searchParams.get('q')`, the same ground truth the
    // sibling sync effect above uses) instead of the React state value that can lag behind it —
    // this restore path now only ever fires for a genuine empty-query back-navigation, never a
    // race against a real new query that just hasn't hydrated into state yet.
    if (!mountedRef.current) {
      mountedRef.current = true;
      const cached = getSearchCache();
      if (cached && cached.products.length > 0) {
        const q = searchParams.get('q') || '';
        if (q && cached.query === q && cached.category === selectedCategory) {
          setRawProducts(cached.products);
          setServerTotal(cached.total);
          setLoading(false);
          return;
        }
        if (!q && cached.query) {
          setRawProducts(cached.products);
          setServerTotal(cached.total);
          cacheSkipRef.current = true;
          setSearchQuery(cached.query);
          setDebouncedQuery(cached.query);
          setSelectedCategory(cached.category as ProductCategory | 'all');
          return;
        }
      }
    }

    const ac = new AbortController();

    async function fetchProducts() {
      const hasQuery = debouncedQuery.trim().length > 0;
      const hasCategory = selectedCategory && selectedCategory !== 'all';
      if (!hasQuery && !hasCategory) {
        setRawProducts([]);
        setServerTotal(0);
        setLoading(false);
        return;
      }

      await searchWithScraping(debouncedQuery, [...DEFAULT_SEARCH_STORES], 5, ac.signal);
    }
    fetchProducts();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    selectedCategory,
    currentPage,
    sortBy,
    serverFilterKey,
  ]);

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

            {/* P2-8 · UNIFIED SEARCH — teach the OTHER half of what this box accepts.
                Every "popular search" below is a product NAME, and every product name
                routes to retrieval. With وفّر's nav entry retired, a customer who only
                ever saw those examples would never discover that describing a need works
                too — the capability would still be there and would go unused, which looks
                identical to it having been removed. The Constitution's answer is that the
                customer should never have to learn how to search; the least we can do is
                show, in one line, that a sentence is a valid query. These phrasings are
                the ones /advisor used to teach on its own page. */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-on-surface-variant">
                {needPrompt(locale)}
              </span>
              {/* From `need-phrasings.ts` — the homepage teaches the SAME sentences (ADR-171).
                  Two surfaces teaching different examples is the one-fact-two-representations
                  defect this codebase has already paid for twice. */}
              {needPhrasings(locale).map((term) => (
                <button
                  key={term}
                  onClick={() => handleQuickCategory(term)}
                  className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition-colors hover:border-primary-400 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-950/70"
                >
                  {term}
                </button>
              ))}
            </div>

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
          <section className="relative overflow-hidden rounded-[1.75rem] border border-[color:var(--color-border)] bg-[color:var(--color-primary-container)] p-4 shadow-[0_22px_62px_-48px_rgba(61,132,104,0.85)] dark:bg-[color:var(--color-card)] md:p-5">
            <div className="pointer-events-none absolute -end-20 -top-24 h-56 w-56 rounded-full bg-[color:var(--color-primary)]/18 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 start-12 h-44 w-44 rounded-full bg-[color:var(--color-secondary)]/16 blur-3xl" />
            <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
              <div className="min-w-0">
                {/* P2-7 (1.4.3): `--color-primary` is the FILL role. Used as 11px ink on the
                    tinted primary container it measured 2.35:1. `--color-on-primary-container`
                    is the role that means "text on this surface" and measures 5.13:1. */}
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--color-on-primary-container)]">
                  {locale === 'ar' ? 'بحث الأسعار' : 'Price search'}
                </p>
                <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-[color:var(--color-foreground)] md:text-4xl">
                  {debouncedQuery
                    ? debouncedQuery
                    : locale === 'ar'
                      ? 'تصفح الفئة'
                      : 'Browse category'}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--color-muted-foreground)] md:text-base">
                  {locale === 'ar'
                    ? 'قارن النتائج من المتاجر، رتّب حسب السعر أو التقييم، وضيّق الخيارات من لوحة الفلاتر.'
                    : 'Compare store results, sort by price or rating, and narrow the list from the filter panel.'}
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-[color:var(--color-primary)]/30 bg-white p-3 ring-1 ring-[color:var(--color-primary)]/10 dark:bg-[color:var(--color-card)]">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSearch(searchQuery.trim(), selectedCategory);
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1 rounded-2xl border-2 border-[color:var(--color-primary)]/35 bg-[color:var(--color-primary-container)]/35 transition focus-within:border-[color:var(--color-primary)] focus-within:bg-white focus-within:ring-4 focus-within:ring-[color:var(--color-primary)]/15 dark:bg-[color:var(--color-background)]">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-primary)]" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={t('search.searchPlaceholder')}
                      className="h-11 w-full rounded-2xl bg-transparent pe-3 ps-9 text-sm font-bold text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]/80"
                    />
                  </div>
                  <Button type="submit" className="h-11 rounded-2xl px-5 font-extrabold">
                    {t('button.search')}
                  </Button>
                </form>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-[color:var(--color-muted-foreground)]">
                  <span className="rounded-full bg-[color:var(--color-muted)] px-3 py-1">
                    {totalCount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')} {t('search.resultsCount')}
                  </span>
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-[color:var(--color-secondary)] px-3 py-1 text-[color:var(--color-secondary-foreground)]">
                      {activeFilterCount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')} {locale === 'ar' ? 'فلتر' : 'filters'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── Main Content ── */}
          <div className="py-6">
            <div className="flex gap-5">
              {/* Desktop Filter Sidebar */}
              <div className="hidden w-[292px] shrink-0 lg:block">
                <div className="sticky top-48 flex max-h-[calc(100dvh-13.5rem)] min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-4 pe-1 [scrollbar-width:thin]">
                  <FilterSidebar
                    filters={filters}
                    onFilterChange={setFiltersAndResetPage}
                    /* SORT IS DELIBERATELY NOT PASSED HERE — one doorway per function.
                       The desktop sidebar and the toolbar `SortSelector` both rendered a sort
                       control, both `lg:`-only, so a desktop visitor saw the SAME control twice
                       driving the same state. The toolbar keeps it: it sits beside the result
                       count where sorting is conventionally found, rather than buried in a
                       filter accordion.
                       The sidebar's sort section renders only when `onSortChange` is supplied,
                       so omitting it here removes the duplicate WITHOUT touching the component —
                       and the mobile bottom sheet, which reuses this same component and DOES
                       pass the handler, keeps sorting on small screens. */
                    category={selectedCategory !== 'all' ? selectedCategory : undefined}
                    locale={locale}
                  />
                </div>
              </div>

              {/* Results Area */}
              <div className="min-w-0 flex-1">
                {/* Related-results notice — honest empty-state: no exact match, showing nearby products */}
                {relaxed && !loading && totalCount > 0 && (
                  <div className="mb-4 rounded-2xl border border-[color:var(--color-outline-variant)] bg-[var(--brand-bg-green)] px-4 py-3 text-sm font-medium text-[var(--brand-green-dark)]">
                    {locale === 'ar'
                      ? 'لا توجد نتيجة مطابقة تماماً لبحثك — نعرض لك منتجات قريبة قد تناسبك.'
                      : 'No exact match — showing related products that may fit.'}
                  </div>
                )}
                {/* THE ORDERING RULE, STATED — Appendix F4: "with the ordering rule stated in one
                    readable line on the page."
                    Placed above the toolbars so it renders on BOTH breakpoints; the toolbars
                    themselves are `lg:flex` / `lg:hidden` and would each have shown it once only.

                    It describes what `scoreProduct` / `compareBySort` in /api/search ACTUALLY do
                    today — relevance dominates (+300 when every query word-group matches, −400 per
                    group missed), accessories are pushed to the tail, more retailers ranks higher
                    (+14/store, capped +56), and a mild price penalty (≤22) breaks ties downward.
                    The text changes with the selected sort, because a fixed line would be false the
                    moment a customer picks one.

                    IT DELIBERATELY DOES NOT CLAIM TOTAL COST. F4's intended "cheapest comparable
                    total first" stays DEFERRED: delivery is unknown for every offer
                    (product_stores.delivery_cost = 0 on all 12,980 rows), so a total-cost claim
                    would be exactly the unsupported claim Principle 1 and F1 forbid. State the real
                    rule; earn the better one when the data exists. */}
                {!loading && totalCount > 0 && (
                  <p className="mb-3 px-1 text-xs leading-relaxed text-on-surface-variant">
                    {sortBy === 'price_low'
                      ? (locale === 'ar'
                          ? 'مرتّبة حسب الأقل سعرًا — والإكسسوارات في الآخر.'
                          : 'Ordered by lowest price — accessories last.')
                      : sortBy === 'price_high'
                        ? (locale === 'ar'
                            ? 'مرتّبة حسب الأعلى سعرًا — والإكسسوارات في الآخر.'
                            : 'Ordered by highest price — accessories last.')
                        : (locale === 'ar'
                            ? 'مرتّبة حسب مطابقتها لبحثك، ثم عدد المتاجر التي تعرضها، ثم الأقل سعرًا — والإكسسوارات في الآخر.'
                            : 'Ordered by match to your search, then how many retailers offer it, then lowest price — accessories last.')}
                  </p>
                )}

                {/* Mobile toolbar + filter chips */}
                <div className="mb-4 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/82 p-3 shadow-[0_18px_44px_-40px_rgba(26,26,26,0.5)] backdrop-blur dark:bg-[color:var(--color-card)]/68">
                  {/* Mobile: results count, sort, filters button */}
                  <div className="flex items-center justify-between gap-4 lg:hidden">
                    {loading
                      ? <p className="t-small text-on-surface-variant animate-pulse">{scrapingProgress}</p>
                      : <ResultsMeta count={totalCount} latencyMs={searchLatencyMs ?? undefined} />
                    }
                    <div className="flex items-center gap-2">
                      {/* ADR-206: the text label renders at EVERY width. Production evidence
                          (2026-08-04, 390×844) showed the only filter doorway on phones was a
                          bare 48×36 icon — the label was `hidden sm:inline`. aria-label stays
                          equal to the visible text (2.5.3 label-in-name); h-11 lifts the touch
                          target to 44px. The word is «الفلاتر», matching the sheet it opens. */}
                      <Button
                        ref={mobileFiltersTriggerRef}
                        variant="outline"
                        size="sm"
                        className="relative h-11"
                        aria-label={t('search.mobileFilters')}
                        aria-expanded={mobileFiltersOpen}
                        onClick={() => setMobileFiltersOpen(true)}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span className="ms-1">{t('search.mobileFilters')}</span>
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
                    onFilterChange={setFiltersAndResetPage}
                    onClearAll={clearAllFilters}
                    sortBy={sortBy}
                    onSortChange={setSortByAndResetPage}
                    category={selectedCategory !== 'all' ? selectedCategory : undefined}
                    locale={locale}
                    activeCount={activeFilterCount}
                    triggerRef={mobileFiltersTriggerRef}
                  />
                  {/* Desktop sort + active chips row */}
                  <div className="hidden items-center justify-between gap-3 lg:flex lg:flex-wrap">
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
                      <SortSelector value={sortBy} onChange={setSortByAndResetPage} />
                    </div>
                  </div>
                  {activeFilterCount > 0 && (
                    <div className="mt-3">
                      <ActiveFilterChips
                        filters={filters}
                        onRemove={setFiltersAndResetPage}
                        onClearAll={clearAllFilters}
                        storeNameResolver={(slug) => getStoreDisplayName(slug, locale as 'ar' | 'en')}
                      />
                    </div>
                  )}
                  {/* A budget PARSED FROM THE TYPED SENTENCE (never a sidebar choice) is now
                      acting as a real price ceiling on these results — disclosed, never
                      silent (2026-08-09). Distinct from ActiveFilterChips because it did not
                      come from a filter the shopper clicked. */}
                  {appliedBudget !== null && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-green)]/40 bg-[var(--brand-bg-green)] px-3 py-1 t-small text-[var(--brand-green-dark)]">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {locale === 'ar'
                        ? `طبّقنا الميزانية المذكورة في بحثك: ${appliedBudget.toLocaleString('ar')} ريال أو أقل`
                        : `Applied the budget from your search: ${appliedBudget.toLocaleString('en')} SAR or less`}
                    </div>
                  )}
                </div>

                {/* «فرن كهربائي» is genuinely ambiguous between three different products
                    (founder taxonomy audit, 2026-08-19 — confirmed against Noon/Amazon.sa/
                    Almanea/Shaker/LG's own naming, not guessed). One-tap disambiguation,
                    non-blocking: results below already show, this only offers to refine. */}
                {showOvenClarify && !loading && (
                  <div className="mb-4 rounded-xl border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface-container-low)] p-3">
                    <p className="mb-2 t-small font-medium text-on-surface-variant">
                      {locale === 'ar' ? 'أي نوع تقصد؟' : 'Which type did you mean?'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { ar: 'فرن كامل مع سطح طبخ', en: 'Full cooker/range (with hob)', refine: (q: string) => (/فرن/.test(q) ? q.replace(/فرن/g, 'طباخ') : `${q} طباخ`) },
                        { ar: 'فرن بلت إن', en: 'Built-in oven', refine: (q: string) => `${q} بلت ان` },
                        { ar: 'فرن صغير/طاولة', en: 'Small/countertop oven', refine: (q: string) => `${q} صغير` },
                      ] as const).map((opt) => (
                        <button
                          key={opt.ar}
                          onClick={() => handleQuickCategory(opt.refine(debouncedQuery))}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] px-3 py-1.5 t-small font-medium text-on-surface transition-all hover:border-[var(--brand-green)] hover:bg-[var(--brand-bg-green)] hover:text-[var(--brand-green-dark)]"
                        >
                          {locale === 'ar' ? opt.ar : opt.en}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading State — skeleton grid only, no progress banner */}
                {loading && <ResultsSkeleton count={8} />}

                {/* Error State */}
                {error && !loading && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Waffar is still reasoning about a needs-based query whose literal
                    retrieval came back empty — show a working state, never a false negative
                    claim while the evidence-backed answer is still in flight. */}
                {!loading && !error && products.length === 0 && advisorPending && !advisorResult && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface-container-low)] px-4 py-6 t-body text-on-surface-variant">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {locale === 'ar' ? 'وفّر يبحث عن أفضل خيار يناسب طلبك…' : 'Waffar is finding the best match for your request…'}
                  </div>
                )}

                {/* No Results — never shown while Waffar has answered or is still working on
                    this need: showing «لم نعثر على نتائج» above a real evidence-backed answer
                    is a false claim (measured defect, Golden Query, 2026-08-09). */}
                {!loading && !error && products.length === 0 && !advisorPending && !advisorResult && (debouncedQuery || (selectedCategory && selectedCategory !== 'all')) && (
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
                    {/* Trending products rail — fallback when user query yields no hits.
                        MEASURED DEFECT (2026-08-20, «أبي تليفزيون ب 250ريال»): this rail is an
                        unfiltered last-8-inserted-products query with no relation to the search
                        or its budget. When the API honestly zeroed out a query that named an
                        explicit budget (`categoryEnforcedZero` + `appliedBudget`), showing this
                        rail silently replaced a true "nothing in your budget" with whatever was
                        last added to the catalog — which can be a luxury item that looks like a
                        contradicted budget. Suppressed ONLY in that specific case; a plain
                        no-budget empty search still gets the trending fallback as before. */}
                    {appliedBudget !== null && shouldSuppressTrendingRail(categoryEnforcedZero, appliedBudget) ? (
                      <div className="space-y-4">
                        <div
                          data-testid="budget-zero-message"
                          className="rounded-xl border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface-container-low)] px-4 py-6 text-center t-body text-on-surface-variant"
                        >
                          {locale === 'ar'
                            ? `لا يوجد منتج ضمن ميزانيتك (${appliedBudget.toLocaleString('ar')} ريال أو أقل) حالياً.`
                            : `Nothing available within your budget (${appliedBudget.toLocaleString('en')} SAR or less) right now.`}
                        </div>
                        {/* ADR-270 Fix 4 — never a bare empty result when the miss was budget:
                            name the closest still-relevant options and why each missed. */}
                        <ClosestOptions options={closestOptions} locale={locale} />
                      </div>
                    ) : (
                      trendingProducts.length > 0 && (
                        <div className="space-y-3 pt-4">
                          <h3 className="text-headline-sm text-on-surface">
                            {locale === 'ar' ? 'منتجات رائجة' : 'Trending products'}
                          </h3>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                      )
                    )}
                  </div>
                )}

                {/* UNIFIED SEARCH — the answer to a COMPARISON request. Rendered above the
                    reasoning answer because it is the more specific reading of the query:
                    a shopper who typed «قارن» asked for a comparison, not a recommendation.
                    Whether a comparison link appears at all was decided server-side against
                    the comparison page's own loader — this surface only renders the verdict. */}
                {!loading && !error && compareRoute && compareRoute.route !== 'none' && (
                  <ComparisonAnswer route={compareRoute} locale={locale} />
                )}

                {/* Section 12 · COUNTERFACTUAL — «لو زدت الميزانية 500 وش بيتغير؟». A real
                    before/after comparison, shown above the (unchanged) current answer
                    rather than replacing it — the shopper asked "what would change", not
                    "start over". */}
                {!loading && !error && counterfactualComparison && (
                  <CounterfactualCard comparison={counterfactualComparison} locale={locale} />
                )}

                {/* Section 44 closure — EXTERNAL_PRODUCT_REFERENCE (a pasted URL). An honest
                    "not yet" notice — the full verification flow (Section 21) stays
                    research+design only this mission — rather than silently running the URL
                    string as a garbage catalog search. */}
                {!loading && !error && externalReferenceNotice && (
                  <div
                    data-testid="external-reference-notice"
                    className="mb-4 rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-low p-4 text-sm text-on-surface-variant"
                  >
                    {t('agent.externalReferenceNotice')}
                  </div>
                )}

                {/* P2-8 · UNIFIED SEARCH — the reasoning engine's answer, when this query
                    needed one. This is now the ONLY surface that renders it: `/advisor`
                    redirects here, so there is one entry point and one implementation of
                    the answer rather than two that resemble each other until one is
                    edited. The AI disclosure lives inside this component and cannot be
                    switched off, which is the migration's hard condition. */}
                {!loading && !error && advisorResult && (
                  <AdvisorAnswer
                    result={advisorResult}
                    locale={locale}
                    source="search"
                    className="mb-6"
                    followUp={(() => {
                      // Section 9 · POST-DECISION CONTINUATION, repositioned (D→E mission
                      // Part A — founder-mandated discoverability fix, 2026-08-10). Rendered
                      // by AdvisorAnswer itself, immediately after the primary pick and
                      // BEFORE "More options" — not as a page-level sibling after the whole
                      // answer, which live evidence showed put it a full screen or more below
                      // where a shopper would ever see it. Still NOT a second input box
                      // (research: every credible shopping-AI product keeps ONE continuous
                      // input, and Amazon's own published UX review found a hidden second
                      // surface goes undiscovered) — these chips make the SAME box's
                      // mutation-handling capability (mutation-turn.ts) visible and tappable,
                      // and the explicit "start new search" action gives the shopper the
                      // boundary Baymard's research found most e-commerce sites never provide.
                      const activeState = readDecisionState();
                      if (!activeState) return null;
                      return (
                        <FollowUpSuggestions
                          state={activeState}
                          locale={locale}
                          // ROOT CAUSE (2026-08-10, founder's own iPhone Production journey):
                          // `setSearchQuery` alone only fills the VISIBLE text box — it never
                          // touches `debouncedQuery`, which is the one state value the search-
                          // triggering effect actually watches. So every follow-up chip
                          // ("لو رفعت الميزانية 500؟"/"طيب أرخص؟"/"ليش هذا أفضل؟"/"وين أشتريه؟")
                          // silently pre-filled an input box that, on a real device, sits far
                          // out of the shopper's current scroll position — zero visible
                          // reaction, zero network call, indistinguishable from "broken".
                          // `handleSearch` is the SAME immediate-submit helper this file
                          // already uses elsewhere for exactly this "tap something → search
                          // NOW" pattern (`handleQuickCategory`/`handleHistorySelect`) — it
                          // sets `debouncedQuery` too, which is what actually reaches
                          // `handleMutationTurn` and the already-correct contracts built for
                          // each of these four follow-ups (counterfactual budget/cheaper
                          // deltas, and the scroll-to-existing-answer "noop" for why/where).
                          onSelect={(text) => handleSearch(text)}
                          onStartNew={() => {
                            clearDecisionState();
                            setAdvisorResult(null);
                            setCounterfactualComparison(null);
                            setExternalReferenceNotice(false);
                            setSearchQuery('');
                            setDebouncedQuery('');
                            setCurrentPage(1);
                          }}
                        />
                      );
                    })()}
                    onClarify={(field, value) => {
                      const text = advisorQueryRef.current;
                      if (!text) return;
                      advisorAbortRef.current?.abort();
                      const ctrl = new AbortController();
                      advisorAbortRef.current = ctrl;
                      track('advisor_clarified', { query_text: text, source: 'search', meta: { field, value } });

                      // DURABLE STATE (2026-08-10, need-discovery mission — MEASURED GAP: a
                      // clarify answer previously lived only inside this one request/response
                      // pair. `DecisionState` was never touched, so the instant the shopper's
                      // NEXT turn was a follow-up mutation ("لو رفعت الميزانية 500"), the
                      // clarify answer vanished — unlike a budget stated in plain text, which
                      // already survived via `applyParsedTask`. Bootstrap state from what THIS
                      // turn's advisor answer already established if none exists yet (the
                      // common case: clarify usually fires on the very first advisory turn),
                      // then fold the answer through the EXACT SAME accumulation path every
                      // other mutation turn uses (`mutation-turn.ts`), so it now survives
                      // identically to a stated budget/room size/priority.
                      const category = advisorResult?.parsed?.category || advisorResult?.task?.category;
                      const existing = readDecisionState();
                      const base: DecisionState = existing ?? applyParsedTask(
                        createDecisionState(),
                        { category, ...advisorResult?.parsed },
                        'NEEDS_DISCOVERY',
                      );
                      const answer: Record<string, unknown> = { category: base.category || category, [field]: value };
                      const nextState = applyParsedTask(base, answer as Parameters<typeof applyParsedTask>[1], 'NEEDS_DISCOVERY');
                      const body = decisionStateToAdvisorBody(nextState) ?? answer;

                      askAdvisor(body as Parameters<typeof askAdvisor>[0], { signal: ctrl.signal, limit: 4 })
                        .then((res) => {
                          if (ctrl.signal.aborted || res.error || res.count === 0) return;
                          setAdvisorResult(res);
                          saveDecisionState(applyDecisionResult(nextState, {
                            recommendations: res.recommendations, smart_pick: res.smart_pick, budget_satisfied: res.budget_satisfied,
                          }));
                        })
                        .catch(() => { /* the answer already on screen stands */ });
                    }}
                    onRemoveConstraint={(field) => {
                      // Constraint Ledger (Section 7) — same durability fix as `onClarify`
                      // above (2026-08-10): routes through DecisionState's own `removeConstraint`
                      // instead of manually rebuilding a one-off body, so a removed constraint
                      // stays removed across a later follow-up turn too, not just this response.
                      const parsed = advisorResult?.parsed;
                      if (!parsed?.category) return;
                      advisorAbortRef.current?.abort();
                      const ctrl = new AbortController();
                      advisorAbortRef.current = ctrl;
                      const bareField = field.startsWith('priority:') ? field.slice('priority:'.length) : field;
                      const existing = readDecisionState();
                      const base: DecisionState = existing ?? applyParsedTask(createDecisionState(), parsed, 'NEEDS_DISCOVERY');
                      const nextState = removeConstraint(base, bareField);
                      const body = decisionStateToAdvisorBody(nextState);
                      if (!body) return;
                      askAdvisor(body as Parameters<typeof askAdvisor>[0], { signal: ctrl.signal, limit: 4 })
                        .then((res) => {
                          if (ctrl.signal.aborted || res.error) return;
                          setAdvisorResult(res);
                          saveJourneyTask(res.parsed);
                          saveDecisionState(applyDecisionResult(nextState, {
                            recommendations: res.recommendations, smart_pick: res.smart_pick, budget_satisfied: res.budget_satisfied,
                          }));
                        })
                        .catch(() => { /* the answer already on screen stands */ });
                    }}
                  />
                )}

                {/* Smart Pick — the retrieval layer's trustworthy pick, gated server-side.
                    SUPPRESSED when the reasoning engine has answered. Both are "our pick",
                    chosen on different grounds — suitability and total cost versus best
                    match and price — so showing both puts two answers to one question on
                    the same screen and makes the customer arbitrate between them. That is
                    precisely the choice UNIFIED SEARCH says they must never be handed. The
                    reasoning answer wins because it is the one that read the need. */}
                {!loading && !error && !advisorResult && smartPick && products.length > 0 && (
                  <SmartPickCard pick={smartPick} locale={locale} />
                )}

                {/* Products Grid */}
                {!loading && !error && products.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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

                    {/* Affiliate Campaign Revenue Layer V1 — Phase 1D: renders strictly
                        AFTER the neutral results above (this branch only mounts when
                        products.length > 0), never touches `products`/sort/ranking, and
                        renders nothing when no campaign is eligible. See
                        src/components/campaigns/post-search-campaign-card.tsx. */}
                    <PostSearchCampaignCard locale={locale} category={selectedCategory !== 'all' ? selectedCategory : null} />
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
