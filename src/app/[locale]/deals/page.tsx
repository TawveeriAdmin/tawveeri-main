'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { ProductCard } from '@/components/products/product-card';
import type { ProductCardProduct } from '@/components/products/product-card';
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
import { Search, AlertCircle, Tag } from 'lucide-react';
import { calculateSavings } from '@/lib/utils';
import type { AvailabilityStatus, Database } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductStoreRow = Database['public']['Tables']['product_stores']['Row'];
type StoreSummary = Pick<Database['public']['Tables']['stores']['Row'], 'id' | 'name_ar' | 'name_en' | 'logo_url'>;

type DealProduct = ProductCardProduct & {
  product_stores: Array<
    ProductCardProduct['product_stores'][number] & {
      is_deal?: boolean;
      deal_expires_at?: string | null;
    }
  >;
};

type SortOption = 'discount' | 'price' | 'newest';

export default function DealsPage() {
  const supabase = getSupabaseBrowserClient();
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { toast } = useToast();
  const { addItem } = useMultiStoreCart();

  const [products, setProducts] = useState<DealProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('discount');
  const [filteredProducts, setFilteredProducts] = useState<DealProduct[]>([]);

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

  useEffect(() => {
    async function fetchDeals() {
      setLoading(true);
      setError(null);

      try {
        // Fetch products that have active deals
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

        // Group by product and transform data
        const productMap = new Map<string, DealProduct>();
        (data || []).forEach((item) => {
          const ps = item as ProductStoreRow & { stores: StoreSummary | null; products: ProductRow | null };
          if (!ps.products || !ps.stores) return;

          const productId = ps.products.id;
          if (!productMap.has(productId)) {
            productMap.set(productId, {
              id: ps.products.id,
              name_ar: ps.products.name_ar,
              name_en: ps.products.name_en,
              slug: ps.products.slug,
              category: ps.products.category,
              brand: ps.products.brand,
              model: ps.products.model,
              image_urls: ps.products.image_urls,
              product_stores: [],
            });
          }

          const product = productMap.get(productId)!;
          product.product_stores.push({
            id: ps.id,
            current_price: ps.current_price,
            original_price: ps.original_price,
            is_deal: ps.is_deal,
            deal_expires_at: ps.deal_expires_at,
            availability: ps.availability as AvailabilityStatus,
            stores: ps.stores,
          });
        });

        setProducts(Array.from(productMap.values()));
        setFilteredProducts(Array.from(productMap.values()));
      } catch (err) {
        console.error('Error fetching deals:', err);
        const errorMessage = err instanceof Error ? err.message : t('deals.error');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchDeals();
  }, [t]);

  // Filter and sort products
  useEffect(() => {
    let result = [...products];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (product) =>
          product.name_ar.toLowerCase().includes(query) ||
          product.name_en.toLowerCase().includes(query) ||
          product.brand.toLowerCase().includes(query) ||
          product.model.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      const aDeal = a.product_stores.find((ps) => ps.is_deal && ps.original_price);
      const bDeal = b.product_stores.find((ps) => ps.is_deal && ps.original_price);

      if (sortBy === 'discount') {
        const aDiscount = aDeal && aDeal.original_price
          ? calculateSavings(aDeal.original_price, aDeal.current_price)
          : 0;
        const bDiscount = bDeal && bDeal.original_price
          ? calculateSavings(bDeal.original_price, bDeal.current_price)
          : 0;
        return bDiscount - aDiscount;
      } else if (sortBy === 'price') {
        const aPrice = aDeal?.current_price || Infinity;
        const bPrice = bDeal?.current_price || Infinity;
        return aPrice - bPrice;
      } else if (sortBy === 'newest') {
        const aDate = aDeal?.deal_expires_at || '';
        const bDate = bDeal?.deal_expires_at || '';
        return bDate.localeCompare(aDate);
      }
      return 0;
    });

    setFilteredProducts(result);
  }, [products, searchQuery, sortBy]);

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
              <BreadcrumbPage>{t('deals.title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('deals.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('deals.subtitle')}</p>
        </div>

        {/* Filters and Sort */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-auto sm:flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder={t('deals.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {t('deals.sortBy')}:
            </label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('deals.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">{t('deals.sortDiscount')}</SelectItem>
                <SelectItem value="price">{t('deals.sortPrice')}</SelectItem>
                <SelectItem value="newest">{t('deals.sortNewest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        {!loading && !error && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {filteredProducts.length} {t('deals.resultsCount')}
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

        {/* Empty State */}
        {!loading && !error && filteredProducts.length === 0 && (
          <EmptyState
            icon={<Tag className="h-12 w-12" />}
            title={t('deals.noDeals')}
            description={
              searchQuery
                ? locale === 'ar'
                  ? `لا توجد عروض تطابق "${searchQuery}"`
                  : `No deals match "${searchQuery}"`
                : undefined
            }
          />
        )}

        {/* Products Grid */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                onAddToCart={handleAddToCart}
                showActions={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

