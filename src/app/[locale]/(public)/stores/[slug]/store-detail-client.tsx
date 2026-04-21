'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ProductCard, type ProductCardProduct } from '@/components/products/product-card';
import { StoreLogo } from '@/components/ui/store-logo';
import { StoreReviewCard, type StoreReview } from '@/components/stores/store-review-card';
import { StoreReviewForm } from '@/components/stores/store-review-form';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { createCartItemFromProduct } from '@/lib/cart/multi-store-cart';
import { incrementSaveCount } from '@/lib/wishlist/utils';
import { Price } from '@/components/ui/price';
import { Input } from '@/components/ui/input';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 AlertCircle,
 Award,
 Globe,
 Mail,
 MapPin,
 Package,
 Phone,
 RotateCcw,
 Search,
 ShieldCheck,
 Sparkles,
 Star,
 Store,
 Ticket,
} from 'lucide-react';
import { CouponBadge } from '@/components/ui/coupon-badge';
import type { DiscountType } from '@/lib/database/types';
import type { AvailabilityStatus, ProductCategory } from '@/lib/database/types';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from '@/components/ui/accordion';
import {
 Pagination,
 PaginationContent,
 PaginationEllipsis,
 PaginationItem,
 PaginationLink,
 PaginationNext,
 PaginationPrevious,
} from '@/components/ui/pagination';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

interface StoreDetails {
 id: string;
 name_ar: string;
 name_en: string;
 slug: string;
 logo_url: string | null;
 website_url: string | null;
 description_ar: string | null;
 description_en: string | null;
 delivery_info_ar: string | null;
 delivery_info_en: string | null;
 return_policy_ar: string | null;
 return_policy_en: string | null;
 warranty_info_ar: string | null;
 warranty_info_en: string | null;
 contact_email: string | null;
 contact_phone: string | null;
 average_rating: number | null;
 total_reviews: number | null;
 total_products: number | null;
 is_premium: boolean;
 is_featured: boolean;
}

interface ProductStoreEntry {
 id: string;
 current_price: number;
 original_price: number | null;
 availability: AvailabilityStatus;
 product_url: string | null;
 affiliate_url: string | null;
 products: {
 id: string;
 name_ar: string;
 name_en: string;
 slug: string;
 category: ProductCategory;
 brand: string;
 model: string;
 image_urls: string[] | null;
 } | null;
 stores: {
 id: string;
 slug: string | null;
 name_ar: string;
 name_en: string;
 logo_url: string | null;
 } | null;
}

interface StoreProduct {
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
 product_url: string | null;
 affiliate_url: string | null;
 stores: {
 id: string;
 slug: string | null;
 name_ar: string;
 name_en: string;
 logo_url: string | null;
 };
 }>;
}

type SortOption = 'recommended' | 'price_asc' | 'price_desc' | 'name' | 'discount';
const STORE_PRODUCTS_PAGE_SIZE = 20;
const COMPARE_STORAGE_KEY = 'compare_products';
const MAX_COMPARE_PRODUCTS = 4;

const VALID_SORTS: Readonly<SortOption[]> = ['recommended', 'price_asc', 'price_desc', 'name', 'discount'];

const parseSort = (raw: string | null): SortOption =>
 (VALID_SORTS as readonly string[]).includes(raw ?? '') ? (raw as SortOption) : 'recommended';

