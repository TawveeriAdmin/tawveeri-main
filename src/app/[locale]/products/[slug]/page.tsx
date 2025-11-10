'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { ProductCard } from '@/components/products/product-card';
import type { ProductCardProduct } from '@/components/products/product-card';
import { PriceHistoryChart } from '@/components/products/price-history-chart';
import { PriceAlertDialog } from '@/components/products/price-alert-dialog';
import { GiftOption } from '@/components/products/gift-option';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  Heart,
  BarChart3,
  Bell,
  Share2,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
  Star,
  Package,
  Truck,
  ShieldCheck,
  Clock,
  ShoppingCart,
} from 'lucide-react';
import { calculateSavings } from '@/lib/utils';
import type { AvailabilityStatus, Database } from '@/lib/database/types';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductStoreRow = Database['public']['Tables']['product_stores']['Row'];
type StoreSummary = Pick<
  Database['public']['Tables']['stores']['Row'],
  'id' | 'name_ar' | 'name_en' | 'logo_url' | 'average_rating' | 'total_reviews'
>;

interface ProductStore
  extends Pick<
    ProductStoreRow,
    | 'id'
    | 'current_price'
    | 'original_price'
    | 'currency'
    | 'availability'
    | 'stock_quantity'
    | 'product_url'
    | 'affiliate_url'
    | 'delivery_time_days'
    | 'delivery_cost'
    | 'is_free_delivery'
    | 'is_deal'
    | 'deal_expires_at'
    | 'coupon_code'
  > {
  stores: StoreSummary;
}

type ProductQueryResult = ProductRow & {
  product_stores: Array<ProductStoreRow & { stores: StoreSummary | null }>;
};

interface Product extends ProductRow {
  product_stores: ProductStore[];
}

const mapProductRecord = (record: ProductQueryResult): Product => ({
  ...record,
  product_stores: (record.product_stores || [])
    .filter((ps) => ps.stores)
    .map((ps) => ({
      id: ps.id,
      current_price: ps.current_price,
      original_price: ps.original_price,
      currency: ps.currency,
      availability: ps.availability as AvailabilityStatus,
      stock_quantity: ps.stock_quantity,
      product_url: ps.product_url,
      affiliate_url: ps.affiliate_url,
      delivery_time_days: ps.delivery_time_days,
      delivery_cost: ps.delivery_cost,
      is_free_delivery: ps.is_free_delivery,
      is_deal: ps.is_deal,
      deal_expires_at: ps.deal_expires_at,
      coupon_code: ps.coupon_code,
      stores: ps.stores as StoreSummary,
    })),
});

