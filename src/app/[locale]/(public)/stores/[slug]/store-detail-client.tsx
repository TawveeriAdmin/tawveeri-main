'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
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
 Globe,
 Package,
 RotateCcw,
 Search,
 Sparkles,
 Star,
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
 Pagination,
 PaginationContent,
 PaginationEllipsis,
 PaginationItem,
 PaginationLink,
 PaginationNext,
 PaginationPrevious,
} from '@/components/ui/pagination';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { isTechProduct } from '@/lib/scraping/product-filter';

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

interface StoreCoupon {
 id: string;
 code: string;
 description_ar: string | null;
 description_en: string | null;
 discount_type: DiscountType;
 discount_value: number;
 min_purchase: number | null;
 max_discount: number | null;
 expires_at: string | null;
}

interface CategoryCountRow {
 current_price?: number | null;
 product_url: string | null;
 products: {
 id: string;
 name_ar: string | null;
 name_en: string | null;
 category: string | null;
 brand: string | null;
 } | null;
}

interface SurpriseProductRow {
 products: { slug: string | null } | null;
}

type SortOption = 'recommended' | 'price_asc' | 'price_desc' | 'name' | 'discount';
const STORE_PRODUCTS_PAGE_SIZE = 20;
const COMPARE_STORAGE_KEY = 'compare_products';
const MAX_COMPARE_PRODUCTS = 4;

const VALID_SORTS: Readonly<SortOption[]> = ['recommended', 'price_asc', 'price_desc', 'name', 'discount'];

const parseSort = (raw: string | null): SortOption =>
 (VALID_SORTS as readonly string[]).includes(raw ?? '') ? (raw as SortOption) : 'recommended';

function isElectronicsStoreProduct(record: {
 product_url?: string | null;
 products?: {
 name_ar?: string | null;
 name_en?: string | null;
 category?: string | null;
 brand?: string | null;
 } | null;
}): boolean {
 const product = record.products;
 if (!product) return false;
 return isTechProduct(
  product.name_en || product.name_ar || '',
  product.brand || null,
  product.category || '',
  { product_url: '', url: '' },
 );
}

