'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { ProductForm } from '@/components/store/product-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewProductPage(
 props: {
  params: Promise<{ locale: string }>;
 }
) {
 const params = use(props.params);
 const [locale, setLocale] = useState<string>('en');
 const [storeId, setStoreId] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const { user } = useAuth();
 const router = useRouter();
 const isRTL = locale === 'ar';

 useEffect(() => {
 setLocale(params.locale);
 }, [params]);

 useEffect(() => {
 loadStore();
 }, [user]);

 const loadStore = async () => {
 if (!user?.id) return;

 try {
 const supabase = getSupabaseBrowserClient();
 const { data: stores, error } = await supabase
 .from('stores')
 .select('id')
 .eq('created_by', user.id)
 .order('created_at', { ascending: false })
 .limit(1)
 .single();

 if (error) throw error;
 if (stores) {
 setStoreId(stores.id);
 }
 } catch (error) {
 console.error('Error loading store:', error);
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

 if (!storeId) {
 return (
 <div className="flex items-center justify-center h-full">
 <p className="text-on-surface-variant">
 {isRTL ? 'لا يوجد متجر مرتبط بحسابك' : 'No store associated with your account'}
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {isRTL ? 'إضافة منتج جديد' : 'Add New Product'}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {isRTL ? 'أضف منتجًا جديدًا إلى متجرك' : 'Add a new product to your store'}
 </p>
 </div>

 <Card>
 <CardHeader>
 <CardTitle>{isRTL ? 'معلومات المنتج' : 'Product Information'}</CardTitle>
 </CardHeader>
 <CardContent>
 <ProductForm
 mode="create"
 storeId={storeId}
 locale={locale}
 onSuccess={handleSuccess}
 />
 </CardContent>
 </Card>
 </div>
 );
}

