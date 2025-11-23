'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { ProductCard } from '@/components/products/product-card';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PackageSearch, AlertCircle } from 'lucide-react';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';

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

const ITEMS_PER_PAGE = 24;

export default function ProductsPage() {
  const supabase = getSupabaseBrowserClient();
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { toast } = useToast();
  const { addItem } = useMultiStoreCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);

        const offset = (currentPage - 1) * ITEMS_PER_PAGE;

        // Build query
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

        // Apply category filter
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        // Apply sorting
        if (sortBy === 'popularity') {
          query = query.order('view_count', { ascending: false });
        } else if (sortBy === 'price_low') {
          // Note: This is a simplified sort - in production, you'd sort by min price
          query = query.order('view_count', { ascending: false });
        } else if (sortBy === 'price_high') {
          query = query.order('view_count', { ascending: false });
        } else if (sortBy === 'newest') {
          query = query.order('created_at', { ascending: false });
        }

        // Apply pagination
        const { data, error: queryError, count } = await query
          .range(offset, offset + ITEMS_PER_PAGE - 1);

        if (queryError) throw queryError;

        setProducts(data || []);
        setTotalCount(count || 0);
      } catch (err) {
        console.error('Error fetching products:', err);
        const errorMessage = err instanceof Error ? err.message : t('products.error');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [selectedCategory, sortBy, currentPage, t]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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
    });
  };

  const handleCategoryChange = (category: ProductCategory | 'all') => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page when category changes
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    setCurrentPage(1); // Reset to first page when sort changes
  };

  const handleAddToCompare = (productId: string) => {
    // TODO: Implement comparison functionality
    console.log('Add to compare:', productId);
  };

  const handleSaveToWishlist = (productId: string) => {
    // TODO: Implement wishlist functionality
    console.log('Save to wishlist:', productId);
  };

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
              <BreadcrumbPage>{t('products.title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('products.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('products.subtitle')}
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Category Tabs */}
          <Tabs
            value={selectedCategory}
            onValueChange={(value) => handleCategoryChange(value as ProductCategory | 'all')}
            className="w-full sm:w-auto"
          >
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">{t('products.allCategories')}</TabsTrigger>
              <TabsTrigger value="tv">{t('products.categories.tv')}</TabsTrigger>
              <TabsTrigger value="laptop">{t('products.categories.laptop')}</TabsTrigger>
              <TabsTrigger value="smartphone">{t('products.categories.smartphone')}</TabsTrigger>
              <TabsTrigger value="tablet">{t('products.categories.tablet')}</TabsTrigger>
              <TabsTrigger value="audio">{t('products.categories.audio')}</TabsTrigger>
              <TabsTrigger value="gaming">{t('products.categories.gaming')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {t('products.sortBy')}:
            </label>
            <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortOption)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popularity">{t('products.sortPopularity')}</SelectItem>
                <SelectItem value="price_low">{t('products.sortPriceLow')}</SelectItem>
                <SelectItem value="price_high">{t('products.sortPriceHigh')}</SelectItem>
                <SelectItem value="newest">{t('products.sortNewest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        {!loading && !error && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {totalCount} {t('products.resultsCount')}
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

        {/* Products Grid */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
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

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) {
                          setCurrentPage(currentPage - 1);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
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
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) {
                          setCurrentPage(currentPage + 1);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>
    </div>
  );
}

