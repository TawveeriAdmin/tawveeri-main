'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { ProductCard } from '@/components/products/product-card';
import type { ProductCardProduct } from '@/components/products/product-card';
import { PriceHistoryChart } from '@/components/products/price-history-chart';
import { PriceAlertDialog } from '@/components/products/price-alert-dialog';
import { ImageGalleryModal } from '@/components/products/image-gallery-modal';
import { ProductVideoPlayer } from '@/components/products/product-video-player';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { ProductReviews } from '@/components/products/product-reviews';
import { ProductRatingDisplay } from '@/components/products/product-rating-display';
import { ProductSpecifications } from '@/components/products/product-specifications';
import { ComparisonTable } from '@/components/products/comparison-table';
import { track, initTestModeFromUrl } from '@/lib/analytics/track';
import { BestPriceCard } from '@/components/products/best-price-card';
import { ProductImageFrame, PRODUCT_PLACEHOLDER_IMAGE } from '@/components/products/shared-product-card';
import {
 Heart,
 BarChart3,
 Bell,
 Share2,
 AlertCircle,
 Eye,
 X,
 ZoomIn,
 ShieldCheck,
 Store,
 TrendingDown,
} from 'lucide-react';
import type { AvailabilityStatus, Database, DiscountType } from '@/lib/database/types';
import { CouponBadge } from '@/components/ui/coupon-badge';
import { Ticket } from 'lucide-react';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';
import { generateAffiliateUrl } from '@/lib/transactions/tracking';
import { incrementSaveCount } from '@/lib/wishlist/utils';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductStoreRow = Database['public']['Tables']['product_stores']['Row'];
type ProductCoupon = Database['public']['Tables']['coupons']['Row'];
type StoreSummary = Pick<
 Database['public']['Tables']['stores']['Row'],
 'id' | 'slug' | 'name_ar' | 'name_en' | 'logo_url' | 'average_rating' | 'total_reviews'
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

