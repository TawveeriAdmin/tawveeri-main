'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Heart, AlertCircle, Trash2, LogIn } from 'lucide-react';
import type { AvailabilityStatus, Database } from '@/lib/database/types';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';
import { GuestPrompt } from '@/components/auth/guest-prompt';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductStoreRow = Database['public']['Tables']['product_stores']['Row'];
type StoreSummary = Pick<Database['public']['Tables']['stores']['Row'], 'id' | 'name_ar' | 'name_en' | 'logo_url'>;

type WishlistProduct = ProductCardProduct & {
  product_stores: Array<
    (Pick<ProductStoreRow, 'id' | 'current_price' | 'original_price'> & {
      availability: AvailabilityStatus;
      stores: StoreSummary;
    })
  >;
};

type WishlistProductRecord = ProductRow & {
  product_stores: Array<ProductStoreRow & { stores: StoreSummary | null }>;
};

const mapWishlistProduct = (record: WishlistProductRecord): WishlistProduct => ({
  id: record.id,
  name_ar: record.name_ar,
  name_en: record.name_en,
  slug: record.slug,
  category: record.category,
  brand: record.brand,
  model: record.model,
  image_urls: record.image_urls,
  product_stores: (record.product_stores || [])
    .filter((ps) => ps.stores)
    .map((ps) => ({
      id: ps.id,
      current_price: ps.current_price,
      original_price: ps.original_price,
      availability: ps.availability as AvailabilityStatus,
      stores: ps.stores as StoreSummary,
    })),
});

export default function WishlistPage() {
  const supabase = getSupabaseBrowserClient();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { addItem } = useMultiStoreCart();

  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWishlist() {
      if (authLoading) return;

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: wishlistItems, error: wishlistError } = await supabase
          .from('user_wishlists')
          .select('product_id')
          .eq('user_id', user.id)
          .returns<Array<Pick<Database['public']['Tables']['user_wishlists']['Row'], 'product_id'>>>();

        if (wishlistError) throw wishlistError;

        if (!wishlistItems || wishlistItems.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const productIds = wishlistItems.map((item) => item.product_id);

        const { data: productsData, error: productsError } = await supabase
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
          `
          )
          .in('id', productIds)
          .eq('is_active', true)
          .returns<WishlistProductRecord[]>();

        if (productsError) throw productsError;

        setProducts((productsData || []).map(mapWishlistProduct));
      } catch (err) {
        console.error('Error fetching wishlist:', err);
        const errorMessage = err instanceof Error ? err.message : t('wishlist.error');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchWishlist();
  }, [user, authLoading, t]);

  const handleRemoveFromWishlist = async (productId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;

      setProducts(products.filter((p) => p.id !== productId));

      toast({
        title: t('wishlist.removeSuccess'),
        variant: 'default',
      });
    } catch (err) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: err instanceof Error ? err.message : locale === 'ar' ? 'فشل الإزالة' : 'Failed to remove',
        variant: 'destructive',
      });
    }
  };

  const handleAddToCompare = (productId: string) => {
    console.log('Add to compare:', productId);
  };

  const handleAddToCart = (product: WishlistProduct) => {
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <GuestPrompt
            locale={locale}
            title={t('wishlist.guestTitle') || 'Sign in to save your favourite products'}
            description={t('wishlist.guestDescription') || 'Create an account to build your wishlist, track prices, and never miss a deal.'}
            ctaLabel={t('auth.signIn') || 'Sign in'}
          />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <EmptyState
            icon={<LogIn className="h-12 w-12" />}
            title={t('wishlist.signInRequired')}
            action={{
              label: locale === 'ar' ? 'سجل الدخول' : 'Sign In',
              onClick: () => router.push(`/${locale}/auth/login`),
            }}
          />
        </div>
      </div>
    );
  }

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
              <BreadcrumbPage>{t('wishlist.title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('wishlist.myWishlist')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {products.length} {t('wishlist.savedProducts')}
          </p>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <EmptyState
            icon={<Heart className="h-12 w-12" />}
            title={t('wishlist.noProducts')}
            description={t('wishlist.emptyDescription')}
            action={{
              label: locale === 'ar' ? 'تصفح المنتجات' : 'Browse Products',
              onClick: () => router.push(`/${locale}/products`),
            }}
          />
        )}

        {/* Products Grid */}
        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div key={product.id} className="relative">
                <ProductCard
                  product={product}
                  locale={locale}
                  onCompare={handleAddToCompare}
                  onSave={() => handleRemoveFromWishlist(product.id)}
                  onAddToCart={handleAddToCart}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  aria-label={t('wishlist.remove')}
                  onClick={() => handleRemoveFromWishlist(product.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