function StoreHeroMetric({
 value,
 label,
 icon,
}: {
 value: string;
 label: string;
 icon: ReactNode;
}) {
 return (
 <div className="border-e border-[color:var(--color-outline-variant)] p-4 last:border-e-0">
 <div className="flex items-center gap-2 text-[26px] font-black text-[color:var(--color-on-surface)]">
 {icon}
 <span>{value}</span>
 </div>
 <p className="mt-1 text-[11px] font-bold text-[color:var(--color-on-surface-variant)]">{label}</p>
 </div>
 );
}

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
 const [totalCount, setTotalCount] = useState(0);
 const [productsLoading, setProductsLoading] = useState(true);
 const [categoryCounts, setCategoryCounts] = useState<Array<[string, number]>>([]);
 const [storeStats, setStoreStats] = useState<{ cheapest: number | null; totalProducts: number }>({
 cheapest: null,
 totalProducts: 0,
 });
 const [reviews, setReviews] = useState<StoreReview[]>([]);
 const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
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

 // Cheapest in-stock price across the whole catalog — one tiny query.
 const { data: cheapestRow } = await supabase
 .from('product_stores')
 .select('current_price, product_url, products!inner(is_active, name_ar, name_en, category, brand)')
 .eq('store_id', storeData.id)
 .eq('products.is_active', true)
 .neq('availability', 'out_of_stock')
 .order('current_price', { ascending: true })
 .limit(25)
 .returns<CategoryCountRow[]>();

 const cheapestTechRow = cheapestRow?.find(isElectronicsStoreProduct);

 setStoreStats({
 cheapest: cheapestTechRow?.current_price ?? null,
 totalProducts: 0,
 });

 // Category counts for the chip row. Scan only the `category` column
 // across the whole catalog (tiny payload per row). One-time on mount.
 const CAT_BATCH = 1000;
 const CAT_MAX_BATCHES = 20;
 const counts = new Map<string, number>();
 for (let batch = 0; batch < CAT_MAX_BATCHES; batch++) {
 const from = batch * CAT_BATCH;
 const to = from + CAT_BATCH - 1;
 const { data: catRows } = await supabase
 .from('product_stores')
 .select('product_url, products!inner(id, name_ar, name_en, category, brand)')
 .eq('store_id', storeData.id)
 .eq('products.is_active', true)
 .range(from, to)
 .returns<CategoryCountRow[]>();
 if (!catRows || catRows.length === 0) break;
 catRows.forEach((row) => {
 if (!isElectronicsStoreProduct(row)) return;
 const category = row?.products?.category;
 if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
 });
 if (catRows.length < CAT_BATCH) break;
 }
 const electronicsTotal = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
 setStoreStats((prev) => ({ ...prev, totalProducts: electronicsTotal }));
 setCategoryCounts(Array.from(counts.entries()).sort((a, b) => b[1] - a[1]));

 // Fetch store coupons
 const { data: couponsData } = await supabase
 .from('coupons')
 .select('*')
 .eq('store_id', storeData.id)
 .eq('is_active', true)
 .or('expires_at.is.null,expires_at.gt.now()')
 .order('created_at', { ascending: false })
 .returns<StoreCoupon[]>();

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

 // Server-side paginated + filtered product fetch. Re-runs whenever the
 // active store, search query, filters, sort, or page change. This replaces
 // the previous "load everything, filter client-side" approach.
 useEffect(() => {
 if (!store) return;
 let cancelled = false;

 async function fetchPage() {
 if (!store) return;
 setProductsLoading(true);
 const supabase = getSupabaseBrowserClient();
 try {
 const from = (currentPage - 1) * STORE_PRODUCTS_PAGE_SIZE;
 const to = from + STORE_PRODUCTS_PAGE_SIZE - 1;

 let query = supabase
 .from('product_stores')
 .select(
 `
 id,
 current_price,
 original_price,
 availability,
 product_url,
 products!inner(
 id,
 name_ar,
 name_en,
 slug,
 category,
 brand,
 model,
 image_urls,
 is_active
 ),
 stores(
 id,
 slug,
 name_ar,
 name_en,
 logo_url
 )
 `,
 { count: 'exact' },
 )
 .eq('store_id', store.id)
 .eq('products.is_active', true);

 if (categoryFilter !== 'all') {
 query = query.eq('products.category', categoryFilter);
 }
 if (inStockOnly) {
 query = query.neq('availability', 'out_of_stock');
 }
 if (searchQuery) {
 // PostgREST-escape any * or commas in the query so the or() string
 // doesn't break. Spaces are fine inside ilike patterns.
 const safe = searchQuery.replace(/[*,()]/g, ' ');
 query = query.or(
 `name_en.ilike.*${safe}*,name_ar.ilike.*${safe}*,brand.ilike.*${safe}*,model.ilike.*${safe}*`,
 { referencedTable: 'products' },
 );
 }

 // Server-side sort. 'discount' is a proxy — PostgREST can't compare
 // two columns directly, so we surface rows with a non-null
 // original_price ordered by that value descending (highest-priced
 // original = biggest potential saving).
 if (sortBy === 'price_asc') {
 query = query.order('current_price', { ascending: true });
 } else if (sortBy === 'price_desc') {
 query = query.order('current_price', { ascending: false });
 } else if (sortBy === 'name') {
 query = query.order(locale === 'ar' ? 'name_ar' : 'name_en', {
 ascending: true,
 referencedTable: 'products',
 });
 } else if (sortBy === 'discount') {
 query = query
 .not('original_price', 'is', null)
 .order('original_price', { ascending: false });
 } else {
 // recommended: availability asc ('in_stock' < 'limited_stock' < 'out_of_stock'
 // alphabetically), then cheapest first as a tiebreaker.
 query = query
 .order('availability', { ascending: true })
 .order('current_price', { ascending: true });
 }

 const { data, count, error: pageError } = await query.range(from, to);
 if (pageError) throw pageError;
 if (cancelled) return;

 const records = (data ?? []) as unknown as ProductStoreResponse[];
 const mapped: StoreProduct[] = records
 .filter((r) => r.products && r.stores)
 .filter(isElectronicsStoreProduct)
 .map((record) => ({
 id: record.products!.id,
 name_ar: record.products!.name_ar,
 name_en: record.products!.name_en,
 slug: record.products!.slug,
 category: record.products!.category,
 brand: record.products!.brand,
 model: record.products!.model,
 image_urls: record.products!.image_urls,
 product_stores: [
 {
 id: record.id,
 current_price: record.current_price,
 original_price: record.original_price,
 availability: record.availability,
 product_url: record.product_url,
 affiliate_url: record.affiliate_url,
 stores: {
 id: record.stores!.id,
 slug: record.stores!.slug,
 name_ar: record.stores!.name_ar,
 name_en: record.stores!.name_en,
 logo_url: record.stores!.logo_url,
 },
 },
 ],
 }));

 setProducts(mapped);
 setTotalCount(count ?? 0);
 } catch (err) {
 if (cancelled) return;
 console.error('Error fetching store products page:', err);
 setProducts([]);
 setTotalCount(0);
 } finally {
 if (!cancelled) setProductsLoading(false);
 }
 }

 fetchPage();

 return () => {
 cancelled = true;
 };
 }, [store, searchQuery, categoryFilter, sortBy, inStockOnly, currentPage, locale]);

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

 // Server-provided total determines paging. The category chips come from a
 // dedicated one-time scan done at mount; they don't depend on the current
 // page so they don't collapse when the user filters or paginates.
 const categoriesInCatalog = categoryCounts;
 const totalPages = Math.max(1, Math.ceil(totalCount / STORE_PRODUCTS_PAGE_SIZE));

 // Compact page list with ellipses. Near the start we show 1 2 3 ... last;
 // near the end we show 1 ... last-2 last-1 last; in the middle we show
 // 1 ... current-1 current current+1 ... last. Keeps 3 consecutive numbers
 // at whichever end is in focus so users can skip ahead a page or two
 // without stepping through ellipses.
 const pageNumbers = useMemo<(number | 'ellipsis')[]>(() => {
 if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
 const pages: (number | 'ellipsis')[] = [1];
 let start: number;
 let end: number;
 if (currentPage <= 3) {
 start = 2;
 end = Math.min(totalPages - 1, 3);
 } else if (currentPage >= totalPages - 2) {
 start = Math.max(2, totalPages - 2);
 end = totalPages - 1;
 } else {
 start = Math.max(2, currentPage - 1);
 end = Math.min(totalPages - 1, currentPage + 1);
 }
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

 // Header stats — store-wide (not per-page). Fetched once at mount via a
 // tiny order-by-price limit-1 query. Dropped the per-filter avg badge
 // since computing it would require fetching every row in the filtered
 // set, which defeats the whole point of server-side pagination.
 const gridStats = storeStats;

 const handleReset = () => {
 setSearchInput('');
 setSearchQuery('');
 setCategoryFilter('all');
 setSortBy('recommended');
 setInStockOnly(false);
 setCurrentPage(1);
 };

 // Surprise me — random in-stock product across the whole store catalog.
 // Picks a random row offset in the same filter space as the grid so the
 // surprise respects the user's active category/search narrowing.
 const handleSurpriseMe = useCallback(async () => {
 if (!store || totalCount === 0) return;
 const supabase = getSupabaseBrowserClient();
 const offset = Math.floor(Math.random() * totalCount);
 let query = supabase
 .from('product_stores')
 .select('products!inner(slug, is_active)')
 .eq('store_id', store.id)
 .eq('products.is_active', true);
 if (categoryFilter !== 'all') query = query.eq('products.category', categoryFilter);
 // Always prefer in-stock for the surprise — picking out-of-stock would
 // be a dud landing.
 query = query.neq('availability', 'out_of_stock');
 const { data } = await query.range(offset, offset).returns<SurpriseProductRow[]>();
 const pickedSlug = data?.[0]?.products?.slug;
 if (pickedSlug) router.push(`/${locale}/products/${pickedSlug}`);
 }, [store, totalCount, categoryFilter, router, locale]);

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

 return (
 <div className="space-y-8">
 <PageBreadcrumbs items={[
   { label: t('nav.stores'), href: `/${locale}/stores` },
   { label: storeName },
 ]} />
 <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-primary-container)] p-5 dark:bg-[color:var(--color-surface-container-low)] md:p-8">
 <div
 aria-hidden
 className="absolute inset-0 opacity-80 dark:opacity-40"
 style={{
 background:
 'radial-gradient(circle at 14% 16%, rgba(85,178,149,0.34), transparent 28%), radial-gradient(circle at 88% 14%, rgba(226,187,78,0.20), transparent 24%)',
 }}
 />
 <div className="relative grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
 <div className="flex flex-col gap-5 md:flex-row md:items-center">
 <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.75rem] border border-[color:var(--color-outline-variant)] bg-white shadow-sm">
 <StoreLogo
 slug={store.slug}
 size="lg"
 alt={storeName}
 locale={locale as 'ar' | 'en'}
 className="!h-20 !w-20 object-contain"
 />
 </div>
 <div className="min-w-0">
 {store.is_featured && (
 <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-tertiary)] px-3 py-1.5 text-[11px] font-black text-[color:var(--color-on-tertiary)]">
 <Sparkles className="h-3.5 w-3.5" />
 {locale === 'ar' ? 'متجر مميز' : 'Featured store'}
 </span>
 )}
 <h1 className="text-[38px] font-black leading-tight text-[color:var(--color-on-surface)] md:text-[52px]">
 {storeName}
 </h1>
 <p className="mt-3 max-w-2xl whitespace-pre-line text-[15px] leading-7 text-[color:var(--color-on-surface-variant)]">
 {description || (locale === 'ar'
 ? 'استعرض المنتجات، الأسعار، العروض، والتقييمات الخاصة بهذا المتجر.'
 : 'Browse this store products, prices, offers, and customer ratings.')}
 </p>
 </div>
 </div>

 <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-container)]">
 <StoreHeroMetric
 value={store.average_rating !== null ? store.average_rating.toFixed(1) : '-'}
 label={locale === 'ar' ? 'التقييم' : 'Rating'}
 icon={<Star className="h-4 w-4 fill-[color:var(--color-tertiary)] text-[color:var(--color-tertiary)]" />}
 />
 <StoreHeroMetric
 value={storeStats.totalProducts.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
 label={locale === 'ar' ? 'منتج' : 'Products'}
 icon={<Package className="h-4 w-4 text-[color:var(--color-primary)]" />}
 />
 </div>
 </div>
 <div className="relative mt-6 flex flex-wrap gap-3">
 {store.website_url && (
 <Button asChild className="rounded-full px-5">
 <a href={store.website_url} target="_blank" rel="noopener noreferrer">
 <Globe className="w-4 h-4 me-2" />
 {t('store.visitWebsite')}
 </a>
 </Button>
 )}
 {gridStats.cheapest !== null && (
 <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-4 py-2 text-[13px] font-bold text-[color:var(--color-on-surface)] dark:bg-[color:var(--color-surface-container)]">
 <span className="text-[color:var(--color-on-surface-variant)]">{locale === 'ar' ? 'الأسعار من' : 'Prices from'}</span>
 <Price amount={gridStats.cheapest} className="text-[14px] font-black" symbolClassName="w-3.5 h-3.5" />
 </div>
 )}
 </div>
 </section>

 {/* Coupons */}
 {coupons.length > 0 && (
 <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-5 dark:bg-[color:var(--color-surface-container-low)]">
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
 <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-4 dark:bg-[color:var(--color-surface-container-low)]" ref={productsTopRef}>
 <div className="flex flex-col gap-4 mb-5">
 {/* Title row — left: heading + subtitle; right: result meta + Surprise me */}
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">
 {locale === 'ar' ? 'كتالوج المتجر' : 'Store catalog'}
 </p>
 <h2 className="mt-2 text-[28px] font-black text-on-surface">{t('store.products')}</h2>
 <p className="mt-1 text-on-surface-variant">{t('store.productsSubtitle')}</p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <Badge variant="outline" className="text-sm">
 {totalCount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
 {storeStats.totalProducts !== totalCount && (
 <>
 {' / '}
 {storeStats.totalProducts.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
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
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={handleSurpriseMe}
 disabled={totalCount === 0 || productsLoading}
 title={locale === 'ar' ? 'افتح منتجاً عشوائياً' : 'Open a random product'}
 className="gap-1"
 >
 <Sparkles className="h-4 w-4" />
 {locale === 'ar' ? 'فاجئني' : 'Surprise me'}
 </Button>
 </div>
 </div>

 {/* Search + sort + in-stock toggle */}
 <div className="rounded-[1.35rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-lowest)] p-3 dark:bg-[color:var(--color-surface)]">
 <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
 className="h-12 rounded-full ps-9 border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] font-semibold focus-visible:border-[var(--brand-green)] dark:bg-[color:var(--color-surface-container-low)]"
 />
 </div>
 <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
 <SelectTrigger className="h-12 w-full rounded-full md:w-[210px] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] font-semibold dark:bg-[color:var(--color-surface-container-low)]">
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
 className={`inline-flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ${
 inStockOnly
 ? 'border-[var(--brand-green)] bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]'
 : 'border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] text-on-surface hover:border-[var(--brand-green)] dark:bg-[color:var(--color-surface-container-low)]'
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
 className="h-12 rounded-full gap-1 border border-[color:var(--color-outline-variant)]"
 title={locale === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
 >
 <RotateCcw className="h-4 w-4" />
 {locale === 'ar' ? 'إعادة ضبط' : 'Reset'}
 </Button>
 )}
 </div>

 {/* Category chips — hidden when there's only one category (or none) in the catalog */}
 {categoriesInCatalog.length > 1 && (
 <div className="mt-3 flex flex-wrap gap-2">
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
 </div>

 {productsLoading ? (
	 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
 {Array.from({ length: STORE_PRODUCTS_PAGE_SIZE }).map((_, i) => (
 <div
 key={i}
 className="space-y-2 rounded-xl border border-[color:var(--color-outline-variant)] p-3"
 >
 <Skeleton className="aspect-square w-full rounded-lg" />
 <Skeleton className="h-4 w-3/4" />
 <Skeleton className="h-3 w-1/2" />
 </div>
 ))}
 </div>
 ) : products.length === 0 ? (
 <EmptyState
 icon={<Package className="h-12 w-12" />}
 title={
 storeStats.totalProducts === 0
 ? t('store.noProductsTitle')
 : locale === 'ar'
 ? 'لا توجد نتائج'
 : 'No matching products'
 }
 description={
 storeStats.totalProducts === 0
 ? t('store.noProductsDescription')
 : locale === 'ar'
 ? 'جرّب تعديل البحث أو إزالة الفلاتر.'
 : 'Try adjusting your search or clearing filters.'
 }
 action={
 storeStats.totalProducts > 0
 ? {
 label: locale === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset filters',
 onClick: handleReset,
 }
 : undefined
 }
 />
 ) : (
 <>
	 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
 {products.map((product) => (
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
 );
}
