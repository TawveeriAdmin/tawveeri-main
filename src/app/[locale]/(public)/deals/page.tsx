'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { incrementSaveCount } from '@/lib/wishlist/utils';
import { ProductCard } from '@/components/products/product-card';
import type { ProductCardProduct } from '@/components/products/product-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Flame, Heart, Percent, Search, Sparkles, Tag, TimerReset } from 'lucide-react';
import { calculateSavings } from '@/lib/utils';
import type { AvailabilityStatus, Database } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductStoreRow = Database['public']['Tables']['product_stores']['Row'];
type StoreSummary = Pick<
  Database['public']['Tables']['stores']['Row'],
  'id' | 'name_ar' | 'name_en' | 'logo_url'
>;

type DealProduct = ProductCardProduct & {
  product_stores: Array<
    ProductCardProduct['product_stores'][number] & {
      is_deal?: boolean;
      deal_expires_at?: string | null;
    }
  >;
};

type SortOption = 'discount' | 'price' | 'newest';

const COMPARE_STORAGE_KEY = 'compare_products';
const MAX_COMPARE_PRODUCTS = 4;

const getDealDiscount = (product: DealProduct) => {
  const bestDeal = product.product_stores.find(
    (store) =>
      store.is_deal &&
      typeof store.original_price === 'number' &&
      store.original_price > store.current_price
  );

  if (!bestDeal || !bestDeal.original_price) return 0;
  return calculateSavings(bestDeal.original_price, bestDeal.current_price);
};

