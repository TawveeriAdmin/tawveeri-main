'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { AlertCircle, Flame, Heart, Percent, Search, Sparkles, Tag, TimerReset, X } from 'lucide-react';
import { calculateSavings } from '@/lib/utils';
import type { AvailabilityStatus, Database } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductStoreRow = Database['public']['Tables']['product_stores']['Row'];
type StoreSummary = Pick<
  Database['public']['Tables']['stores']['Row'],
  'id' | 'slug' | 'name_ar' | 'name_en' | 'logo_url'
>;

type DealStoreRow = ProductStoreRow & {
  coupon_code: string | null;
  product_url: string | null;
  affiliate_url: string | null;
  stores: StoreSummary | null;
  products: ProductRow | null;
};

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
const DEALS_PAGE_SIZE = 20;

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

function DealMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'green' | 'gold' | 'ink';
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-[color:var(--color-primary)] text-white'
      : tone === 'gold'
        ? 'bg-[color:var(--color-secondary)] text-[color:var(--color-secondary-foreground)]'
        : 'bg-[color:var(--color-foreground)] text-[color:var(--color-background)]';

  return (
    <div className="flex items-center gap-3 rounded-[1.15rem] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/88 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-xl dark:bg-[color:var(--color-card)]/70">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-mono text-xl font-black tracking-tight text-[color:var(--color-foreground)]">
          {value}
        </div>
        <div className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-muted-foreground)]">
          {label}
        </div>
      </div>
    </div>
  );
}