export default function ProductDetailPage() {
  const supabase = getSupabaseBrowserClient();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const slug = params?.slug as string;
  const t = useTranslations();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addItem } = useMultiStoreCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [priceAlertOpen, setPriceAlertOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [shareUrl, setShareUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    async function fetchProduct() {
      if (!slug) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch product with all details
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(
            `
            *,
            product_stores(
              id,
              current_price,
              original_price,
              currency,
              availability,
              stock_quantity,
              product_url,
              affiliate_url,
              delivery_time_days,
              delivery_cost,
              is_free_delivery,
              is_deal,
              deal_expires_at,
              coupon_code,
              stores(
                id,
                name_ar,
                name_en,
                logo_url,
                average_rating,
                total_reviews
              )
            )
          `
          )
          .eq('slug', slug)
          .eq('is_active', true)
          .single<ProductQueryResult>();

        if (productError) throw productError;

        if (!productData) {
          setError(t('product.notFound'));
          setLoading(false);
          return;
        }

        setProduct(mapProductRecord(productData));

        // Increment view count (non-blocking)
        supabase
          .from('products')
          .update({ view_count: (productData.view_count || 0) + 1 })
          .eq('id', productData.id)
          .then(() => {
            // Silently handle - don't block UI
          });

        // Fetch related products
        const { data: relatedData } = await supabase
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
          `
          )
          .eq('category', productData.category)
          .neq('id', productData.id)
          .eq('is_active', true)
          .limit(4)
          .returns<ProductQueryResult[]>();

        setRelatedProducts((relatedData || []).map(mapProductRecord));
      } catch (err) {
        console.error('Error fetching product:', err);
        const errorMessage = err instanceof Error ? err.message : t('product.error');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [slug, t]);

  const handleAddToCompare = (productId: string) => {
    // TODO: Implement comparison functionality
    toast({
      title: locale === 'ar' ? 'تمت الإضافة' : 'Added',
      description: locale === 'ar' ? 'تم إضافة المنتج للمقارنة' : 'Product added to comparison',
    });
  };

  const handleSaveToWishlist = async (productId: string) => {
    if (!user) {
      router.push(`/${locale}/auth/login`);
      return;
    }

    try {
      const { error } = await supabase.from('user_wishlists').insert({
        user_id: user.id,
        product_id: productId,
      });

      if (error) throw error;

      toast({
        title: locale === 'ar' ? 'تم الحفظ' : 'Saved',
        description: locale === 'ar' ? 'تم حفظ المنتج في قائمة الأمنيات' : 'Product saved to wishlist',
      });
    } catch (err) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: err instanceof Error ? err.message : locale === 'ar' ? 'فشل الحفظ' : 'Failed to save',
        variant: 'destructive',
      });
    }
  };

  const handleSetPriceAlert = () => {
    if (!user) {
      router.push(`/${locale}/auth/login`);
      return;
    }
    setPriceAlertOpen(true);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t('product.productShared'),
      });
    } catch (err) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل نسخ الرابط' : 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const handleViewAtStore = async (productStore: ProductStore) => {
    try {
      // Create transaction record for tracking
      if (user) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          product_store_id: productStore.id,
          clicked_at: new Date().toISOString(),
          user_agent: navigator.userAgent,
          referrer: document.referrer,
        });
      }

      // Open store URL
      const url = productStore.affiliate_url || productStore.product_url;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error tracking store click:', err);
      // Still open the URL even if tracking fails
      const url = productStore.affiliate_url || productStore.product_url;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyCoupon = async (couponCode: string) => {
    try {
      await navigator.clipboard.writeText(couponCode);
      setCopiedCoupon(couponCode);
      setTimeout(() => setCopiedCoupon(null), 2000);
      toast({
        title: locale === 'ar' ? 'تم النسخ' : 'Copied',
        description: locale === 'ar' ? 'تم نسخ كود الخصم' : 'Coupon code copied',
      });
    } catch (err) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل النسخ' : 'Failed to copy',
        variant: 'destructive',
      });
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
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

  const handleAddRelatedToCart = (relatedProduct: ProductCardProduct) => {
    const cartItem = createCartItemFromProduct(relatedProduct, locale);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || t('product.notFound')}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const productName = locale === 'ar' ? product.name_ar : product.name_en;
  const productDescription = locale === 'ar' ? product.description_ar : product.description_en;
  const images = product.image_urls || [];
  const currentImage = images[currentImageIndex] || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

  // Get best price
  const storesWithPrices = product.product_stores
    .filter((ps) => ps.availability !== 'out_of_stock')
    .sort((a, b) => a.current_price - b.current_price);
  const bestPriceStore = storesWithPrices[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
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
              <BreadcrumbLink asChild>
                <Link href={`/${locale}/products`}>{t('products.title')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{productName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Main Product Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
              <img
                src={currentImage}
                alt={productName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                }}
              />
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      currentImageIndex === idx
                        ? 'border-primary-600 dark:border-primary-400'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${productName} ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{productName}</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {product.brand} - {product.model}
              </p>
              {product.sku && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  SKU: {product.sku}
                </p>
              )}
            </div>

            {/* Best Price */}
            {bestPriceStore && (
              <div className="flex items-baseline gap-3">
                <Price
                  amount={bestPriceStore.current_price}
                  className="text-4xl font-bold"
                  symbolClassName="w-7 h-7"
                />
                {bestPriceStore.original_price && bestPriceStore.original_price > bestPriceStore.current_price && (
                  <>
                    <Price
                      amount={bestPriceStore.original_price}
                      className="text-xl text-gray-400 dark:text-gray-500 line-through"
                      symbolClassName="w-5 h-5"
                    />
                    <Badge variant="success-light" className="text-sm">
                      💰 {t('price.save')}{' '}
                      <Price
                        amount={calculateSavings(bestPriceStore.original_price, bestPriceStore.current_price)}
                        className="text-sm font-semibold"
                        symbolClassName="w-3 h-3"
                      />
                    </Badge>
                  </>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="default"
                onClick={handleAddToCart}
                disabled={!bestPriceStore}
                className="flex-1 sm:flex-initial"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                {t('product.addToCart')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAddToCompare(product.id)}
                className="flex-1 sm:flex-initial"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                {t('product.addToCompare')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSaveToWishlist(product.id)}
                className="flex-1 sm:flex-initial"
              >
                <Heart className="w-4 h-4 mr-2" />
                {t('product.saveToWishlist')}
              </Button>
              <Button variant="outline" onClick={handleSetPriceAlert} className="flex-1 sm:flex-initial">
                <Bell className="w-4 h-4 mr-2" />
                {t('product.setPriceAlert')}
              </Button>
              <Button variant="outline" onClick={handleShare} className="flex-1 sm:flex-initial">
                <Share2 className="w-4 h-4 mr-2" />
                {t('product.share')}
              </Button>
              <GiftOption productName={productName} shareUrl={shareUrl} />
            </div>

            {/* Description */}
            {productDescription && (
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {productDescription}
                </p>
              </div>
            )}

            {/* Video */}
            {product.video_url && (
              <div className="aspect-video rounded-lg overflow-hidden">
                <iframe
                  src={product.video_url}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>

        {/* Specifications */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t('product.specifications')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {Object.entries(product.specifications).map(([key, value]) => (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger>{key}</AccordionTrigger>
                    <AccordionContent>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Price History Charts */}
        {product.product_stores.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {product.product_stores.slice(0, 2).map((productStore) => {
              const storeName = locale === 'ar' ? productStore.stores.name_ar : productStore.stores.name_en;
              return (
                <PriceHistoryChart
                  key={productStore.id}
                  productStoreId={productStore.id}
                  productName={productName}
                  storeName={storeName}
                  locale={locale}
                />
              );
            })}
          </div>
        )}

        {/* Available Stores */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('product.availableStores')}</CardTitle>
          </CardHeader>
          <CardContent>
            {product.product_stores.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'لا توجد متاجر متاحة' : 'No stores available'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {product.product_stores.map((productStore) => {
                  const storeName = locale === 'ar' ? productStore.stores.name_ar : productStore.stores.name_en;
                  const isBestPrice = productStore.id === bestPriceStore?.id;
                  const savings = productStore.original_price
                    ? calculateSavings(productStore.original_price, productStore.current_price)
                    : 0;

                  return (
                    <div key={productStore.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{storeName}</h3>
                        {isBestPrice && (
                          <Badge variant="success">{t('product.bestPrice')}</Badge>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2">
                        <Price
                          amount={productStore.current_price}
                          className="text-2xl font-bold"
                          symbolClassName="w-6 h-6"
                        />
                        {productStore.original_price &&
                          productStore.original_price > productStore.current_price && (
                            <Price
                              amount={productStore.original_price}
                              className="text-sm text-gray-400 line-through"
                              symbolClassName="w-4 h-4"
                            />
                          )}
                      </div>

                      {savings > 0 && (
                        <Badge variant="success-light" className="text-xs">
                          💰 {t('price.save')} <Price amount={savings} className="text-xs" symbolClassName="w-3 h-3" />
                        </Badge>
                      )}

                      <div className="space-y-2 text-sm">
                        {productStore.availability === 'in_stock' && (
                          <div className="flex items-center gap-2 text-success-600">
                            <Package className="w-4 h-4" />
                            <span>{t('product.inStock')}</span>
                          </div>
                        )}
                        {productStore.delivery_time_days && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span>
                              {productStore.delivery_time_days}{' '}
                              {locale === 'ar' ? 'أيام' : productStore.delivery_time_days === 1 ? 'day' : 'days'}
                            </span>
                          </div>
                        )}
                        {productStore.is_free_delivery ? (
                          <div className="flex items-center gap-2 text-success-600">
                            <Truck className="w-4 h-4" />
                            <span>{t('product.freeDelivery')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Truck className="w-4 h-4" />
                            <span>
                              {t('product.deliveryCost')}: <Price amount={productStore.delivery_cost} className="text-xs" />
                            </span>
                          </div>
                        )}
                        {productStore.coupon_code && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {productStore.coupon_code}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyCoupon(productStore.coupon_code!)}
                            >
                              {copiedCoupon === productStore.coupon_code ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => handleViewAtStore(productStore)}
                        className="w-full"
                        variant={isBestPrice ? 'default' : 'outline'}
                      >
                        {t('product.viewAtStore')} <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {t('product.relatedProducts')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  locale={locale}
                  onCompare={handleAddToCompare}
                  onSave={handleSaveToWishlist}
                  onAddToCart={handleAddRelatedToCart}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {product && (
        <PriceAlertDialog
          open={priceAlertOpen}
          onOpenChange={setPriceAlertOpen}
          productId={product.id}
          productName={productName}
          currentPrice={bestPriceStore?.current_price ?? null}
          locale={locale}
        />
      )}
    </div>
  );
}