export default function StoreDetailClient() {
 const params = useParams();
 const router = useRouter();
 const pathname = usePathname();
 const searchParams = useSearchParams();
 const locale = (params?.locale as string) || 'ar';
 const slug = params?.slug as string;
 const t = useTranslations();
 const { user } = useAuth();
 const { toast } = useToast();
 const { addItem } = useMultiStoreCart();

 const [store, setStore] = useState<StoreDetails | null>(null);
 const [products, setProducts] = useState<StoreProduct[]>([]);
 const [reviews, setReviews] = useState<StoreReview[]>([]);
 const [coupons, setCoupons] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

 // Hydrate filter state from URL so shared links restore the view.
 const [searchInput, setSearchInput] = useState(() => searchParams?.get('q') ?? '');
 const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('q') ?? '');
 const [categoryFilter, setCategoryFilter] = useState(() => searchParams?.get('cat') ?? 'all');
 const [sortBy, setSortBy] = useState<SortOption>(() => parseSort(searchParams?.get('sort') ?? null));
 const [inStockOnly, setInStockOnly] = useState(() => searchParams?.get('in_stock') === '1');
 const [currentPage, setCurrentPage] = useState(() => {
 const raw = Number.parseInt(searchParams?.get('page') ?? '1', 10);
 return Number.isFinite(raw) && raw > 0 ? raw : 1;
 });

 const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
 const [savedProductIds, setSavedProductIds] = useState<Set<string>>(new Set());

 // Ref to the products section so pagination can scroll back to it.
 const productsTopRef = useRef<HTMLDivElement | null>(null);

 type StoreDetailsResponse = StoreDetails & { store_reviews: StoreReview[] };
 type ProductStoreResponse = ProductStoreEntry;

 useEffect(() => {
 async function fetchStoreDetails() {
 if (!slug) return;
 const supabase = getSupabaseBrowserClient();

 setLoading(true);
 setError(null);

 try {
 const { data: storeData, error: storeError } = await supabase
 .from('stores')
 .select(
 `
 *,
 store_reviews(
 id,
 rating,
 review_text,
 delivery_rating,
 product_quality_rating,
 customer_service_rating,
 is_verified_purchase,
 created_at,
 users(full_name, avatar_url)
 )
 `
 )
 .eq('slug', slug)
 .eq('status', 'active')
 .single<StoreDetailsResponse>();

 if (storeError) throw storeError;

 if (!storeData) {
 setError(t('store.notFound'));
 setLoading(false);
 return;
 }

 setStore(storeData);
 setReviews(storeData.store_reviews || []);

 // Fetch the full catalog in 1000-row batches (Supabase hard cap per
 // query). Hard ceiling of 20 batches (20k products) as a runaway
 // guard — no store currently comes close.
 const PRODUCTS_BATCH = 1000;
 const MAX_BATCHES = 20;
 const allProductRecords: unknown[] = [];
 for (let batch = 0; batch < MAX_BATCHES; batch++) {
 const from = batch * PRODUCTS_BATCH;
 const to = from + PRODUCTS_BATCH - 1;
 const { data: batchData, error: batchError } = await supabase
 .from('product_stores')
 .select(
 `
 id,
 current_price,
 original_price,
 availability,
 product_url,
 affiliate_url,
 products!inner(
 id,
 name_ar,
 name_en,
 slug,
 category,
 brand,
 model,
 image_urls
 ),
 stores(
 id,
 slug,
 name_ar,
 name_en,
 logo_url
 )
 `
 )
 .eq('store_id', storeData.id)
 .eq('products.is_active', true)
 .range(from, to);
 if (batchError) throw batchError;
 if (!batchData || batchData.length === 0) break;
 allProductRecords.push(...batchData);
 if (batchData.length < PRODUCTS_BATCH) break;
 }

 const groupedProducts = new Map<string, StoreProduct>();

 (allProductRecords as unknown as ProductStoreResponse[]).forEach((record) => {
 if (!record.products || !record.stores) return;

 const existing = groupedProducts.get(record.products.id);
 const productStore = {
 id: record.id,
 current_price: record.current_price,
 original_price: record.original_price,
 availability: record.availability,
 product_url: record.product_url,
 affiliate_url: record.affiliate_url,
 stores: {
 id: record.stores.id,
 slug: record.stores.slug,
 name_ar: record.stores.name_ar,
 name_en: record.stores.name_en,
 logo_url: record.stores.logo_url,
 },
 };

 if (existing) {
 existing.product_stores.push(productStore);
 groupedProducts.set(existing.id, { ...existing });
 } else {
 groupedProducts.set(record.products.id, {
 id: record.products.id,
 name_ar: record.products.name_ar,
 name_en: record.products.name_en,
 slug: record.products.slug,
 category: record.products.category,
 brand: record.products.brand,
 model: record.products.model,
 image_urls: record.products.image_urls,
 product_stores: [productStore],
 });
 }
 });

 setProducts(Array.from(groupedProducts.values()));

 // Fetch store coupons
 const { data: couponsData } = await supabase
 .from('coupons')
 .select('*')
 .eq('store_id', storeData.id)
 .eq('is_active', true)
 .or('expires_at.is.null,expires_at.gt.now()')
 .order('created_at', { ascending: false });

 setCoupons(couponsData || []);
 } catch (err) {
 console.error('Error loading store detail:', err);
 const message = err instanceof Error ? err.message : t('store.error');
 setError(message);
 } finally {
 setLoading(false);
 }
 }

 fetchStoreDetails();
 }, [slug, t]);

 const storeName = useMemo(() => {
 if (!store) return '';
 return locale === 'ar' ? store.name_ar : store.name_en;
 }, [store, locale]);

 // Sync compare-bar state with localStorage + events (matches deals/search).
 useEffect(() => {
 if (typeof window === 'undefined') return;
 const sync = () => {
 try {
 const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
 setCompareIds(new Set(raw ? (JSON.parse(raw) as string[]).slice(0, MAX_COMPARE_PRODUCTS) : []));
 } catch {
 setCompareIds(new Set());
 }
 };
 sync();
 window.addEventListener('compare-products-updated', sync);
 window.addEventListener('storage', sync);
 return () => {
 window.removeEventListener('compare-products-updated', sync);
 window.removeEventListener('storage', sync);
 };
 }, []);

 // Pull the user's saved product ids so hearts render filled.
 useEffect(() => {
 if (!user) {
 setSavedProductIds(new Set());
 return;
 }
 const supabase = getSupabaseBrowserClient();
 supabase
 .from('user_wishlists')
 .select('product_id')
 .eq('user_id', user.id)
 .then(({ data }) => {
 if (data) setSavedProductIds(new Set(data.map((r) => r.product_id).filter(Boolean)));
 });
 }, [user]);

 // Debounce the search input → URL-committed query so typing doesn't thrash
 // history. 300 ms is the same shape used in other search inputs in the app.
 useEffect(() => {
 const handle = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
 return () => clearTimeout(handle);
 }, [searchInput]);

 // Any filter change → back to page 1 so the user never lands on an empty page.
 useEffect(() => {
 setCurrentPage(1);
 }, [searchQuery, categoryFilter, sortBy, inStockOnly]);

 // Reflect filter state in the URL so the view is shareable and back/forward
 // navigates through filter history. `scroll: false` keeps scroll position.
 useEffect(() => {
 if (typeof window === 'undefined' || !pathname) return;
 const next = new URLSearchParams();
 if (searchQuery) next.set('q', searchQuery);
 if (categoryFilter && categoryFilter !== 'all') next.set('cat', categoryFilter);
 if (sortBy !== 'recommended') next.set('sort', sortBy);
 if (inStockOnly) next.set('in_stock', '1');
 if (currentPage > 1) next.set('page', String(currentPage));
 const qs = next.toString();
 const current = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
 if (qs === current) return;
 router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
 }, [pathname, searchQuery, categoryFilter, sortBy, inStockOnly, currentPage, router]);

 // Unique categories that this store actually carries, with counts. Drives
 // the filter chip row — no dead chips for categories the store doesn't sell.
 const categoriesInCatalog = useMemo(() => {
 const counts = new Map<string, number>();
 products.forEach((p) => {
 if (!p.category) return;
 counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
 });
 return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
 }, [products]);

 // Filter → sort pipeline. All client-side since the whole catalog is in memory.
 const filteredProducts = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 let result = products.filter((product) => {
 if (categoryFilter !== 'all' && product.category !== categoryFilter) return false;
 if (inStockOnly) {
 const hasStock = product.product_stores.some((ps) => ps.availability !== 'out_of_stock');
 if (!hasStock) return false;
 }
 if (q) {
 const haystack = [product.name_ar, product.name_en, product.brand, product.model]
 .filter(Boolean)
 .join(' ')
 .toLowerCase();
 if (!haystack.includes(q)) return false;
 }
 return true;
 });

 const bestPrice = (p: StoreProduct): number => {
 const prices = p.product_stores
 .filter((ps) => ps.current_price > 0)
 .map((ps) => ps.current_price);
 return prices.length > 0 ? Math.min(...prices) : Number.POSITIVE_INFINITY;
 };
 const bestSaving = (p: StoreProduct): number => {
 const gains = p.product_stores
 .filter((ps) => ps.original_price && ps.current_price && ps.original_price > ps.current_price)
 .map((ps) => (ps.original_price as number) - ps.current_price);
 return gains.length > 0 ? Math.max(...gains) : 0;
 };
 const isInStock = (p: StoreProduct): boolean =>
 p.product_stores.some((ps) => ps.availability !== 'out_of_stock');

 const sorted = [...result];
 if (sortBy === 'price_asc') {
 sorted.sort((a, b) => bestPrice(a) - bestPrice(b));
 } else if (sortBy === 'price_desc') {
 sorted.sort((a, b) => bestPrice(b) - bestPrice(a));
 } else if (sortBy === 'name') {
 sorted.sort((a, b) =>
 (locale === 'ar' ? a.name_ar : a.name_en).localeCompare(
 locale === 'ar' ? b.name_ar : b.name_en,
 locale,
 ),
 );
 } else if (sortBy === 'discount') {
 sorted.sort((a, b) => bestSaving(b) - bestSaving(a));
 } else {
 // recommended: in-stock first, then largest saving, then cheapest as tiebreaker.
 sorted.sort((a, b) => {
 const stock = Number(isInStock(b)) - Number(isInStock(a));
 if (stock !== 0) return stock;
 const saving = bestSaving(b) - bestSaving(a);
 if (saving !== 0) return saving;
 return bestPrice(a) - bestPrice(b);
 });
 }
 return sorted;
 }, [products, searchQuery, categoryFilter, sortBy, inStockOnly, locale]);

 const totalPages = Math.max(1, Math.ceil(filteredProducts.length / STORE_PRODUCTS_PAGE_SIZE));
 const paginatedProducts = useMemo(
 () =>
 filteredProducts.slice(
 (currentPage - 1) * STORE_PRODUCTS_PAGE_SIZE,
 currentPage * STORE_PRODUCTS_PAGE_SIZE,
 ),
 [filteredProducts, currentPage],
 );

 // Compact page list with ellipses — same shape as deals-client.
 const pageNumbers = useMemo<(number | 'ellipsis')[]>(() => {
 if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
 const pages: (number | 'ellipsis')[] = [1];
 const start = Math.max(2, currentPage - 1);
 const end = Math.min(totalPages - 1, currentPage + 1);
 if (start > 2) pages.push('ellipsis');
 for (let p = start; p <= end; p++) pages.push(p);
 if (end < totalPages - 1) pages.push('ellipsis');
 pages.push(totalPages);
 return pages;
 }, [totalPages, currentPage]);

 const handlePageChange = (next: number) => {
 if (next < 1 || next > totalPages || next === currentPage) return;
 setCurrentPage(next);
 if (productsTopRef.current) {
 productsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
 }
 };

 // Header stats — derived for the currently filtered view.
 const gridStats = useMemo(() => {
 const prices = filteredProducts
 .flatMap((p) => p.product_stores.map((ps) => ps.current_price))
 .filter((price): price is number => typeof price === 'number' && price > 0);
 if (prices.length === 0) return { cheapest: null, avg: null };
 const cheapest = Math.min(...prices);
 const avg = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
 return { cheapest, avg };
 }, [filteredProducts]);

 const handleReset = () => {
 setSearchInput('');
 setSearchQuery('');
 setCategoryFilter('all');
 setSortBy('recommended');
 setInStockOnly(false);
 setCurrentPage(1);
 };

 // Surprise me — random in-stock product from the current filtered set.
 const handleSurpriseMe = useCallback(() => {
 const candidates = filteredProducts.filter((p) =>
 p.product_stores.some((ps) => ps.availability !== 'out_of_stock'),
 );
 const pool = candidates.length > 0 ? candidates : filteredProducts;
 if (pool.length === 0) return;
 const pick = pool[Math.floor(Math.random() * pool.length)];
 router.push(`/${locale}/products/${pick.slug}`);
 }, [filteredProducts, router, locale]);

 const handleAddToCompare = (productId: string) => {
 if (typeof window === 'undefined') return;
 try {
 const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
 const existing: string[] = stored ? JSON.parse(stored) : [];
 const unique = Array.from(new Set(existing));

 if (unique.includes(productId)) {
 // Toggle off — matches deals/search page behavior.
 const next = unique.filter((id) => id !== productId);
 window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
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
 toast({
 title: t('products.added'),
 description: t('compare.addedToCompare'),
 });
 } catch (err) {
 console.error('Error updating compare list:', err);
 }
 };

 const handleSaveToWishlist = async (productId: string) => {
 if (!user) {
 router.push(`/${locale}/auth/login?redirect=/stores/${slug}`);
 return;
 }
 const supabase = getSupabaseBrowserClient();
 try {
 const { error: saveError } = await supabase
 .from('user_wishlists')
 .insert({ user_id: user.id, product_id: productId });
 if (saveError && saveError.code === '23505') {
 setSavedProductIds((prev) => new Set(prev).add(productId));
 toast({
 title: t('products.saved'),
 description:
 locale === 'ar'
 ? 'المنتج موجود بالفعل في قائمة الأمنيات'
 : 'Already in your wishlist',
 });
 return;
 }
 if (saveError) throw saveError;
 setSavedProductIds((prev) => new Set(prev).add(productId));
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

 const handleAddToCart = (product: ProductCardProduct) => {
 const cartItem = createCartItemFromProduct(product, locale);
 if (!cartItem) {
 toast({ title: t('product.addToCartUnavailable'), variant: 'destructive' });
 return;
 }
 addItem(cartItem);
 toast({ title: t('product.addedToCart'), description: cartItem.storeName });
 };

 const categoryLabel = useCallback(
 (key: string): string => {
 const maybe = t(`products.categories.${key}`);
 if (maybe && !maybe.startsWith('products.categories.')) return maybe;
 return key.replace(/_/g, ' ');
 },
 [t],
 );

 if (loading) {
 return (
 <div className="">
 <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <Skeleton className="h-48 w-full" />
 <Skeleton className="h-48 w-full" />
 <Skeleton className="h-48 w-full" />
 </div>
 <Skeleton className="h-80 w-full" />
 </div>
 </div>
 );
 }

 if (error || !store) {
 return (
 <div className="">
 <div className="container mx-auto px-4 py-8 max-w-4xl">
 <Alert variant="destructive">
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>{error || t('store.notFound')}</AlertDescription>
 </Alert>
 <div className="mt-6">
 <Button variant="outline" onClick={() => router.back()}>
 {locale === 'ar' ? 'الرجوع' : 'Go Back'}
 </Button>
 </div>
 </div>
 </div>
 );
 }

 const description = locale === 'ar' ? store.description_ar : store.description_en;
 const deliveryInfo = locale === 'ar' ? store.delivery_info_ar : store.delivery_info_en;
 const returnPolicy = locale === 'ar' ? store.return_policy_ar : store.return_policy_en;
 const warrantyInfo = locale === 'ar' ? store.warranty_info_ar : store.warranty_info_en;

 return (
 <div className="">
 <div className="container mx-auto px-4 py-8 max-w-6xl">
 <PageBreadcrumbs items={[
   { label: t('nav.stores'), href: `/${locale}/stores` },
   { label: storeName },
 ]} />
 {/* Store Header */}
 <Card className="mb-8">
 <CardContent className="p-6">
 <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
 <div className="flex items-center gap-4">
 <div className="relative flex h-24 w-24 items-center justify-center rounded-[var(--radius-lg)] overflow-hidden bg-[color:var(--color-surface)] border-[1.5px] border-[var(--brand-green-light)] shadow-[var(--elevation-1)]">
 <StoreLogo
 slug={store.slug}
 size="lg"
 alt={storeName}
 locale={locale as 'ar' | 'en'}
 className="!h-20 !w-20 object-contain"
 />
 </div>
 <div>
 {(store.is_featured || store.is_premium) && (
 <div className="flex flex-wrap items-center gap-2 mb-2">
 {store.is_premium ? (
 <Badge variant="best" className="t-caption gap-1">
 <Star className="h-3.5 w-3.5" fill="white" stroke="white" />
 {locale === 'ar' ? 'ممتاز' : 'Premium'}
 </Badge>
 ) : store.is_featured ? (
 <Badge variant="featured" className="t-caption">
 {locale === 'ar' ? 'مميز' : 'Featured'}
 </Badge>
 ) : null}
 </div>
 )}
 <h1 className="text-headline-lg text-on-surface mb-2">{storeName}</h1>
 {description && (
 <p className="text-on-surface-variant max-w-2xl whitespace-pre-line">{description}</p>
 )}
 </div>
 </div>

 <div className="flex flex-col gap-3 self-stretch items-end justify-start ms-auto">
 {store.average_rating !== null && (
 <div className="flex items-center gap-2 text-title-lg text-on-surface">
 <Star className="w-6 h-6 fill-featured-400 text-featured-400" />
 <span>{store.average_rating.toFixed(1)}</span>
 {store.total_reviews !== null && store.total_reviews > 0 && (
 <span className="text-sm text-on-surface-variant">
 ({store.total_reviews} {t('store.reviewsCount')})
 </span>
 )}
 </div>
 )}
 {store.website_url && (
 <Button asChild>
 <a href={store.website_url} target="_blank" rel="noopener noreferrer">
 <Globe className="w-4 h-4 me-2" />
 {t('store.visitWebsite')}
 </a>
 </Button>
 )}
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Quick Stats removed — rating, product count, and premium status are already in the header card. */}

 {/* Policies and Contact — hidden for now until real store data is available
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
 <Card className="h-full">
 <CardHeader>
 <CardTitle>{t('store.contactInfo')}</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 text-sm text-on-surface-variant">
 {store.contact_email ? (
 <div className="flex items-center gap-2">
 <Mail className="w-4 h-4" />
 <a href={`mailto:${store.contact_email}`} className="hover:underline">
 {store.contact_email}
 </a>
 </div>
 ) : (
 <div className="flex items-center gap-2 text-outline">
 <Mail className="w-4 h-4" />
 <span>{t('store.noEmail')}</span>
 </div>
 )}

 {store.contact_phone ? (
 <div className="flex items-center gap-2">
 <Phone className="w-4 h-4" />
 <a href={`tel:${store.contact_phone}`} className="hover:underline">
 {store.contact_phone}
 </a>
 </div>
 ) : (
 <div className="flex items-center gap-2 text-outline">
 <Phone className="w-4 h-4" />
 <span>{t('store.noPhone')}</span>
 </div>
 )}

 <div className="flex items-center gap-2 text-outline">
 <MapPin className="w-4 h-4" />
 <span>{t('store.contactNote')}</span>
 </div>
 </CardContent>
 </Card>

 <Card className="h-full">
 <CardHeader>
 <CardTitle>{t('store.storePolicies')}</CardTitle>
 </CardHeader>
 <CardContent>
 <Accordion type="single" collapsible className="w-full">
 {deliveryInfo && (
 <AccordionItem value="delivery">
 <AccordionTrigger className="text-label-lg flex items-center gap-2">
 <Package className="w-4 h-4" />
 {t('store.deliveryInfo')}
 </AccordionTrigger>
 <AccordionContent>
 <p className="text-sm text-on-surface-variant whitespace-pre-line pt-2">
 {deliveryInfo}
 </p>
 </AccordionContent>
 </AccordionItem>
 )}
 {returnPolicy && (
 <AccordionItem value="return">
 <AccordionTrigger className="text-label-lg flex items-center gap-2">
 <ShieldCheck className="w-4 h-4" />
 {t('store.returnPolicy')}
 </AccordionTrigger>
 <AccordionContent>
 <p className="text-sm text-on-surface-variant whitespace-pre-line pt-2">
 {returnPolicy}
 </p>
 </AccordionContent>
 </AccordionItem>
 )}
 {warrantyInfo && (
 <AccordionItem value="warranty">
 <AccordionTrigger className="text-label-lg flex items-center gap-2">
 <Store className="w-4 h-4" />
 {t('store.warrantyInfo')}
 </AccordionTrigger>
 <AccordionContent>
 <p className="text-sm text-on-surface-variant whitespace-pre-line pt-2">
 {warrantyInfo}
 </p>
 </AccordionContent>
 </AccordionItem>
 )}
 {!deliveryInfo && !returnPolicy && !warrantyInfo && (
 <p className="text-sm text-on-surface-variant text-center py-4">
 {t('store.noPoliciesAvailable') || (locale === 'ar' ? 'لا توجد سياسات متاحة' : 'No policies available')}
 </p>
 )}
 </Accordion>
 </CardContent>
 </Card>
 </div>
 */}

 {/* Coupons */}
 {coupons.length > 0 && (
 <section className="mb-12">
 <div className="flex items-center gap-2 mb-6">
 <Ticket className="h-5 w-5 text-tertiary-600 dark:text-tertiary-400" />
 <h2 className="text-headline-md text-on-surface">{t('coupons.availableCoupons')}</h2>
 <Badge variant="outline" className="text-sm">{coupons.length}</Badge>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {coupons.map((coupon) => (
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
 </div>
 </section>
 )}

 {/* Products */}
 <section className="mb-12" ref={productsTopRef}>
 <div className="flex flex-col gap-4 mb-4">
 {/* Title row — left: heading + subtitle; right: result meta + Surprise me */}
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0">
 <h2 className="text-headline-md text-on-surface">{t('store.products')}</h2>
 <p className="text-on-surface-variant">{t('store.productsSubtitle')}</p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <Badge variant="outline" className="text-sm">
 {filteredProducts.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
 {products.length !== filteredProducts.length && (
 <>
 {' / '}
 {products.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
 </>
 )}
 {' '}
 {t('store.productsCountLabel')}
 </Badge>
 {gridStats.cheapest !== null && (
 <Badge
 variant="outline"
 className="text-sm gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
 >
 <span className="opacity-70">
 {locale === 'ar' ? 'الأقل' : 'from'}
 </span>
 <Price
 amount={gridStats.cheapest}
 className="text-sm font-semibold tabular-nums"
 symbolClassName="w-3 h-3"
 />
 </Badge>
 )}
 {gridStats.avg !== null && gridStats.avg !== gridStats.cheapest && (
 <Badge variant="outline" className="text-sm gap-1">
 <span className="opacity-70">{locale === 'ar' ? 'المتوسط' : 'avg'}</span>
 <Price
 amount={gridStats.avg}
 className="text-sm font-semibold tabular-nums"
 symbolClassName="w-3 h-3"
 />
 </Badge>
 )}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={handleSurpriseMe}
 disabled={filteredProducts.length === 0}
 title={locale === 'ar' ? 'افتح منتجاً عشوائياً' : 'Open a random product'}
 className="gap-1"
 >
 <Sparkles className="h-4 w-4" />
 {locale === 'ar' ? 'فاجئني' : 'Surprise me'}
 </Button>
 </div>
 </div>

 {/* Search + sort + in-stock toggle */}
 <div className="flex flex-col gap-2 md:flex-row md:items-center">
 <div className="relative flex-1">
 <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
 <Input
 type="text"
 value={searchInput}
 onChange={(e) => setSearchInput(e.target.value)}
 placeholder={
 locale === 'ar'
 ? `ابحث في منتجات ${storeName}...`
 : `Search ${storeName} products...`
 }
 aria-label={locale === 'ar' ? 'ابحث في المنتجات' : 'Search products'}
 className="h-10 ps-9 border-2 border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] focus-visible:border-[var(--brand-green)]"
 />
 </div>
 <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
 <SelectTrigger className="h-10 w-full md:w-[200px] border-2 border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="recommended">
 {locale === 'ar' ? 'موصى به' : 'Recommended'}
 </SelectItem>
 <SelectItem value="price_asc">
 {locale === 'ar' ? 'السعر: الأقل أولاً' : 'Price: low to high'}
 </SelectItem>
 <SelectItem value="price_desc">
 {locale === 'ar' ? 'السعر: الأعلى أولاً' : 'Price: high to low'}
 </SelectItem>
 <SelectItem value="name">
 {locale === 'ar' ? 'الاسم' : 'Name'}
 </SelectItem>
 <SelectItem value="discount">
 {locale === 'ar' ? 'أعلى خصم' : 'Biggest discount'}
 </SelectItem>
 </SelectContent>
 </Select>
 <button
 type="button"
 onClick={() => setInStockOnly((v) => !v)}
 aria-pressed={inStockOnly}
 className={`inline-flex h-10 items-center gap-2 rounded-md border-2 px-3 text-sm font-medium transition-colors ${
 inStockOnly
 ? 'border-[var(--brand-green)] bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]'
 : 'border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] text-on-surface hover:border-[var(--brand-green)]'
 }`}
 >
 <span
 className={`inline-block h-2 w-2 rounded-full ${
 inStockOnly ? 'bg-[var(--brand-green)]' : 'bg-[color:var(--color-outline)]'
 }`}
 />
 {locale === 'ar' ? 'متوفر فقط' : 'In stock only'}
 </button>
 {(searchQuery || categoryFilter !== 'all' || sortBy !== 'recommended' || inStockOnly) && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={handleReset}
 className="h-10 gap-1 border-2 border-[color:var(--color-outline-variant)]"
 title={locale === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
 >
 <RotateCcw className="h-4 w-4" />
 {locale === 'ar' ? 'إعادة ضبط' : 'Reset'}
 </Button>
 )}
 </div>

 {/* Category chips — hidden when there's only one category (or none) in the catalog */}
 {categoriesInCatalog.length > 1 && (
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={() => setCategoryFilter('all')}
 className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-medium transition-colors ${
 categoryFilter === 'all'
 ? 'border-[var(--brand-green)] bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]'
 : 'border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] text-on-surface hover:border-[var(--brand-green)]'
 }`}
 >
 {locale === 'ar' ? 'الكل' : 'All'}
 <span className="text-xs opacity-70">{products.length}</span>
 </button>
 {categoriesInCatalog.map(([category, count]) => (
 <button
 key={category}
 type="button"
 onClick={() => setCategoryFilter(category)}
 className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-medium transition-colors ${
 categoryFilter === category
 ? 'border-[var(--brand-green)] bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]'
 : 'border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] text-on-surface hover:border-[var(--brand-green)]'
 }`}
 >
 {categoryLabel(category)}
 <span className="text-xs opacity-70">{count}</span>
 </button>
 ))}
 </div>
 )}
 </div>

 {filteredProducts.length === 0 ? (
 <EmptyState
 icon={<Package className="h-12 w-12" />}
 title={
 products.length === 0
 ? t('store.noProductsTitle')
 : locale === 'ar'
 ? 'لا توجد نتائج'
 : 'No matching products'
 }
 description={
 products.length === 0
 ? t('store.noProductsDescription')
 : locale === 'ar'
 ? 'جرّب تعديل البحث أو إزالة الفلاتر.'
 : 'Try adjusting your search or clearing filters.'
 }
 action={
 products.length > 0
 ? {
 label: locale === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset filters',
 onClick: handleReset,
 }
 : undefined
 }
 />
 ) : (
 <>
 <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
 </section>

 {/* Reviews */}
 <section className="mb-12">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-headline-md text-on-surface">{t('store.reviews')}</h2>
 <p className="text-on-surface-variant">{t('store.reviewsSubtitle')}</p>
 </div>
 <Button onClick={() => setReviewDialogOpen(true)}>{t('store.writeReview')}</Button>
 </div>

 {reviews.length === 0 ? (
 <EmptyState
 icon={<Star className="h-12 w-12" />}
 title={t('store.noReviewsTitle')}
 description={t('store.noReviewsDescription')}
 />
 ) : (
 <div className="grid grid-cols-1 gap-4">
 {reviews.map((review) => (
 <StoreReviewCard key={review.id} review={review} locale={locale} />
 ))}
 </div>
 )}
 </section>

 <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>{t('store.writeReview')}</DialogTitle>
 <DialogDescription>{t('store.reviewForm.subtitle')}</DialogDescription>
 </DialogHeader>
 <StoreReviewForm
 storeId={store.id}
 storeSlug={store.slug}
 locale={locale}
 onClose={() => setReviewDialogOpen(false)}
 onSuccess={(newReview) => {
 setReviews((prev) => [newReview, ...prev.filter((review) => review.id !== newReview.id)]);
 }}
 />
 </DialogContent>
 </Dialog>
 </div>
 </div>
 );
}


