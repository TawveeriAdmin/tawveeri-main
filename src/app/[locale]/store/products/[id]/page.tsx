'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { ProductForm } from '@/components/store/product-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getProductPerformanceChartData } from '@/lib/analytics/charts';

const BarChart = dynamic(
  () => import('@/components/analytics/bar-chart').then((m) => ({ default: m.BarChart })),
  { ssr: false }
);

export default function EditProductPage({
 params,
}: {
 params: Promise<{ locale: string; id: string }>;
}) {
 const [locale, setLocale] = useState<string>('en');
 const [productId, setProductId] = useState<string>('');
 const [storeId, setStoreId] = useState<string | null>(null);
 const [initialData, setInitialData] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [analyticsData, setAnalyticsData] = useState<any>(null);
 const { user } = useAuth();
 const router = useRouter();
 const isRTL = locale === 'ar';

 useEffect(() => {
 params.then((p) => {
 setLocale(p.locale);
 setProductId(p.id);
 });
 }, [params]);

 useEffect(() => {
 if (user && productId) {
 loadData();
 }
 }, [user, productId]);

 const loadData = async () => {
 if (!user?.id) return;

 try {
 setLoading(true);
 const supabase = getSupabaseBrowserClient();

 // Get store
 const { data: stores } = await supabase
 .from('stores')
 .select('id')
 .eq('created_by', user.id)
 .order('created_at', { ascending: false })
 .limit(1)
 .single();

 if (!stores) {
 throw new Error('Store not found');
 }

 setStoreId(stores.id);

 // Get product_store data
 const { data: productStore, error: psError } = await supabase
 .from('product_stores')
 .select(
 `
 *,
 products (
 id,
 name_ar,
 name_en,
 category,
 brand,
 model,
 sku,
 description_ar,
 description_en,
 image_urls
 )
 `
 )
 .eq('id', productId)
 .eq('store_id', stores.id)
 .single();

 if (psError) throw psError;
 if (!productStore) {
 throw new Error('Product not found');
 }

 // Format initial data
 const productStoreData = productStore as any;
 const product = productStoreData.products as any;
 setInitialData({
 id: productStoreData.id,
 productId: productStoreData.product_id,
 product: product,
 name_ar: product?.name_ar || '',
 name_en: product?.name_en || '',
 category: product?.category || '',
 brand: product?.brand || '',
 model: product?.model || '',
 sku: product?.sku || '',
 description_ar: product?.description_ar || '',
 description_en: product?.description_en || '',
 image_urls: product?.image_urls || [],
 current_price: productStoreData.current_price,
 original_price: productStoreData.original_price,
 stock_quantity: productStoreData.stock_quantity,
 availability: productStoreData.availability,
 product_url: productStoreData.product_url,
 affiliate_url: productStoreData.affiliate_url,
 delivery_time_days: productStoreData.delivery_time_days,
 delivery_cost: productStoreData.delivery_cost,
 is_free_delivery: productStoreData.is_free_delivery,
 is_deal: productStoreData.is_deal,
 deal_expires_at: productStoreData.deal_expires_at
 ? new Date(productStoreData.deal_expires_at).toISOString().slice(0, 16)
 : '',
 coupon_code: productStoreData.coupon_code || '',
 });

 // Load analytics
 const analyticsResult = await getProductPerformanceChartData(productStoreData.product_id, '30d');
 if (analyticsResult.data) {
 setAnalyticsData(analyticsResult.data);
 }
 } catch (error) {
 console.error('Error loading product:', error);
 } finally {
 setLoading(false);
 }
 };

 const handleSuccess = () => {
 router.push(`/${locale}/store/products`);
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-full">
 <p className="text-on-surface-variant">
 {isRTL ? 'جاري التحميل...' : 'Loading...'}
 </p>
 </div>
 );
 }

 if (!initialData || !storeId) {
 return (
 <div className="flex items-center justify-center h-full">
 <p className="text-on-surface-variant">
 {isRTL ? 'المنتج غير موجود' : 'Product not found'}
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {isRTL ? 'تعديل المنتج' : 'Edit Product'}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {isRTL ? 'تعديل معلومات المنتج' : 'Edit product information'}
 </p>
 </div>

 <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
 <div className="lg:col-span-2">
 <Card>
 <CardHeader>
 <CardTitle>{isRTL ? 'معلومات المنتج' : 'Product Information'}</CardTitle>
 </CardHeader>
 <CardContent>
 <ProductForm
 mode="edit"
 initialData={initialData}
 storeId={storeId}
 locale={locale}
 onSuccess={handleSuccess}
 />
 </CardContent>
 </Card>
 </div>

 <div>
 {analyticsData && (
 <Card>
 <CardHeader>
 <CardTitle>{isRTL ? 'إحصائيات المنتج' : 'Product Analytics'}</CardTitle>
 </CardHeader>
 <CardContent>
 <BarChart
 data={analyticsData.map((item: any) => ({
 name: new Date(item.date).toLocaleDateString(),
 value: item.value,
 }))}
 dataKey="value"
 labelKey="name"
 title={isRTL ? 'الأداء' : 'Performance'}
 />
 </CardContent>
 </Card>
 )}
 </div>
 </div>
 </div>
 );
}

