'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { useMultiStoreCart } from '@/lib/cart/cart-context';
import { getStoreTotals } from '@/lib/cart/cart-utils';
import { CartSummary } from '@/components/cart/cart-summary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Price } from '@/components/ui/price';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, AlertCircle, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getSupabaseBrowserClient } from '@/lib/database';
import { generateAffiliateUrl } from '@/lib/transactions/tracking';
import Image from 'next/image';

export default function CheckoutPage() {
 const params = useParams();
 const searchParams = useSearchParams();
 const router = useRouter();
 const locale = (params?.locale as string) || 'ar';
 const t = useTranslations();
 const { user } = useAuth();
 const { cart } = useMultiStoreCart();
 const { toast } = useToast();
 const isRTL = locale === 'ar';
 const supabase = getSupabaseBrowserClient();

 const storeIdParam = searchParams.get('store');
 const [selectedStoreId, setSelectedStoreId] = useState<string | null>(storeIdParam);
 const [storeDetails, setStoreDetails] = useState<Record<string, any>>({});
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 // Fetch store details for all stores in cart
 const fetchStoreDetails = async () => {
 const storeIds = Object.keys(cart);
 if (storeIds.length === 0) return;

 try {
 const { data: stores } = await supabase
 .from('stores')
 .select('id, name_ar, name_en, logo_url')
 .in('id', storeIds);

 if (stores) {
 const details: Record<string, any> = {};
 stores.forEach((store) => {
 details[store.id] = store;
 });
 setStoreDetails(details);
 }
 } catch (error) {
 console.error('Error fetching store details:', error);
 }
 };

 fetchStoreDetails();
 }, [cart]);

 const stores = Object.values(cart);

 const handleProceedToStore = async (storeId: string) => {
 const store = cart[storeId];
 if (!store || store.items.length === 0) return;

 setLoading(true);

 try {
 // Get product store IDs for affiliate tracking
 const productIds = store.items.map((item) => item.productId);
 const { data: productStores } = await supabase
 .from('product_stores')
 .select('id, product_id, product_url')
 .eq('store_id', storeId)
 .in('product_id', productIds);

 if (!productStores || productStores.length === 0) {
 // Fallback to first item's product page if no product_stores found
 const firstItem = store.items[0];
 router.push(`/${locale}/products/${firstItem.productSlug || firstItem.productId}`);
 return;
 }

 // Generate tracking URLs for all items
 const trackingUrls = await Promise.all(
 store.items.map(async (item) => {
 const productStore = productStores.find((ps) => ps.product_id === item.productId);
 if (!productStore) return null;

 const result = await generateAffiliateUrl(productStore.id, user?.id);
 return result.data;
 })
 );

 // For now, redirect to the first item's tracking URL
 // In future, this could redirect to a combined checkout or store's cart
 const firstUrl = trackingUrls.find((url) => url) || productStores[0]?.affiliate_url || productStores[0]?.product_url;
 
 if (firstUrl) {
 // Track checkout initiation
 if (user) {
 // Could track this in analytics/transactions
 }

 window.open(firstUrl, '_blank', 'noopener,noreferrer');
 
 toast({
 title: t('common.redirected'),
 description: t('checkout.redirectedDesc'),
 });
 }
 } catch (error) {
 console.error('Error proceeding to checkout:', error);
 toast({
 title: t('common.error'),
 description: t('checkout.redirectFailed'),
 variant: 'destructive',
 });
 } finally {
 setLoading(false);
 }
 };

 if (stores.length === 0) {
 return (
 <div>
 <div className="container mx-auto px-4 py-8">
 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>
 {t('checkout.cartEmpty')}
 </AlertDescription>
 </Alert>
 <Button onClick={() => router.push(`/${locale}/cart`)} className="mt-4">
 <ArrowLeft className="h-4 w-4 me-2" />
 {t('checkout.backToCart')}
 </Button>
 </div>
 </div>
 );
 }

 return (
 <div>
 <div className="container mx-auto px-4 py-8 max-w-7xl">
 <div className="flex flex-col lg:flex-row gap-8">
 {/* Checkout Items */}
 <div className="flex-1 space-y-6">
 <div>
 <h1 className="text-headline-lg text-on-surface mb-2">
 {t('checkout.reviewOrder')}
 </h1>
 <p className="text-on-surface-variant">
 {t('checkout.reviewOrderDesc')}
 </p>
 </div>

 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>
 {t('checkout.redirectInfo')}
 </AlertDescription>
 </Alert>

 {stores.map((store) => {
 const totals = getStoreTotals(cart, store.storeId);
 const storeDetail = storeDetails[store.storeId];

 return (
 <Card key={store.storeId}>
 <CardHeader>
 <div className="flex items-center gap-3">
 {storeDetail?.logo_url && (
 <div className="relative w-12 h-12 rounded-lg overflow-hidden">
 <Image
 src={storeDetail.logo_url}
 alt={store.storeName}
 fill
 className="object-contain"
 />
 </div>
 )}
 <CardTitle>{store.storeName}</CardTitle>
 </div>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {/* Order Items Summary */}
 <div className="space-y-2">
 {store.items.map((item) => (
 <div key={item.productId} className="flex items-center gap-3 text-sm">
 <div className="relative w-12 h-12 rounded overflow-hidden bg-surface-container-highest flex-shrink-0">
 {item.imageUrl ? (
 <Image
 src={item.imageUrl}
 alt={item.productName}
 fill
 className="object-cover"
 />
 ) : (
 <ShoppingBag className="h-6 w-6 m-auto text-outline" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-medium truncate">{item.productName}</p>
 <p className="text-on-surface-variant">
 {t('common.quantity')}: {item.quantity} ×{' '}
 <Price amount={item.price} className="inline" />
 </p>
 </div>
 <Price
 amount={item.price * item.quantity}
 className="font-semibold"
 />
 </div>
 ))}
 </div>

 {/* Totals */}
 <div className="border-t pt-4 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-on-surface-variant">
 {t('checkout.subtotal')}
 </span>
 <Price amount={totals.subtotal} className="font-semibold" />
 </div>
 {totals.deliveryCost > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-on-surface-variant">
 {t('checkout.delivery')}
 </span>
 <Price amount={totals.deliveryCost} className="font-semibold" />
 </div>
 )}
 <div className="flex justify-between text-base pt-2 border-t">
 <span className="font-bold">
 {t('checkout.total')}
 </span>
 <Price amount={totals.total} className="font-bold text-lg" />
 </div>
 </div>

 {/* Checkout Button */}
 <Button
 onClick={() => handleProceedToStore(store.storeId)}
 disabled={loading}
 className="w-full"
 size="lg"
 >
 {t('checkout.proceedToStore', { storeName: store.storeName })}
 <ExternalLink className="h-5 w-5 ms-2" />
 </Button>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>

 {/* Summary Sidebar */}
 <div className="lg:w-80 flex-shrink-0">
 <div className="lg:sticky lg:top-4">
 <CartSummary locale={locale} />
 <Button
 variant="outline"
 onClick={() => router.push(`/${locale}/cart`)}
 className="w-full mt-4"
 >
 <ArrowLeft className="h-4 w-4 me-2" />
 {t('checkout.backToCart')}
 </Button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}

