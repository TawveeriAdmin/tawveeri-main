'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { incrementSaveCount } from '@/lib/wishlist/utils';
import { ProductCard } from '@/components/products/product-card';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';
import {
  AlertCircle,
  BarChart3,
  Grid3X3,
  Heart,
  LayoutList,
  PackageSearch,
  RefreshCcw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { AvailabilityStatus, ProductCategory } from '@/lib/database/types';

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  category: ProductCategory;
  brand: string;
  model: string;
  image_urls: string[] | null;
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
}

type SortOption = 'popularity' | 'price_low' | 'price_high' | 'newest';
type ViewMode = 'grid' | 'compact';

const ITEMS_PER_PAGE = 24;
const COMPARE_STORAGE_KEY = 'compare_products';
const MAX_COMPARE_PRODUCTS = 4;

const categoryOptions: Array<{ value: ProductCategory | 'all'; key: string }> = [
  { value: 'all', key: 'allCategories' },
  { value: 'tv', key: 'categories.tv' },
  { value: 'laptop', key: 'categories.laptop' },
  { value: 'smartphone', key: 'categories.smartphone' },
  { value: 'tablet', key: 'categories.tablet' },
  { value: 'audio', key: 'categories.audio' },
  { value: 'gaming', key: 'categories.gaming' },
];

const getBestAvailablePrice = (product: Product): number => {
  const price = product.product_stores
    .filter((store) => store.availability !== 'out_of_stock')
    .map((store) => store.current_price)
    .sort((a, b) => a - b)[0];

  return typeof price === 'number' ? price : Number.POSITIVE_INFINITY;
};

const productHasDeal = (product: Product): boolean => {
  return product.product_stores.some(
    (store) =>
      typeof store.original_price === 'number' &&
      store.original_price > store.current_price
  );
};

const productOutOfStock = (product: Product): boolean => {
  return product.product_stores.every((store) => store.availability === 'out_of_stock');
};

