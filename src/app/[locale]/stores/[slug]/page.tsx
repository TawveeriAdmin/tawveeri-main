'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
 Breadcrumb,
 BreadcrumbItem,
 BreadcrumbLink,
 BreadcrumbList,
 BreadcrumbPage,
 BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ProductCard } from '@/components/products/product-card';
import { StoreReviewCard, type StoreReview } from '@/components/stores/store-review-card';
import { StoreReviewForm } from '@/components/stores/store-review-form';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useTranslations } from '@/lib/simple-intl-provider';
import {
 AlertCircle,
 Award,
 Globe,
 Mail,
 MapPin,
 Package,
 Phone,
 ShieldCheck,
 Star,
 Store,
} from 'lucide-react';
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
 stores: {
 id: string;
 name_ar: string;
 name_en: string;
 logo_url: string | null;
 };
 }>;
}

export default function StoreDetailPage() {
 const supabase = getSupabaseBrowserClient();
 const params = useParams();
 const router = useRouter();
 const locale = (params?.locale as string) || 'ar';
 const slug = params?.slug as string;
 const t = useTranslations();

 const [store, setStore] = useState<StoreDetails | null>(null);
 const [products, setProducts] = useState<StoreProduct[]>([]);
 const [reviews, setReviews] = useState<StoreReview[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

 type StoreDetailsResponse = StoreDetails & { store_reviews: StoreReview[] };
 type ProductStoreResponse = ProductStoreEntry;

 useEffect(() => {
 async function fetchStoreDetails() {
 if (!slug) return;

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

 const { data: productsData, error: productsError } = await supabase
 .from('product_stores')
 .select(
 `
 id,
 current_price,
 original_price,
 availability,
 products(
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
 name_ar,
 name_en,
 logo_url
 )
 `
 )
 .eq('store_id', storeData.id)
 .eq('products.is_active', true)
 .limit(24);

 if (productsError) throw productsError;

 const groupedProducts = new Map<string, StoreProduct>();

 (productsData as ProductStoreResponse[] | null)?.forEach((record) => {
 if (!record.products || !record.stores) return;

 const existing = groupedProducts.get(record.products.id);
 const productStore = {
 id: record.id,
 current_price: record.current_price,
 original_price: record.original_price,
 availability: record.availability,
 stores: {
 id: record.stores.id,
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

 if (loading) {
 return (
 <div className="min-h-screen bg-surface-container transition-colors duration-300">
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
 <div className="min-h-screen bg-surface-container transition-colors duration-300">
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
 <div className="min-h-screen bg-surface-container transition-colors duration-300">
 <div className="container mx-auto px-4 py-8 max-w-6xl">
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
 <Link href={`/${locale}/stores`}>{t('stores.title')}</Link>
 </BreadcrumbLink>
 </BreadcrumbItem>
 <BreadcrumbSeparator />
 <BreadcrumbItem>
 <BreadcrumbPage>{storeName}</BreadcrumbPage>
 </BreadcrumbItem>
 </BreadcrumbList>
 </Breadcrumb>

 {/* Store Header */}
 <Card className="mb-8">
 <CardContent className="p-6">
 <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
 <div className="flex items-center gap-4">
 <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-surface-container-highest border-2 border-outline-variant">
 <img
 src={
 store.logo_url ||
 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5TdG9yZTwvdGV4dD48L3N2Zz4='
 }
 alt={storeName}
 className="w-full h-full object-contain p-3"
 />
 </div>
 <div>
 <div className="flex flex-wrap items-center gap-2 mb-2">
 <Badge variant="outline" className="text-sm">
 {locale === 'ar' ? 'المتجر' : 'Store'}
 </Badge>
 {store.is_featured && (
 <Badge variant="warning" className="text-body-sm">
 {locale === 'ar' ? 'مميز' : 'Featured'}
 </Badge>
 )}
 {store.is_premium && (
 <Badge variant="success" className="text-body-sm">
 {locale === 'ar' ? 'ممتاز' : 'Premium'}
 </Badge>
 )}
 </div>
 <h1 className="text-headline-lg text-on-surface mb-2">{storeName}</h1>
 {description && (
 <p className="text-on-surface-variant max-w-2xl whitespace-pre-line">{description}</p>
 )}
 </div>
 </div>

 <div className="flex flex-col gap-3 self-stretch lg:items-end">
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
 <Button asChild className="w-full lg:w-auto">
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

 {/* Quick Stats */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg text-on-surface-variant flex items-center gap-2">
 <Star className="w-4 h-4" /> {t('store.averageRating')}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-lg text-on-surface">
 {store.average_rating !== null ? store.average_rating.toFixed(1) : '--'}
 </p>
 <p className="text-sm text-on-surface-variant">
 {store.total_reviews || 0} {t('store.totalReviews')}
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg text-on-surface-variant flex items-center gap-2">
 <Package className="w-4 h-4" /> {t('store.totalProducts')}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-lg text-on-surface">{store.total_products || 0}</p>
 <p className="text-sm text-on-surface-variant">{t('store.activeProducts')}</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg text-on-surface-variant flex items-center gap-2">
 <Award className="w-4 h-4" /> {t('store.statusTitle')}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-title-lg text-on-surface">
 {store.is_premium ? t('store.premiumStore') : t('store.standardStore')}
 </p>
 <p className="text-sm text-on-surface-variant">{t('store.statusDescription')}</p>
 </CardContent>
 </Card>
 </div>

 {/* Policies and Contact */}
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

 {/* Products */}
 <section className="mb-12">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-headline-md text-on-surface">{t('store.products')}</h2>
 <p className="text-on-surface-variant">{t('store.productsSubtitle')}</p>
 </div>
 <Badge variant="outline" className="text-sm">
 {products.length} {t('store.productsCountLabel')}
 </Badge>
 </div>

 {products.length === 0 ? (
 <EmptyState
 icon={<Package className="h-12 w-12" />}
 title={t('store.noProductsTitle')}
 description={t('store.noProductsDescription')}
 />
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
 {products.map((product) => (
 <ProductCard key={product.id} product={product} locale={locale} showActions={false} />
 ))}
 </div>
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