export default function DealsPage() {
  const supabase = useMemo(
    () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
    []
  );
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { addItem } = useMultiStoreCart();

  const [products, setProducts] = useState<DealProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('discount');
  const [filteredProducts, setFilteredProducts] = useState<DealProduct[]>([]);
  const [compareCount, setCompareCount] = useState(0);

  const fetchErrorFallback =
    locale === 'ar' ? 'تعذر تحميل العروض حالياً.' : 'Failed to load deals right now.';

  const uiCopy = useMemo(
    () =>
      locale === 'ar'
        ? {
            featured: 'واجهة عروض احترافية بتحديث مستمر',
            searchAction: 'بحث',
            searchHelper: 'ابحث داخل جميع العروض بسهولة',
            searchHint: 'اكتب اسم المنتج أو الماركة للوصول إلى أفضل التخفيضات بسرعة',
            compareCta: 'إدارة المقارنة',
            compareHint: 'قارن حتى 4 منتجات معاً',
            wishlist: 'قائمة الأمنيات',
            wishlistHint: 'احفظ العروض المهمة قبل انتهاءها',
            expiringSoon: 'تنتهي قريباً',
            maxDiscount: 'أعلى توفير',
            activeDeals: 'عروض نشطة',
            reset: 'إعادة ضبط',
            resetHint: 'إرجاع البحث والترتيب إلى الوضع الافتراضي',
            clearSearch: 'مسح البحث',
            alreadyInCompare: 'المنتج مضاف بالفعل إلى المقارنة',
            alreadySaved: 'المنتج موجود بالفعل في قائمة الأمنيات',
          }
        : {
            featured: 'Premium Deals Surface with Live Updates',
            searchAction: 'Search',
            searchHelper: 'Search all deals with clarity',
            searchHint: 'Type a product or brand to jump to the strongest discounts',
            compareCta: 'Manage Compare',
            compareHint: 'Compare up to 4 products side by side',
            wishlist: 'Wishlist',
            wishlistHint: 'Save high-priority deals before they expire',
            expiringSoon: 'Expiring Soon',
            maxDiscount: 'Top Saving',
            activeDeals: 'Active Deals',
            reset: 'Reset',
            resetHint: 'Return search and sorting to default',
            clearSearch: 'Clear Search',
            alreadyInCompare: 'Product is already in compare',
            alreadySaved: 'Product is already in wishlist',
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

    const handleCompareUpdate = () => updateCompareCount();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('compare-products-updated', handleCompareUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('compare-products-updated', handleCompareUpdate);
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError(fetchErrorFallback);
      return;
    }

    let cancelled = false;

    async function fetchDeals() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('product_stores')
          .select(
            `
              id,
              current_price,
              original_price,
              availability,
              is_deal,
              deal_expires_at,
              coupon_code,
              stores(
                id,
                name_ar,
                name_en,
                logo_url
              ),
              products!inner(
                id,
                name_ar,
                name_en,
                slug,
                category,
                brand,
                model,
                image_urls
              )
            `
          )
          .eq('is_deal', true)
          .gte('deal_expires_at', new Date().toISOString())
          .order('deal_expires_at', { ascending: true });

        if (queryError) throw queryError;

        const productMap = new Map<string, DealProduct>();
        (data || []).forEach((item) => {
          const storeProduct = item as ProductStoreRow & {
            stores: StoreSummary | null;
            products: ProductRow | null;
          };
          if (!storeProduct.products || !storeProduct.stores) return;

          const productId = storeProduct.products.id;
          if (!productMap.has(productId)) {
            productMap.set(productId, {
              id: storeProduct.products.id,
              name_ar: storeProduct.products.name_ar,
              name_en: storeProduct.products.name_en,
              slug: storeProduct.products.slug,
              category: storeProduct.products.category,
              brand: storeProduct.products.brand,
              model: storeProduct.products.model,
              image_urls: storeProduct.products.image_urls,
              product_stores: [],
            });
          }

          const product = productMap.get(productId)!;
          product.product_stores.push({
            id: storeProduct.id,
            current_price: storeProduct.current_price,
            original_price: storeProduct.original_price,
            is_deal: storeProduct.is_deal,
            deal_expires_at: storeProduct.deal_expires_at,
            coupon_code: (storeProduct as any).coupon_code || null,
            availability: storeProduct.availability as AvailabilityStatus,
            stores: storeProduct.stores,
          });
        });

        if (cancelled) return;

        const deals = Array.from(productMap.values());
        setProducts(deals);
        setFilteredProducts(deals);
      } catch (err) {
        if (cancelled) return;

        console.error('Error fetching deals:', err);
        const errorMessage = err instanceof Error ? err.message : fetchErrorFallback;
        setError(errorMessage);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    void fetchDeals();

    return () => {
      cancelled = true;
    };
  }, [supabase, fetchErrorFallback]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    let result = [...products];

    if (normalizedQuery) {
      result = result.filter(
        (product) =>
          product.name_ar.toLowerCase().includes(normalizedQuery) ||
          product.name_en.toLowerCase().includes(normalizedQuery) ||
          product.brand.toLowerCase().includes(normalizedQuery) ||
          product.model.toLowerCase().includes(normalizedQuery)
      );
    }

    result.sort((a, b) => {
      const aDeal = a.product_stores.find((store) => store.is_deal && store.original_price);
      const bDeal = b.product_stores.find((store) => store.is_deal && store.original_price);

      if (sortBy === 'discount') {
        const aDiscount =
          aDeal && aDeal.original_price
            ? calculateSavings(aDeal.original_price, aDeal.current_price)
            : 0;
        const bDiscount =
          bDeal && bDeal.original_price
            ? calculateSavings(bDeal.original_price, bDeal.current_price)
            : 0;
        return bDiscount - aDiscount;
      }

      if (sortBy === 'price') {
        const aPrice = aDeal?.current_price || Number.POSITIVE_INFINITY;
        const bPrice = bDeal?.current_price || Number.POSITIVE_INFINITY;
        return aPrice - bPrice;
      }

      const aDate = aDeal?.deal_expires_at || '';
      const bDate = bDeal?.deal_expires_at || '';
      return bDate.localeCompare(aDate);
    });

    setFilteredProducts(result);
  }, [products, searchQuery, sortBy]);

  const maxDiscount = useMemo(
    () =>
      filteredProducts.reduce((currentMax, product) => {
        const savings = getDealDiscount(product);
        return savings > currentMax ? savings : currentMax;
      }, 0),
    [filteredProducts]
  );

  const endingSoonCount = useMemo(() => {
    const now = Date.now();
    const twoDaysMs = 1000 * 60 * 60 * 48;

    return filteredProducts.filter((product) =>
      product.product_stores.some((store) => {
        if (!store.deal_expires_at) return false;
        const expiresAt = Date.parse(store.deal_expires_at);
        return expiresAt > now && expiresAt - now <= twoDaysMs;
      })
    ).length;
  }, [filteredProducts]);

  const handleAddToCart = (product: DealProduct) => {
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
    });
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

  const handleReset = () => {
    setSortBy('discount');
    setSearchInput('');
    setSearchQuery('');
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const activeSortLabel =
    sortBy === 'discount'
      ? t('deals.sortDiscount')
      : sortBy === 'price'
        ? t('deals.sortPrice')
        : t('deals.sortNewest');

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-amber-500/15 via-white to-rose-500/10 p-5 shadow-sm dark:border-gray-800 dark:from-amber-500/20 dark:via-gray-900 dark:to-rose-500/20 md:p-7">
        <div className="pointer-events-none absolute -end-16 -top-14 h-44 w-44 rounded-full bg-amber-500/20 blur-3xl dark:bg-amber-400/20" />
        <div className="pointer-events-none absolute -bottom-20 start-1/4 h-44 w-44 rounded-full bg-rose-500/15 blur-3xl dark:bg-rose-400/20" />

        <div className="relative z-10 space-y-5">
          <div>
            <Badge
              variant="outline"
              className="mb-3 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            >
              <Sparkles className="me-1 h-3.5 w-3.5" />
              {uiCopy.featured}
            </Badge>

            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 md:text-3xl">
              {t('deals.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
              {t('deals.subtitle')}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-white/90 p-3 shadow-sm dark:border-amber-800/70 dark:bg-gray-900/80 md:p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Search className="h-3.5 w-3.5" />
              <span>{uiCopy.searchHelper}</span>
            </div>
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder={t('deals.searchPlaceholder')}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-11 rounded-xl border-amber-200 bg-white ps-9 dark:border-amber-800/70 dark:bg-gray-950/70"
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
              href={user ? `/${locale}/compare` : `/${locale}/auth/login?redirect=/compare`}
              className="group rounded-2xl border border-gray-200 bg-white/90 p-4 transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-amber-700/60"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <Tag className="h-4.5 w-4.5" />
                </div>
                <Badge className="border-0 bg-amber-200 px-1.5 py-0 text-[10px] text-amber-900 dark:bg-amber-700/60 dark:text-amber-100">
                  {compareCount}/{MAX_COMPARE_PRODUCTS}
                </Badge>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{uiCopy.compareCta}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.compareHint}</p>
            </Link>

            <Link
              href={user ? `/${locale}/wishlist` : `/${locale}/auth/login?redirect=/wishlist`}
              className="group rounded-2xl border border-gray-200 bg-white/90 p-4 transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-rose-700/60"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                <Heart className="h-4.5 w-4.5" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{uiCopy.wishlist}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.wishlistHint}</p>
            </Link>

            <button
              onClick={handleReset}
              className="group rounded-2xl border border-gray-200 bg-white/90 p-4 text-start transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/75 dark:hover:border-gray-600"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <TimerReset className="h-4.5 w-4.5" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{uiCopy.reset}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{uiCopy.resetHint}</p>
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <Flame className="h-5 w-5 text-rose-500" />
              <Badge variant="outline">{uiCopy.activeDeals}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {filteredProducts.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <Percent className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <Badge variant="outline">{uiCopy.maxDiscount}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {maxDiscount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/85 p-4 dark:border-gray-700 dark:bg-gray-900/75">
            <div className="mb-2 flex items-center justify-between">
              <TimerReset className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <Badge variant="outline">{uiCopy.expiringSoon}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {endingSoonCount}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white/85 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3 py-1.5 text-sm font-medium text-rose-700 dark:border-rose-800/70 dark:bg-rose-900/20 dark:text-rose-200">
              <Flame className="h-4 w-4" />
              <span>
                {filteredProducts.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{' '}
                {t('deals.resultsCount')}
              </span>
            </div>
            <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
              {t('deals.sortBy')}: {activeSortLabel}
            </Badge>
            {searchQuery && (
              <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs">
                {searchQuery}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/85 p-2 dark:border-gray-700 dark:bg-gray-900/80">
            <label className="px-1 text-sm text-on-surface-variant">{t('deals.sortBy')}:</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-9 w-[190px] border-gray-200 dark:border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">{t('deals.sortDiscount')}</SelectItem>
                <SelectItem value="price">{t('deals.sortPrice')}</SelectItem>
                <SelectItem value="newest">{t('deals.sortNewest')}</SelectItem>
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
                <TimerReset className="me-2 h-4 w-4" />
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
              ? 'نتائج مطابقة للبحث الحالي'
              : 'Showing matches for current search query'}
          </div>
        )}
      </section>

      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      {!loading && !error && filteredProducts.length === 0 && (
        <EmptyState
          icon={<Tag className="h-12 w-12" />}
          title={t('deals.noDeals')}
          description={searchQuery ? t('deals.noDealsMatch', { query: searchQuery }) : undefined}
        />
      )}

      {!loading && !error && filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
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
      )}
    </div>
  );
}