export default function ProductsPage() {
  const supabase = useMemo(
    () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
    []
  );
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { toast } = useToast();
  const { addItem } = useMultiStoreCart();
  const { user, loading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [compareCount, setCompareCount] = useState(0);
  const fetchErrorFallback =
    locale === 'ar' ? 'حدث خطأ أثناء تحميل المنتجات.' : 'Failed to load products.';

  const uiCopy = useMemo(
    () =>
      locale === 'ar'
        ? {
            featured: 'تجربة تسوق أسرع وأذكى',
            searchPlaceholder: 'ابحث بالاسم، الماركة أو الموديل',
            searchAction: 'بحث',
            searchHelper: 'ابحث بسرعة عن المنتج المناسب',
            searchHint: 'اكتب اسم المنتج أو الماركة أو الموديل لعرض نتائج أدق',
            hotDeals: 'عروض نشطة',
            availableNow: 'منتجات متاحة',
            compareNow: 'صفحة المقارنة',
            compareHint: 'قارن حتى 4 منتجات في نفس الوقت',
            wishlist: 'قائمة الأمنيات',
            wishlistHint: 'احفظ المنتجات للرجوع إليها لاحقاً',
            dealsHub: 'مركز العروض',
            dashboard: 'لوحة التحكم',
            resetFilters: 'تصفير الفلاتر',
            resetHint: 'إرجاع البحث والتصنيف والفئة إلى الوضع الافتراضي',
            quickFilters: 'فلاتر سريعة',
            alreadyInCompare: 'المنتج موجود بالفعل في المقارنة',
            alreadySaved: 'المنتج محفوظ مسبقاً في قائمة الأمنيات',
          }
        : {
            featured: 'Faster and Smarter Shopping',
            searchPlaceholder: 'Search by name, brand or model',
            searchAction: 'Search',
            searchHelper: 'Find the right product faster',
            searchHint: 'Type product name, brand, or model for sharper results',
            hotDeals: 'Active Deals',
            availableNow: 'Available Products',
            compareNow: 'Compare Page',
            compareHint: 'Compare up to 4 products side by side',
            wishlist: 'Wishlist',
            wishlistHint: 'Save products to revisit them later',
            dealsHub: 'Deals Hub',
            dashboard: 'Dashboard',
            resetFilters: 'Reset Filters',
            resetHint: 'Clear category, sorting, and search query',
            quickFilters: 'Quick Filters',
            alreadyInCompare: 'This product is already in compare list',
            alreadySaved: 'This product is already in your wishlist',
          },
    [locale]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateCompareCount = () => {
      try {
        const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
        const ids: string[] = stored ? JSON.parse(stored) : [];
        setCompareCount(Array.from(new Set(ids)).slice(0, MAX_COMPARE_PRODUCTS).length);
      } catch {
        setCompareCount(0);
      }
    };

    updateCompareCount();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === COMPARE_STORAGE_KEY) {
        updateCompareCount();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError(fetchErrorFallback);
      return;
    }

    let cancelled = false;

    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);

        const offset = (currentPage - 1) * ITEMS_PER_PAGE;

        let query = supabase
          .from('products')
          .select(
            `
              *,
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

        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        if (searchQuery.trim()) {
          const safeSearch = `%${searchQuery.trim()}%`;
          query = query.or(
            `name_ar.ilike.${safeSearch},name_en.ilike.${safeSearch},brand.ilike.${safeSearch},model.ilike.${safeSearch}`
          );
        }

        if (sortBy === 'newest') {
          query = query.order('created_at', { ascending: false });
        } else {
          query = query.order('view_count', { ascending: false });
        }

        const { data, error: queryError, count } = await query.range(
          offset,
          offset + ITEMS_PER_PAGE - 1
        );

        if (queryError) throw queryError;

        const result = (data || []) as Product[];

        if (sortBy === 'price_low') {
          result.sort((a, b) => getBestAvailablePrice(a) - getBestAvailablePrice(b));
        } else if (sortBy === 'price_high') {
          result.sort((a, b) => getBestAvailablePrice(b) - getBestAvailablePrice(a));
        }

        if (cancelled) return;

        setProducts(result);
        setTotalCount(count || 0);
      } catch (err) {
        if (cancelled) return;

        console.error('Error fetching products:', err);
        const errorMessage = err instanceof Error ? err.message : fetchErrorFallback;
        setError(errorMessage);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    void fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [supabase, selectedCategory, sortBy, currentPage, searchQuery, fetchErrorFallback]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const dealsCount = useMemo(
    () => products.filter((product) => productHasDeal(product)).length,
    [products]
  );
  const availableCount = useMemo(
    () => products.filter((product) => !productOutOfStock(product)).length,
    [products]
  );

  const handleAddToCart = (product: Product) => {
    const cartItem = createCartItemFromProduct(product, locale);
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

  const handleCategoryChange = (category: ProductCategory | 'all') => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSortBy('popularity');
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleAddToCompare = (productId: string) => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      const existing: string[] = stored ? JSON.parse(stored) : [];
      const unique = Array.from(new Set(existing));

      if (unique.includes(productId)) {
        toast({
          title: t('products.added'),
          description: uiCopy.alreadyInCompare,
        });
        return;
      }

      if (unique.length >= MAX_COMPARE_PRODUCTS) {
        toast({
          title: t('common.error'),
          description: t('compare.maxProducts'),
          variant: 'destructive',
        });
        return;
      }

      const next = [productId, ...unique].slice(0, MAX_COMPARE_PRODUCTS);
      window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event('compare-products-updated'));
      setCompareCount(next.length);

      toast({
        title: t('products.added'),
        description: t('products.addedToComparison'),
      });
    } catch (err) {
      console.error('Error adding product to comparison:', err);
      toast({
        title: t('common.error'),
        description: t('products.error'),
        variant: 'destructive',
      });
    }
  };

  const handleSaveToWishlist = async (productId: string) => {
    if (authLoading) return;

    if (!user) {
      router.push(`/${locale}/auth/login?redirect=/wishlist`);
      return;
    }

    if (!supabase) return;

    try {
      const { error: saveError } = await supabase.from('user_wishlists').insert({
        user_id: user.id,
        product_id: productId,
      });

      if (saveError && saveError.code === '23505') {
        toast({
          title: t('products.saved'),
          description: uiCopy.alreadySaved,
        });
        return;
      }

      if (saveError) throw saveError;

      incrementSaveCount(productId).catch((err) => {
        console.error('Error incrementing save count:', err);
      });

      toast({
        title: t('products.saved'),
        description: t('products.savedToWishlist'),
      });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : t('products.saveError'),
        variant: 'destructive',
      });
    }
  };

  const compactGrid = viewMode === 'compact';
  const gridClasses = compactGrid
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
  const compareHref = user
    ? `/${locale}/compare`
    : `/${locale}/auth/login?redirect=/compare`;
  const activeSortLabel =
    sortBy === 'popularity'
      ? t('products.sortPopularity')
      : sortBy === 'price_low'
        ? t('products.sortPriceLow')
        : sortBy === 'price_high'
          ? t('products.sortPriceHigh')
          : t('products.sortNewest');
  const activeCategoryLabel =
    categoryOptions.find((option) => option.value === selectedCategory)?.key || 'allCategories';
  const activeViewLabel = compactGrid
    ? locale === 'ar'
      ? 'عرض مضغوط'
      : 'Compact View'
    : locale === 'ar'
      ? 'عرض شبكي'
      : 'Grid View';

  return (
    <div className="space-y-6">
      <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/${locale}`}>{t('common.home')}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t('products.title')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
      </Breadcrumb>

          <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-primary-500/10 via-white to-secondary-500/10 p-5 shadow-sm dark:border-gray-800 dark:from-primary-500/20 dark:via-gray-900 dark:to-secondary-500/20 md:p-7">
            <div className="pointer-events-none absolute -end-16 -top-16 h-44 w-44 rounded-full bg-primary-500/20 blur-3xl dark:bg-primary-400/20" />
            <div className="pointer-events-none absolute -bottom-20 start-1/4 h-44 w-44 rounded-full bg-secondary-500/15 blur-3xl dark:bg-secondary-400/25" />

            <div className="relative z-10 space-y-5">
              <div>
                <Badge
                  variant="outline"
                  className="mb-3 border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                >
                  <Sparkles className="me-1 h-3.5 w-3.5" />
                  {uiCopy.featured}
                </Badge>
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 md:text-3xl">
                  {t('products.title')}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
                  {t('products.subtitle')}
                </p>
              </div>

              <div className="rounded-2xl border border-primary-200/70 bg-white/90 p-3 shadow-sm dark:border-primary-800/70 dark:bg-gray-900/80 md:p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary-700 dark:text-primary-300">
                  <Search className="h-3.5 w-3.5" />
                  <span>{uiCopy.searchHelper}</span>
                </div>
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder={uiCopy.searchPlaceholder}
                      className="h-11 w-full rounded-xl border border-primary-200 bg-white pe-3 ps-9 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-primary-500 dark:border-primary-800/70 dark:bg-gray-950/70 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-primary-400"
                    />
                  </div>
                  <Button type="submit" className="h-11 rounded-xl px-5">
                    {uiCopy.searchAction}
                  </Button>
                </form>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{uiCopy.searchHint}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                  href={compareHref}
                  className="group rounded-2xl border border-gray-200 bg-white/90 p-4 transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-primary-700/60"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                      <BarChart3 className="h-4.5 w-4.5" />
                    </div>
                    <Badge className="border-0 bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                      {compareCount}/{MAX_COMPARE_PRODUCTS}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {uiCopy.compareNow}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.compareHint}</p>
                </Link>

                <Link
                  href={user ? `/${locale}/wishlist` : `/${locale}/auth/login?redirect=/wishlist`}
                  className="group rounded-2xl border border-gray-200 bg-white/90 p-4 transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-rose-700/60"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                    <Heart className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {uiCopy.wishlist}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.wishlistHint}</p>
                </Link>

                <button
                  onClick={handleResetFilters}
                  className="group rounded-2xl border border-gray-200 bg-white/90 p-4 text-start transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-gray-600"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <RefreshCcw className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {uiCopy.resetFilters}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.resetHint}</p>
                </button>
              </div>
            </div>

            <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('products.resultsCount')}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {totalCount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-xs text-gray-500 dark:text-gray-400">{uiCopy.hotDeals}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {dealsCount}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-xs text-gray-500 dark:text-gray-400">{uiCopy.availableNow}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {availableCount}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('products.allCategories')}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {categoryOptions.length - 1}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white/85 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-primary-200/70 bg-primary-50/60 px-3 py-1.5 text-sm font-medium text-primary-700 dark:border-primary-800/70 dark:bg-primary-900/20 dark:text-primary-200">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      {totalCount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')} {t('products.resultsCount')}
                    </span>
                  </div>
                  <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
                    {t('products.sortBy')}: {activeSortLabel}
                  </Badge>
                  <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
                    {t(`products.${activeCategoryLabel}`)}
                  </Badge>
                  <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
                    {activeViewLabel}
                  </Badge>
                  {searchQuery && (
                    <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
                      {searchQuery}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/85 p-2 dark:border-gray-700 dark:bg-gray-900/80">
                  <label className="px-1 text-sm text-on-surface-variant">{t('products.sortBy')}:</label>
                  <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortOption)}>
                    <SelectTrigger className="h-9 w-[170px] border-gray-200 dark:border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popularity">{t('products.sortPopularity')}</SelectItem>
                      <SelectItem value="price_low">{t('products.sortPriceLow')}</SelectItem>
                      <SelectItem value="price_high">{t('products.sortPriceHigh')}</SelectItem>
                      <SelectItem value="newest">{t('products.sortNewest')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-s-lg transition-colors',
                        viewMode === 'grid'
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                      )}
                      aria-label="Grid View"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('compact')}
                      className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-e-lg transition-colors',
                        viewMode === 'compact'
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                      )}
                      aria-label="Compact View"
                    >
                      <LayoutList className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <Tabs
                value={selectedCategory}
                onValueChange={(value) =>
                  handleCategoryChange(value as ProductCategory | 'all')
                }
                className="w-full"
              >
                <div className="overflow-x-auto pb-1">
                  <TabsList className="flex h-10 min-w-max gap-1 rounded-xl bg-surface-container-low p-1">
                    {categoryOptions.map((category) => (
                      <TabsTrigger key={category.value} value={category.value} className="whitespace-nowrap px-3">
                        {t(`products.${category.key}`)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </Tabs>
            </div>
          </section>

          {loading && (
            <div className={gridClasses}>
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-4">
                  <Skeleton className="h-56 w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
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

          {!loading && !error && products.length === 0 && (
            <EmptyState
              icon={<PackageSearch className="h-12 w-12" />}
              title={t('products.noProducts')}
              description={
                selectedCategory !== 'all'
                  ? locale === 'ar'
                    ? `لا توجد منتجات في فئة ${t(`products.categories.${selectedCategory}`)}`
                    : `No products found in ${t(`products.categories.${selectedCategory}`)} category`
                  : undefined
              }
            />
          )}

          {!loading && !error && products.length > 0 && (
            <>
              <div className={gridClasses}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    locale={locale}
                    onCompare={handleAddToCompare}
                    onSave={handleSaveToWishlist}
                    onAddToCart={handleAddToCart}
                    showActions={true}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (currentPage > 1) {
                            setCurrentPage((prev) => prev - 1);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = index + 1;
                      } else if (currentPage <= 3) {
                        pageNum = index + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + index;
                      } else {
                        pageNum = currentPage - 2 + index;
                      }

                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage(pageNum);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            isActive={currentPage === pageNum}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (currentPage < totalPages) {
                            setCurrentPage((prev) => prev + 1);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className={
                          currentPage === totalPages ? 'pointer-events-none opacity-50' : ''
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
    </div>
  );
}