export default function DealsClient() {
  const [supabase] = useState(() =>
    typeof window !== 'undefined' ? getSupabaseBrowserClient() : null
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
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const compareCount = compareIds.size;

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
            controlDeck: 'لوحة التحكم بالعروض',
            gridTitle: 'العروض المتاحة الآن',
            searchLabel: 'ابحث في العروض',
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
            controlDeck: 'Deals Control Deck',
            gridTitle: 'Available Deals Now',
            searchLabel: 'Search deals',
          },
    [locale]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateCompareCount = () => {
      try {
        const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
        const ids: string[] = stored ? JSON.parse(stored) : [];
        setCompareIds(new Set(ids.slice(0, MAX_COMPARE_PRODUCTS)));
      } catch {
        setCompareIds(new Set());
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

  // Fetch user's wishlist to show saved state on cards
  useEffect(() => {
    if (!user || !supabase) {
      queueMicrotask(() => setSavedProductIds(new Set()));
      return;
    }
    supabase
      .from('user_wishlists')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          setSavedProductIds(new Set(data.map(d => d.product_id).filter(Boolean)));
        }
      });
  }, [user, supabase]);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => {
        setLoading(false);
        setError(fetchErrorFallback);
      });
      return;
    }

    const client = supabase;
    let cancelled = false;

    async function fetchDeals() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await client
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
              product_url,
              affiliate_url,
              stores(
                id,
                slug,
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
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;

        const productMap = new Map<string, DealProduct>();
        (data || []).forEach((item) => {
          const storeProduct = item as unknown as DealStoreRow;
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
            coupon_code: storeProduct.coupon_code || null,
            product_url: storeProduct.product_url || null,
            affiliate_url: storeProduct.affiliate_url || null,
            availability: storeProduct.availability as AvailabilityStatus,
            stores: storeProduct.stores,
          });
        });

        if (cancelled) return;

        const deals = Array.from(productMap.values());
        setProducts(deals);
      } catch (err) {
        if (cancelled) return;

        console.error('Error fetching deals:', err);
        const errorMessage = err instanceof Error ? err.message : fetchErrorFallback;
        setError(errorMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchDeals();

    return () => {
      cancelled = true;
    };
  }, [supabase, fetchErrorFallback]);

  const filteredProducts = useMemo(() => {
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

    return result;
  }, [products, searchQuery, sortBy]);

  useEffect(() => {
    // Filters changed — snap back to page 1 so the user sees the top results.
    queueMicrotask(() => setCurrentPage(1));
  }, [searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / DEALS_PAGE_SIZE));
  const paginatedProducts = useMemo(
    () =>
      filteredProducts.slice(
        (currentPage - 1) * DEALS_PAGE_SIZE,
        currentPage * DEALS_PAGE_SIZE,
      ),
    [filteredProducts, currentPage],
  );

  // Build a compact page list with ellipses for long ranges (same shape as search).
  const pageNumbers = useMemo<(number | 'ellipsis')[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    const windowStart = Math.max(2, currentPage - 1);
    const windowEnd = Math.min(totalPages - 1, currentPage + 1);
    if (windowStart > 2) pages.push('ellipsis');
    for (let p = windowStart; p <= windowEnd; p++) pages.push(p);
    if (windowEnd < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }, [totalPages, currentPage]);

  const handlePageChange = (next: number) => {
    if (next < 1 || next > totalPages || next === currentPage) return;
    setCurrentPage(next);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
      // The compare-products-updated listener above re-reads localStorage
      // and refreshes compareIds — no need to set state manually here.
      window.dispatchEvent(new Event('compare-products-updated'));
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
        setSavedProductIds(prev => new Set(prev).add(productId));
        toast({
          title: t('products.saved'),
          description: uiCopy.alreadySaved,
        });
        return;
      }

      if (saveError) throw saveError;

      setSavedProductIds(prev => new Set(prev).add(productId));

      incrementSaveCount(productId).catch((err) => {
        console.error('Error incrementing save count:', err);
      });

      window.dispatchEvent(new Event('wishlist-updated'));
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

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[color:var(--color-border)] bg-[color:var(--color-primary-container)] p-4 shadow-[0_20px_58px_-46px_rgba(61,132,104,0.75)] dark:bg-[color:var(--color-card)] md:p-5">
        <div className="pointer-events-none absolute -end-16 -top-24 h-52 w-52 rounded-full bg-[color:var(--color-primary)]/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 start-10 h-44 w-44 rounded-full bg-[color:var(--color-secondary)]/18 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20" />

        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
          <div className="max-w-3xl">
            <Badge className="mb-3 rounded-full border border-[color:var(--color-primary)]/20 bg-white/70 px-3 py-1 text-xs text-[color:var(--color-primary)] shadow-none backdrop-blur dark:bg-white/10 dark:text-[color:var(--color-primary)]">
              <Sparkles className="me-1.5 h-3 w-3" />
              {uiCopy.featured}
            </Badge>
            <h1 className="max-w-2xl text-3xl font-black leading-tight tracking-tight text-[color:var(--color-foreground)] md:text-4xl">
              {t('deals.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--color-muted-foreground)] md:text-base">
              {t('deals.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <DealMetric
              icon={<Flame className="h-5 w-5" />}
              label={uiCopy.activeDeals}
              value={loading ? '...' : filteredProducts.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
              tone="green"
            />
            <DealMetric
              icon={<Percent className="h-5 w-5" />}
              label={uiCopy.maxDiscount}
              value={loading ? '...' : maxDiscount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
              tone="gold"
            />
            <DealMetric
              icon={<TimerReset className="h-5 w-5" />}
              label={uiCopy.expiringSoon}
              value={loading ? '...' : endingSoonCount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
              tone="ink"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/92 p-3 shadow-[0_20px_55px_-44px_rgba(26,26,26,0.5)] backdrop-blur-xl dark:bg-[color:var(--color-card)]/72 md:p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <form onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-sm font-extrabold text-[color:var(--color-foreground)]">
                {uiCopy.searchLabel}
              </label>
              <span className="hidden text-xs font-bold text-[color:var(--color-primary)] sm:inline">
                {uiCopy.controlDeck}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1 rounded-[1.35rem] border-2 border-[color:var(--color-primary)]/35 bg-[color:var(--color-background)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition-with-theme focus-within:border-[color:var(--color-primary)] focus-within:ring-4 focus-within:ring-[color:var(--color-primary)]/12 dark:bg-[color:var(--color-card)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--color-primary)]" />
                <Input
                  type="text"
                  placeholder={t('deals.searchPlaceholder')}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-[52px] rounded-[1.2rem] border-0 bg-transparent pe-12 ps-12 text-base font-semibold text-[color:var(--color-foreground)] shadow-none placeholder:text-[color:var(--color-muted-foreground)] focus-visible:ring-0"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                    }}
                    className="absolute end-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--color-muted)] text-[color:var(--color-muted-foreground)] transition hover:bg-[color:var(--color-primary)] hover:text-white"
                    aria-label={uiCopy.clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" className="h-[52px] rounded-2xl px-7 font-extrabold active:scale-[0.98]">
                {uiCopy.searchAction}
              </Button>
            </div>
            <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">
              {uiCopy.searchHint}
            </p>
          </form>

          <div className="grid gap-2 sm:grid-cols-3 lg:w-[520px]">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-[52px] rounded-2xl border-[color:var(--color-border)] bg-[color:var(--color-background)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">{t('deals.sortDiscount')}</SelectItem>
                <SelectItem value="price">{t('deals.sortPrice')}</SelectItem>
                <SelectItem value="newest">{t('deals.sortNewest')}</SelectItem>
              </SelectContent>
            </Select>

            <Link
              href={user ? `/${locale}/compare` : `/${locale}/auth/login?redirect=/compare`}
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-4 text-sm font-extrabold text-[color:var(--color-foreground)] transition hover:border-[color:var(--color-primary)] active:scale-[0.98]"
            >
              <Tag className="h-4 w-4 text-[color:var(--color-secondary)]" />
              {uiCopy.compareCta}
              <span className="rounded-full bg-[color:var(--color-secondary)] px-2 py-0.5 font-mono text-[11px] text-[color:var(--color-secondary-foreground)]">
                {compareCount}/{MAX_COMPARE_PRODUCTS}
              </span>
            </Link>

            <Link
              href={user ? `/${locale}/wishlist` : `/${locale}/auth/login?redirect=/wishlist`}
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-4 text-sm font-extrabold text-[color:var(--color-foreground)] transition hover:border-[color:var(--color-primary)] active:scale-[0.98]"
            >
              <Heart className="h-4 w-4 text-[color:var(--color-primary)]" />
              {uiCopy.wishlist}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-[color:var(--color-muted)]/55 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--color-muted-foreground)]">
            <span>
              {filteredProducts.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{' '}
              {t('deals.resultsCount')}
            </span>
            {searchQuery && (
              <Badge variant="outline" className="rounded-full border-[color:var(--color-border)] px-3 py-1">
                &ldquo;{searchQuery}&rdquo;
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                  className="ms-2 text-[color:var(--color-muted-foreground)] transition hover:text-[color:var(--color-foreground)]"
                  aria-label={uiCopy.clearSearch}
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
          {(searchQuery || sortBy !== 'discount') && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="rounded-full font-bold">
              <TimerReset className="me-2 h-4 w-4" />
              {uiCopy.reset}
            </Button>
          )}
        </div>
      </section>

      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3">
              <Skeleton className="h-36 w-full rounded-[1.15rem]" />
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

      {!loading && !error && filteredProducts.length === 0 && (
        <EmptyState
          icon={<Tag className="h-12 w-12" />}
          title={t('deals.noDeals')}
          description={searchQuery ? t('deals.noDealsMatch', { query: searchQuery }) : undefined}
        />
      )}

      {!loading && !error && filteredProducts.length > 0 && (
        <>
          <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-muted)]/35 p-3 md:p-4">
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-xl font-black tracking-tight text-[color:var(--color-foreground)]">
                  {uiCopy.gridTitle}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
                  {uiCopy.searchHelper}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {paginatedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                  onCompare={handleAddToCompare}
                  onSave={handleSaveToWishlist}
                  isSaved={savedProductIds.has(product.id)}
                  isInCompare={compareIds.has(product.id)}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          </section>

          {totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageChange(currentPage - 1);
                    }}
                    aria-disabled={currentPage === 1}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>

                {pageNumbers.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(p);
                        }}
                        isActive={p === currentPage}
                      >
                        {p.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageChange(currentPage + 1);
                    }}
                    aria-disabled={currentPage === totalPages}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
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