export default function ProductDetailClient() {
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
 const [productCoupons, setProductCoupons] = useState<ProductCoupon[]>([]);
 const [priceAlertOpen, setPriceAlertOpen] = useState(false);
 const [currentImageIndex, setCurrentImageIndex] = useState(0);
 const [galleryOpen, setGalleryOpen] = useState(false);
 const [viewCount, setViewCount] = useState<number | null>(null);
 const [compareIds, setCompareIds] = useState<Set<string>>(() => {
 if (typeof window === 'undefined') return new Set();
 try {
 const raw = window.localStorage.getItem('compare_products');
 return new Set(raw ? (JSON.parse(raw) as string[]) : []);
 } catch {
 return new Set();
 }
 });

 // Keep in-compare state in sync with the floating bar / other tabs.
 useEffect(() => {
 const sync = () => {
 try {
 const raw = window.localStorage.getItem('compare_products');
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
 slug,
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
 .maybeSingle<ProductQueryResult>();

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
 slug,
 name_ar,
 name_en,
 logo_url,
 average_rating,
 total_reviews
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

 // Fallback: name-token + brand search ACROSS categories so that e.g.
 // "iPhone 17 Pro Max" surfaces "iPhone 17 Pro Max case" (accessories),
 // not random same-category items.
 if (!relatedData || relatedData.length === 0) {
 const combinedName = `${productData.name_en || ''} ${productData.name_ar || ''}`.toLowerCase();
 const STOPWORDS = new Set([
 'the', 'and', 'for', 'with', 'from', 'black', 'white', 'new',
 'في', 'من', 'إلى', 'على', 'مع', 'أسود', 'أبيض', 'جديد',
 ]);
 const tokens = Array.from(
 new Set(
 combinedName
 .replace(/[,.()\-_/\\:"']/g, ' ')
 .split(/\s+/)
 .map((w) => w.trim())
 .filter(
 (w) =>
 w.length >= 3 &&
 /^[\w؀-ۿ]+$/.test(w) &&
 !STOPWORDS.has(w),
 ),
 ),
 ).slice(0, 6);

 const sourceBrand = (productData.brand || '').trim().toLowerCase();
 const brandForFilter =
 sourceBrand && sourceBrand !== 'unknown' ? sourceBrand : '';

 // OR filter: brand overlap OR any meaningful token appears in the product
 // name in either language. Crosses category boundaries on purpose.
 const orParts: string[] = [];
 if (brandForFilter) orParts.push(`brand.ilike.*${brandForFilter}*`);
 for (const tok of tokens) {
 orParts.push(`name_en.ilike.*${tok}*`);
 orParts.push(`name_ar.ilike.*${tok}*`);
 }

 let candidatePool: ProductQueryResult[] = [];
 if (orParts.length > 0) {
 const { data } = await supabase
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
 slug,
 name_ar,
 name_en,
 logo_url,
 average_rating,
 total_reviews
 )
 )
 `
 )
 .neq('id', productData.id)
 .eq('is_active', true)
 .or(orParts.join(','))
 .limit(100)
 .returns<ProductQueryResult[]>();
 candidatePool = data ?? [];
 }

 // Rank: token overlap drives the "iPhone 17 Pro Max → iPhone 17 Pro Max case"
 // match, strong brand bonus keeps results Apple-heavy for an Apple product,
 // same-category is a small tiebreaker.
 const scored = candidatePool
 .map((p) => {
 const name = `${p.name_en || ''} ${p.name_ar || ''}`.toLowerCase();
 const overlap = tokens.filter((tok) => name.includes(tok)).length;
 const brandMatch =
 brandForFilter && p.brand && p.brand.toLowerCase().includes(brandForFilter)
 ? 3
 : 0;
 const sameCategory = p.category === productData.category ? 1 : 0;
 return { p, score: overlap + brandMatch + sameCategory };
 })
 .filter((x) => x.score > 0)
 .sort((a, b) => b.score - a.score)
 .slice(0, 4)
 .map((x) => x.p);

 // Top-up with same-category popularity if scoring returned fewer than 4.
 if (scored.length < 4) {
 const { data: popularity } = await supabase
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
 slug,
 name_ar,
 name_en,
 logo_url,
 average_rating,
 total_reviews
 )
 )
 `
 )
 .eq('category', productData.category)
 .neq('id', productData.id)
 .eq('is_active', true)
 .order('view_count', { ascending: false, nullsFirst: false })
 .limit(8)
 .returns<ProductQueryResult[]>();

 const seen = new Set(scored.map((p) => p.id));
 const fillIns = (popularity ?? []).filter((p) => !seen.has(p.id));
 relatedData = [...scored, ...fillIns].slice(0, 4);
 } else {
 relatedData = scored;
 }
 }

 setRelatedProducts((relatedData || []).map(mapProductRecord));

 // Fetch applicable coupons (product-specific + store-wide)
 const storeIds = (mappedProduct.product_stores || [])
 .map((ps) => ps.stores?.id)
 .filter((id): id is string => Boolean(id));
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

 // Persist test/real opt-in (?test=1) so storefront funnel events separate testers from real users.
 useEffect(() => { initTestModeFromUrl(); }, []);

 // Funnel steps 3-5 on the storefront (render-based, standard for page-level steps):
 //  • product_view — the detail page loaded.
 //  • comparison_view — a multi-store (>=2) comparison is present (single-store products don't fire it,
 //    so this step honestly narrows the funnel to products that CAN be compared).
 //  • evidence_view — a multi-store comparison ALSO carries price evidence (history + best-price verdict).
 // Fires once per loaded product (keyed on product id), never for a null/errored load.
 useEffect(() => {
 if (!product?.id) return;
 const stores = product.product_stores?.length ?? 0;
 track('product_view', { canonical_id: product.id, category: product.category ?? null, source: 'product_page', meta: { stores } });
 if (stores >= 2) {
 track('comparison_view', { canonical_id: product.id, category: product.category ?? null, source: 'product_page', meta: { stores, auto: true } });
 track('evidence_view', { canonical_id: product.id, source: 'product_page', meta: { stores, surface: 'comparison+price_history', auto: true } });
 }
 }, [product?.id, product?.product_stores?.length, product?.category]);

 const handleAddToCompare = (productId: string) => {
 if (typeof window === 'undefined') return;
 try {
 const stored = window.localStorage.getItem('compare_products');
 const existing: string[] = stored ? JSON.parse(stored) : [];
 const unique = Array.from(new Set(existing));

 // Toggle: if already in compare, remove it (matches search page behavior).
 if (unique.includes(productId)) {
 const next = unique.filter((id) => id !== productId);
 window.localStorage.setItem('compare_products', JSON.stringify(next));
 try {
 const cacheRaw = window.localStorage.getItem('compare_products_cache');
 const cache: Record<string, unknown> = cacheRaw ? JSON.parse(cacheRaw) : {};
 delete cache[productId];
 window.localStorage.setItem('compare_products_cache', JSON.stringify(cache));
 } catch {
 // ignore
 }
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
 window.localStorage.setItem('compare_products', JSON.stringify(next));

 // Seed cache so the floating bar renders without a DB round-trip. Use the
 // current product when available, otherwise pull the matching related
 // product so the bar can render its thumbnail immediately.
 const sourceProduct =
 product?.id === productId
 ? product
 : relatedProducts.find((rp) => rp.id === productId);
 if (sourceProduct) {
 try {
 const cacheRaw = window.localStorage.getItem('compare_products_cache');
 const cache: Record<string, unknown> = cacheRaw ? JSON.parse(cacheRaw) : {};
 cache[productId] = {
 id: sourceProduct.id,
 name_ar: sourceProduct.name_ar,
 name_en: sourceProduct.name_en,
 slug: sourceProduct.slug,
 image_urls: sourceProduct.image_urls,
 };
 window.localStorage.setItem('compare_products_cache', JSON.stringify(cache));
 } catch {
 // ignore — bar will DB-fetch as fallback
 }
 }

 window.dispatchEvent(new Event('compare-products-updated'));

 toast({
 title: t('products.added'),
 description: t('compare.addedToCompare'),
 });
 } catch {
 // ignore storage errors
 }
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
 } catch {
 toast({
 title: t('common.error'),
 description: t('products.linkCopyError'),
 variant: 'destructive',
 });
 }
 };

 const handleViewAtStore = async (productStore: ProductStore) => {
 // Funnel step 6 — Outbound Click. The storefront exits via generateAffiliateUrl+window.open (NOT /go),
 // so this event is the ONLY measurement of storefront exits. Fired first (keepalive) so a slow/failed
 // affiliate-URL call never loses the exit signal.
 track('go_click', {
 canonical_id: product?.id ?? null,
 store: productStore.stores?.slug ?? productStore.stores?.name_en ?? null,
 category: product?.category ?? null,
 source: 'product_page',
 meta: { price: productStore.current_price ?? null, availability: productStore.availability ?? null, measured: false },
 });
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
 <div className="">
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
 <div className="">
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
 const currentImage = images[currentImageIndex] || PRODUCT_PLACEHOLDER_IMAGE;

 // Get best price
 const storesWithPrices = product.product_stores
 .filter((ps) => ps.availability !== 'out_of_stock')
 .sort((a, b) => a.current_price - b.current_price);
 const bestPriceStore = storesWithPrices[0];
 const highestPrice = storesWithPrices[storesWithPrices.length - 1]?.current_price ?? 0;
 const priceRange = bestPriceStore && highestPrice > bestPriceStore.current_price
   ? highestPrice - bestPriceStore.current_price
   : 0;
 const storeCount = product.product_stores.length;

 // Brand / model display — hide when missing or "Unknown" from scrapers
 const rawBrand = (product.brand || '').trim();
 const brandLabel = rawBrand && rawBrand.toLowerCase() !== 'unknown' ? rawBrand : '';
 const rawModel = (product.model || '').trim();
 // Don't repeat the product name if model just duplicates it
 const modelLabel =
   rawModel && rawModel.toLowerCase() !== productName.toLowerCase() && !productName.toLowerCase().includes(rawModel.toLowerCase())
     ? rawModel
     : '';
 const subtitleParts = [brandLabel, modelLabel].filter(Boolean);

 return (
 <div className="">
 <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
 <PageBreadcrumbs items={[
   { label: t('common.home'), href: `/${locale}` },
   { label: t('button.search'), href: `/${locale}/search` },
   { label: productName },
 ]} />

 {/* Main Product Info — first viewport focused on decision-making */}
 <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
 <div className="lg:sticky lg:top-24 lg:self-start">
 <div className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-3 shadow-[var(--elevation-1)]">
 <button
 type="button"
 onClick={() => setGalleryOpen(true)}
 className="group relative aspect-square w-full overflow-hidden rounded-[1.35rem] bg-[color:var(--color-surface-container-low)] cursor-zoom-in"
 aria-label={locale === 'ar' ? 'تكبير الصورة' : 'Zoom image'}
 >
 <ProductImageFrame
 src={currentImage}
 alt={productName}
 className="h-full w-full rounded-none bg-transparent"
 imageClassName="p-7 group-hover:scale-[1.025]"
 sizes="(min-width: 1024px) 42vw, 100vw"
 unoptimized={currentImage.includes('jarir.com')}
 />
 <span className="absolute end-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/85 text-[var(--brand-green-dark)] shadow-[var(--elevation-1)] backdrop-blur-sm transition-transform group-hover:scale-105 dark:border-white/10 dark:bg-black/35">
 <ZoomIn className="h-4 w-4" />
 </span>
 </button>

 {images.length > 1 && (
 <div className="mt-3 grid grid-cols-5 gap-2">
 {images.slice(0, 5).map((img, idx) => (
 <button
 key={idx}
 type="button"
 onClick={() => setCurrentImageIndex(idx)}
 aria-label={`${productName} ${idx + 1}`}
 className={`relative aspect-square overflow-hidden rounded-xl border transition-all ${
 currentImageIndex === idx
 ? 'border-[var(--brand-green)] ring-2 ring-[var(--brand-green)]/18'
 : 'border-[color:var(--color-outline-variant)]/60 hover:border-[var(--brand-green)]/50'
 }`}
 >
 <ProductImageFrame
 src={img}
 alt={`${productName} ${idx + 1}`}
 className="h-full w-full rounded-none bg-[color:var(--color-surface-container-low)]"
 imageClassName="p-1.5"
 sizes="96px"
 unoptimized={img.includes('jarir.com')}
 />
 </button>
 ))}
 </div>
 )}
 </div>
 </div>

 <div className="min-w-0 space-y-5">
 <div className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-1)] md:p-6">
 <div className="mb-4 flex flex-wrap items-center gap-2">
 {product.category && (
 <Badge variant="outline" className="h-8 rounded-full px-3 text-xs">
 {t(`products.categories.${product.category}`)}
 </Badge>
 )}
 {bestPriceStore && (
 <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--brand-bg-green)] px-3 text-xs font-semibold text-[var(--brand-green-dark)]">
 <ShieldCheck className="h-3.5 w-3.5" />
 {locale === 'ar' ? 'أفضل سعر مؤكد' : 'Best price checked'}
 </span>
 )}
 {viewCount !== null && viewCount > 0 && (
 <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)]/60 px-3 text-xs font-medium text-on-surface-variant">
 <Eye className="h-3.5 w-3.5" />
 {locale === 'ar'
 ? `${viewCount.toLocaleString('ar-SA')} مشاهدة`
 : `${viewCount.toLocaleString('en-US')} view${viewCount !== 1 ? 's' : ''}`}
 </span>
 )}
 </div>

 <h1 dir="auto" className="mb-3 text-2xl font-black leading-tight tracking-tight text-on-surface md:text-4xl">
 {productName}
 </h1>

 <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-on-surface-variant">
 {subtitleParts.length > 0 && <span>{subtitleParts.join(' · ')}</span>}
 {product.sku && (
 <span className="rounded-full bg-[color:var(--color-surface-container-low)] px-2.5 py-1 text-xs tabular-nums">
 SKU: {product.sku}
 </span>
 )}
 </div>

 {(product.average_rating && product.total_reviews) || product.merchant_rating ? (
 <div className="mt-4 flex flex-wrap items-center gap-2">
 <ProductRatingDisplay
 rating={product.average_rating || product.merchant_rating || 0}
 totalReviews={product.total_reviews || product.merchant_review_count || 0}
 size="md"
 />
 {!product.average_rating && product.merchant_rating && (
 <span className="text-xs text-on-surface-variant">
 {locale === 'ar' ? 'من المتجر' : 'from merchant'}
 </span>
 )}
 </div>
 ) : null}

 {storeCount > 0 && (
 <div className="mt-5 grid grid-cols-1 overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface-container-low)] sm:grid-cols-3">
 <div className="flex items-center gap-3 p-4">
 <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-surface)] text-[var(--brand-green-dark)]">
 <Store className="h-5 w-5" />
 </span>
 <div>
 <p className="text-xs text-on-surface-variant">{locale === 'ar' ? 'المتاجر' : 'Stores'}</p>
 <p className="text-lg font-black tabular-nums text-on-surface">
 {storeCount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3 border-y border-[color:var(--color-outline-variant)]/50 p-4 sm:border-x sm:border-y-0">
 <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-surface)] text-[var(--brand-green-dark)]">
 <TrendingDown className="h-5 w-5" />
 </span>
 <div>
 <p className="text-xs text-on-surface-variant">{locale === 'ar' ? 'أقل سعر' : 'Lowest'}</p>
 <Price
 amount={bestPriceStore?.current_price ?? 0}
 className="text-lg font-black text-[var(--brand-green-dark)]"
 symbolClassName="h-4 w-4"
 />
 </div>
 </div>
 <div className="flex items-center gap-3 p-4">
 <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-surface)] text-[var(--brand-gold-dark)]">
 <BarChart3 className="h-5 w-5" />
 </span>
 <div>
 <p className="text-xs text-on-surface-variant">{locale === 'ar' ? 'فرق السعر' : 'Price spread'}</p>
 {priceRange > 0 ? (
 <Price
 amount={priceRange}
 className="text-lg font-black text-[var(--brand-gold-dark)]"
 symbolClassName="h-4 w-4"
 />
 ) : (
 <p className="text-lg font-black text-on-surface-variant">—</p>
 )}
 </div>
 </div>
 </div>
 )}
 </div>

 {bestPriceStore && (
 <BestPriceCard
 store={bestPriceStore.stores}
 currentPrice={bestPriceStore.current_price}
 originalPrice={bestPriceStore.original_price}
 availability={bestPriceStore.availability}
 url={bestPriceStore.affiliate_url || bestPriceStore.product_url}
 onClick={() => handleViewAtStore(bestPriceStore)}
 />
 )}

 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 {(() => {
 const inCompare = compareIds.has(product.id);
 return (
 <button
 type="button"
 onClick={() => handleAddToCompare(product.id)}
 aria-pressed={inCompare}
 className={
 inCompare
 ? 'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-600 transition-all hover:border-red-400 hover:bg-red-100 active:scale-[0.98] dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400'
 : 'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-sm font-semibold text-on-surface transition-all hover:border-[var(--brand-green)] hover:bg-[var(--brand-bg-green)] hover:text-[var(--brand-green-dark)] active:scale-[0.98]'
 }
 >
 {inCompare ? <X className="h-4 w-4 shrink-0" /> : <BarChart3 className="h-4 w-4 shrink-0" />}
 <span className="truncate">
 {inCompare
 ? locale === 'ar'
 ? 'إزالة من المقارنة'
 : 'Remove from compare'
 : t('product.addToCompare')}
 </span>
 </button>
 );
 })()}
 <button type="button" onClick={() => handleSaveToWishlist(product.id)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-sm font-semibold text-on-surface transition-all hover:border-[var(--brand-green)] hover:bg-[var(--brand-bg-green)] hover:text-[var(--brand-green-dark)] active:scale-[0.98]">
 <Heart className="h-4 w-4 shrink-0" />
 <span className="truncate">{t('product.saveToWishlist')}</span>
 </button>
 <button type="button" onClick={handleSetPriceAlert} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-sm font-semibold text-on-surface transition-all hover:border-[var(--brand-green)] hover:bg-[var(--brand-bg-green)] hover:text-[var(--brand-green-dark)] active:scale-[0.98]">
 <Bell className="h-4 w-4 shrink-0" />
 <span className="truncate">{t('product.setPriceAlert')}</span>
 </button>
 <button type="button" onClick={handleShare} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-sm font-semibold text-on-surface transition-all hover:border-[var(--brand-green)] hover:bg-[var(--brand-bg-green)] hover:text-[var(--brand-green-dark)] active:scale-[0.98]">
 <Share2 className="h-4 w-4 shrink-0" />
 <span className="truncate">{t('product.share')}</span>
 </button>
 </div>

 {productDescription && (
 <section className="rounded-[1.35rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-5">
 <h2 className="mb-2 text-base font-bold text-on-surface">
 {locale === 'ar' ? 'نظرة عامة' : 'Overview'}
 </h2>
 <p className="whitespace-pre-line text-sm leading-7 text-on-surface-variant">
 {productDescription}
 </p>
 </section>
 )}

 {product.video_url && (
 <ProductVideoPlayer
 videoUrl={product.video_url}
 thumbnailUrl={images[0]}
 className="mt-6"
 />
 )}
 </div>
 </div>


 {/* Store comparison — the main moment for a price-comparison site */}
 {product.product_stores.length > 0 && (
 <section className="mb-10 rounded-[1.75rem] bg-[color:var(--color-surface-container-low)] p-3 md:p-5">
 <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
 <div>
 <h2 className="t-h2 text-on-surface">{t('product.availableStores')}</h2>
 <p className="t-small text-on-surface-variant mt-1">
 {locale === 'ar'
 ? 'قارن السعر ووقت التوصيل والضمان بين كل المتاجر'
 : 'Compare price, delivery time and warranty across every store'}
 </p>
 </div>
 <span className="t-small font-semibold text-[var(--brand-green-dark)]">
 {locale === 'ar'
 ? `${product.product_stores.length} متجر`
 : `${product.product_stores.length} store${product.product_stores.length === 1 ? '' : 's'}`}
 </span>
 </div>
 <ComparisonTable
 productStores={product.product_stores}
 onStoreClick={(productStoreId) => {
 const ps = product.product_stores.find((s) => s.id === productStoreId);
 if (ps) handleViewAtStore(ps);
 }}
 />
 </section>
 )}

 {/* 90-day price history — single large chart for the best-price store */}
 {bestPriceStore && (
 <section className="mb-10 rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-1)]">
 <div className="mb-4">
 <h2 className="t-h2 text-on-surface">
 {locale === 'ar' ? 'سجل الأسعار' : 'Price history'}
 </h2>
 <p className="t-small text-on-surface-variant mt-1">
 {locale === 'ar'
 ? `آخر 90 يوم في ${locale === 'ar' ? bestPriceStore.stores.name_ar : bestPriceStore.stores.name_en}`
 : `Last 90 days at ${locale === 'ar' ? bestPriceStore.stores.name_ar : bestPriceStore.stores.name_en}`}
 </p>
 </div>
 <PriceHistoryChart
 productStoreId={bestPriceStore.id}
 productName={productName}
 storeName={locale === 'ar' ? bestPriceStore.stores.name_ar : bestPriceStore.stores.name_en}
 locale={locale}
 height={320}
 />
 </section>
 )}

 {/* Available Coupons */}
 {productCoupons.length > 0 && (
 <section className="mb-10">
 <Card className="rounded-[1.75rem]">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Ticket className="h-5 w-5 text-tertiary-600 dark:text-tertiary-400" />
 {t('coupons.availableCoupons')}
 <Badge variant="outline">{productCoupons.length}</Badge>
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {productCoupons.map((coupon) => (
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
 </section>
 )}

 {/* Specifications — collapsible accordion */}
 {Object.keys(product.specifications || {}).length > 0 && (
 <section className="mb-10 rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-1)]">
 <Accordion type="single" collapsible defaultValue="specs">
 <AccordionItem value="specs">
 <AccordionTrigger className="t-h2 text-on-surface">
 {t('products.specifications.title')}
 </AccordionTrigger>
 <AccordionContent className="pt-2">
 <ProductSpecifications
 specifications={product.specifications || {}}
 category={product.category}
 locale={locale}
 />
 </AccordionContent>
 </AccordionItem>
 </Accordion>
 </section>
 )}

 {/* Reviews — collapsible accordion (open if any exist) */}
 <section className="mb-10 rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-1)]">
 <Accordion type="single" collapsible defaultValue={(product.total_reviews || 0) > 0 ? 'reviews' : undefined}>
 <AccordionItem value="reviews">
 <AccordionTrigger className="t-h2 text-on-surface">
 {locale === 'ar' ? 'التقييمات' : 'Reviews'}
 <span className="ms-2 t-small font-normal text-on-surface-variant">
 ({product.total_reviews || 0})
 </span>
 </AccordionTrigger>
 <AccordionContent className="pt-2">
 <ProductReviews
 productId={product.id}
 productName={productName}
 averageRating={product.average_rating || 0}
 totalReviews={product.total_reviews || 0}
 locale={locale}
 />
 </AccordionContent>
 </AccordionItem>
 </Accordion>
 </section>

 {/* Similar products — horizontal rail */}
 {relatedProducts.length > 0 && (
 <section className="pb-4">
 <h2 className="t-h2 text-on-surface mb-6">
 {t('product.relatedProducts')}
 </h2>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
 {relatedProducts.map((relatedProduct) => (
 <ProductCard
 key={relatedProduct.id}
 product={relatedProduct}
 locale={locale}
 onCompare={handleAddToCompare}
 onSave={handleSaveToWishlist}
 onAddToCart={handleAddRelatedToCart}
 isInCompare={compareIds.has(relatedProduct.id)}
 />
 ))}
 </div>
 </section>
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
