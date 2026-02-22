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
import { ImageGalleryModal } from '@/components/products/image-gallery-modal';
import { ProductVideoPlayer } from '@/components/products/product-video-player';
import {
 Breadcrumb,
 BreadcrumbItem,
 BreadcrumbLink,
 BreadcrumbList,
 BreadcrumbPage,
 BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { ProductReviews } from '@/components/products/product-reviews';
import { ProductRatingDisplay } from '@/components/products/product-rating-display';
import { ProductSpecifications } from '@/components/products/product-specifications';
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
 Eye,
} from 'lucide-react';
import { calculateSavings } from '@/lib/utils';
import type { AvailabilityStatus, Database, DiscountType } from '@/lib/database/types';
import { CouponBadge } from '@/components/ui/coupon-badge';
import { Ticket } from 'lucide-react';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';
import { trackProductClick, generateAffiliateUrl } from '@/lib/transactions/tracking';
import { incrementSaveCount } from '@/lib/wishlist/utils';

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
 const [productCoupons, setProductCoupons] = useState<any[]>([]);
 const [priceAlertOpen, setPriceAlertOpen] = useState(false);
 const [currentImageIndex, setCurrentImageIndex] = useState(0);
 const [galleryOpen, setGalleryOpen] = useState(false);
 const [shareUrl, setShareUrl] = useState<string>('');
 const [viewCount, setViewCount] = useState<number | null>(null);

 useEffect(() => {
 if (typeof window !== 'undefined') {
 setShareUrl(window.location.href);
 }
 }, []);

 // Track product view on page load
 useEffect(() => {
 if (!product?.id) return;

 const trackView = async () => {
 try {
 const response = await fetch(`/api/products/${product.id}/view`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 ...(user?.id && { 'x-user-id': user.id }),
 },
 });

 if (response.ok) {
 const data = await response.json();
 setViewCount(data.view_count);
 }
 } catch (error) {
 console.error('Error tracking view:', error);
 // Set from product data if tracking fails
 if (product.view_count !== undefined) {
 setViewCount(product.view_count);
 }
 }
 };

 trackView();
 }, [product?.id, user?.id]);

 useEffect(() => {
 async function fetchProduct() {
 if (!slug) return;

 setLoading(true);
 setError(null);

 const supabase = getSupabaseBrowserClient();
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

 const mappedProduct = mapProductRecord(productData);
 setProduct(mappedProduct);
 setViewCount(mappedProduct.view_count);
 // View count is now tracked via API route (see useEffect above)

 // Fetch AI-powered similar products via .rpc()
 let relatedData: ProductQueryResult[] | null = null;
 try {
 const { data: recData } = await supabase.rpc('get_recommendations', {
 p_user_id: undefined,
 p_product_id: productData.id,
 p_type: 'auto',
 p_limit: 4,
 });

 const recIds = (recData ?? []).map((r: { id: string }) => r.id);
 if (recIds.length > 0) {
 const { data: enriched } = await supabase
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
 .in('id', recIds)
 .eq('is_active', true)
 .returns<ProductQueryResult[]>();

 // Preserve recommendation order
 const enrichedMap = new Map((enriched ?? []).map((p) => [p.id, p]));
 relatedData = recIds
 .map((rid: string) => enrichedMap.get(rid))
 .filter((p: ProductQueryResult | undefined): p is ProductQueryResult => Boolean(p));
 }
 } catch {
 // Fallback to category-based if RPC fails
 }

 // Fallback: category-based related products
 if (!relatedData || relatedData.length === 0) {
 const { data: fallbackData } = await supabase
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
 relatedData = fallbackData;
 }

 setRelatedProducts((relatedData || []).map(mapProductRecord));

 // Fetch applicable coupons (product-specific + store-wide)
 const storeIds = (mappedProduct.product_stores || []).map((ps: any) => ps.stores?.id).filter(Boolean);
 if (storeIds.length > 0) {
 const { data: couponsData } = await supabase
 .from('coupons')
 .select('*')
 .eq('is_active', true)
 .or('expires_at.is.null,expires_at.gt.now()')
 .or(`product_id.eq.${productData.id},product_id.is.null`)
 .in('store_id', storeIds)
 .order('discount_value', { ascending: false });

 setProductCoupons(couponsData || []);
 }
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
 title: t('products.added'),
 description: t('products.addedToComparison'),
 });
 };

 const handleSaveToWishlist = async (productId: string) => {
 if (!user) {
 router.push(`/${locale}/auth/login`);
 return;
 }

 try {
 const supabase = getSupabaseBrowserClient();
 const { error } = await supabase.from('user_wishlists').insert({
 user_id: user.id,
 product_id: productId,
 });

 if (error) throw error;

 // Track save_count increment
 incrementSaveCount(productId).catch((err) => {
 console.error('Error tracking save_count:', err);
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
 title: t('common.error'),
 description: t('products.linkCopyError'),
 variant: 'destructive',
 });
 }
 };

 const handleViewAtStore = async (productStore: ProductStore) => {
 try {
 // Track click and generate affiliate URL
 const { data: trackingUrl, error: trackingError } = await generateAffiliateUrl(
 productStore.id,
 user?.id
 );

 if (trackingError) {
 console.error('Error generating tracking URL:', trackingError);
 // Fallback to regular URL
 const url = productStore.affiliate_url || productStore.product_url;
 window.open(url, '_blank', 'noopener,noreferrer');
 return;
 }

 // Store click_id in sessionStorage for potential conversion tracking
 if (trackingUrl) {
 const urlObj = new URL(trackingUrl);
 const clickId = urlObj.searchParams.get('click_id');
 if (clickId) {
 sessionStorage.setItem(`click_${productStore.id}`, clickId);
 }
 }

 // Open URL with tracking
 const url = trackingUrl || productStore.affiliate_url || productStore.product_url;
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
 title: t('products.copied'),
 description: t('products.couponCopied'),
 });
 } catch (err) {
 toast({
 title: t('common.error'),
 description: t('products.copyError'),
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
 <div className="min-h-screen bg-surface-container transition-colors duration-300">
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
 <div className="min-h-screen bg-surface-container transition-colors duration-300">
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
 <div className="min-h-screen bg-surface-container transition-colors duration-300">
 <div className="container mx-auto px-4 py-8 max-w-7xl">
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
 <button
 onClick={() => setGalleryOpen(true)}
 className="relative aspect-square w-full rounded-xl overflow-hidden bg-surface-container-highest border-2 border-outline-variant cursor-pointer hover:border-primary transition-colors"
 >
 <img
 src={currentImage}
 alt={productName}
 className="w-full h-full object-contain"
 onError={(e) => {
 const target = e.target as HTMLImageElement;
 target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
 }}
 />
 </button>
 {images.length > 1 && (
 <div className="grid grid-cols-4 gap-2">
 {images.map((img, idx) => (
 <button
 key={idx}
 onClick={() => setCurrentImageIndex(idx)}
 className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
 currentImageIndex === idx
 ? 'border-primary-600'
 : 'border-outline-variant'
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
 <h1 className="text-headline-lg text-on-surface mb-2">{productName}</h1>
 <p className="text-lg text-on-surface-variant">
 {product.brand} - {product.model}
 </p>
 {product.sku && (
 <p className="text-sm text-on-surface-variant mt-1">
 SKU: {product.sku}
 </p>
 )}
 {/* Rating Display */}
 {product.average_rating && product.total_reviews && (
 <div className="mt-3">
 <ProductRatingDisplay
 rating={product.average_rating}
 totalReviews={product.total_reviews}
 size="md"
 />
 </div>
 )}
 {/* View Count */}
 {viewCount !== null && viewCount > 0 && (
 <div className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
 <Eye className="w-4 h-4" />
 <span>
 {locale === 'ar'
 ? `${viewCount.toLocaleString('ar-SA')} مشاهدة`
 : `${viewCount.toLocaleString('en-US')} view${viewCount !== 1 ? 's' : ''}`}
 </span>
 </div>
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
 className="text-xl text-outline line-through"
 symbolClassName="w-5 h-5"
 />
 <Badge variant="success-light" className="text-sm">
 💰 {t('price.save')}{' '}
 <Price
 amount={calculateSavings(bestPriceStore.original_price, bestPriceStore.current_price)}
 className="text-label-lg"
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
 <div className="prose max-w-none">
 <p className="text-on-surface-variant whitespace-pre-line">
 {productDescription}
 </p>
 </div>
 )}

 {/* Video */}
 {product.video_url && (
 <ProductVideoPlayer
 videoUrl={product.video_url}
 thumbnailUrl={images[0]}
 className="mt-6"
 />
 )}
 </div>
 </div>


 {/* Product Details Tabs */}
 <Tabs defaultValue="specifications" className="mb-8">
 <TabsList>
 <TabsTrigger value="specifications">
 {t('products.specifications')}
 </TabsTrigger>
 <TabsTrigger value="reviews">
 {locale === 'ar' ? 'التقييمات' : 'Reviews'} ({product.total_reviews || 0})
 </TabsTrigger>
 </TabsList>

 <TabsContent value="specifications" className="space-y-6">
 {/* Specifications */}
 <ProductSpecifications
 specifications={product.specifications || {}}
 category={product.category}
 locale={locale}
 />

 {/* Price History Charts */}
 {product.product_stores.length > 0 && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
 </TabsContent>

 <TabsContent value="reviews">
 <Card>
 <CardContent className="pt-6">
 <ProductReviews
 productId={product.id}
 productName={productName}
 averageRating={product.average_rating || 0}
 totalReviews={product.total_reviews || 0}
 locale={locale}
 />
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Available Stores */}
 <Card className="mb-8">
 <CardHeader>
 <CardTitle>{t('product.availableStores')}</CardTitle>
 </CardHeader>
 <CardContent>
 {product.product_stores.length === 0 ? (
 <p className="text-on-surface-variant">
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
 className="text-headline-md"
 symbolClassName="w-6 h-6"
 />
 {productStore.original_price &&
 productStore.original_price > productStore.current_price && (
 <Price
 amount={productStore.original_price}
 className="text-sm text-outline line-through"
 symbolClassName="w-4 h-4"
 />
 )}
 </div>

 {savings > 0 && (
 <Badge variant="success-light" className="text-body-sm">
 💰 {t('price.save')} <Price amount={savings} className="text-body-sm" symbolClassName="w-3 h-3" />
 </Badge>
 )}

 <div className="space-y-2 text-sm">
 {productStore.availability === 'in_stock' && (
 <div className="flex items-center gap-2 text-success">
 <Package className="w-4 h-4" />
 <span>{t('product.inStock')}</span>
 </div>
 )}
 {productStore.delivery_time_days && (
 <div className="flex items-center gap-2 text-on-surface-variant">
 <Clock className="w-4 h-4" />
 <span>
 {productStore.delivery_time_days}{' '}
 {locale === 'ar' ? 'أيام' : productStore.delivery_time_days === 1 ? 'day' : 'days'}
 </span>
 </div>
 )}
 {productStore.is_free_delivery ? (
 <div className="flex items-center gap-2 text-success">
 <Truck className="w-4 h-4" />
 <span>{t('product.freeDelivery')}</span>
 </div>
 ) : (
 <div className="flex items-center gap-2 text-on-surface-variant">
 <Truck className="w-4 h-4" />
 <span>
 {t('product.deliveryCost')}: <Price amount={productStore.delivery_cost} className="text-body-sm" />
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

 {/* Available Coupons */}
 {productCoupons.length > 0 && (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Ticket className="h-5 w-5 text-tertiary-600 dark:text-tertiary-400" />
 {t('coupons.availableCoupons')}
 <Badge variant="outline">{productCoupons.length}</Badge>
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {productCoupons.map((coupon: any) => (
 <CouponBadge
 key={coupon.id}
 coupon={{
 id: coupon.id,
 code: coupon.code,
 description_ar: coupon.description_ar,
 description_en: coupon.description_en,
 discount_type: coupon.discount_type as DiscountType,
 discount_value: coupon.discount_value,
 min_purchase: coupon.min_purchase,
 max_discount: coupon.max_discount,
 expires_at: coupon.expires_at,
 }}
 variant="expanded"
 locale={locale}
 />
 ))}
 </CardContent>
 </Card>
 )}

 {/* Related Products */}
 {relatedProducts.length > 0 && (
 <div>
 <h2 className="text-headline-md text-on-surface mb-6">
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
 <>
 <PriceAlertDialog
 open={priceAlertOpen}
 onOpenChange={setPriceAlertOpen}
 productId={product.id}
 productName={productName}
 currentPrice={bestPriceStore?.current_price ?? null}
 locale={locale}
 />
 <ImageGalleryModal
 images={images}
 initialIndex={currentImageIndex}
 isOpen={galleryOpen}
 onClose={() => setGalleryOpen(false)}
 locale={locale}
 />
 </>
 )}
 </div>
 );
}

