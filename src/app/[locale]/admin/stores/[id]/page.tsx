import { notFound } from 'next/navigation';
import { createClient } from '@/lib/auth/server';
import { getStoreAnalytics } from '@/lib/admin/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/admin/data-table';
import { formatDate, formatNumber } from '@/lib/formatting';
import Image from 'next/image';

export default async function AdminStoreDetailPage({
 params,
}: {
 params: Promise<{ locale: string; id: string }>;
}) {
 const { locale, id } = await params;
 const isRTL = locale === 'ar';
 const supabase = await createClient();

 // Fetch store data
 const { data: store, error: storeError } = await supabase
 .from('stores')
 .select('*')
 .eq('id', id)
 .single();

 if (storeError || !store) {
 notFound();
 }

 // Fetch store products
 const { data: storeProducts } = await supabase
 .from('product_stores')
 .select(
 `
 *,
 products (
 id,
 name_ar,
 name_en,
 image_urls
 )
 `
 )
 .eq('store_id', id)
 .limit(20);

 // Fetch store reviews
 const { data: storeReviews } = await supabase
 .from('store_reviews')
 .select(
 `
 *,
 users (
 id,
 full_name,
 avatar_url
 )
 `
 )
 .eq('store_id', id)
 .order('created_at', { ascending: false })
 .limit(10);

 // Fetch store analytics
 const analyticsResult = await getStoreAnalytics(id);
 const analytics = analyticsResult.data;

 // Fetch store transactions
 const { data: productStores } = await supabase
 .from('product_stores')
 .select('id')
 .eq('store_id', id);

 const productStoreIds = productStores?.map((ps) => ps.id) || [];
 const { data: transactions } =
 productStoreIds.length > 0
 ? await supabase
 .from('transactions')
 .select('*')
 .in('product_store_id', productStoreIds)
 .order('created_at', { ascending: false })
 .limit(20)
 : { data: [] };

 const storeName = isRTL ? store.name_ar : store.name_en;

 const productsColumns: Column<any>[] = [
 {
 key: 'product',
 label: isRTL ? 'المنتج' : 'Product',
 render: (row) => {
 const product = row.products as any;
 return product ? (isRTL ? product.name_ar : product.name_en) : '-';
 },
 },
 {
 key: 'current_price',
 label: isRTL ? 'السعر' : 'Price',
 render: (row) => `${Math.round(row.current_price).toLocaleString()}`,
 },
 {
 key: 'availability',
 label: isRTL ? 'التوفر' : 'Availability',
 render: (row) => (
 <Badge variant={row.availability === 'in_stock' ? 'default' : 'secondary'}>
 {row.availability}
 </Badge>
 ),
 },
 ];

 const reviewsColumns: Column<any>[] = [
 {
 key: 'user',
 label: isRTL ? 'المستخدم' : 'User',
 render: (row) => {
 const user = row.users as any;
 return user?.full_name || '-';
 },
 },
 {
 key: 'rating',
 label: isRTL ? 'التقييم' : 'Rating',
 render: (row) => `${row.rating}/5`,
 },
 {
 key: 'review_text',
 label: isRTL ? 'التعليق' : 'Review',
 render: (row) => row.review_text || '-',
 },
 {
 key: 'created_at',
 label: isRTL ? 'التاريخ' : 'Date',
 render: (row) => formatDate(row.created_at, locale),
 },
 ];

 const transactionsColumns: Column<any>[] = [
 {
 key: 'amount',
 label: isRTL ? 'المبلغ' : 'Amount',
 render: (row) => `$${row.amount.toLocaleString()}`,
 },
 {
 key: 'status',
 label: isRTL ? 'الحالة' : 'Status',
 render: (row) => (
 <Badge variant={row.status === 'completed' ? 'default' : 'secondary'}>
 {row.status}
 </Badge>
 ),
 },
 {
 key: 'commission_amount',
 label: isRTL ? 'العمولة' : 'Commission',
 render: (row) => `$${(row.commission_amount || 0).toLocaleString()}`,
 },
 {
 key: 'created_at',
 label: isRTL ? 'التاريخ' : 'Date',
 render: (row) => formatDate(row.created_at, locale, 'datetime'),
 },
 ];

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div>
 <h1 className="text-headline-lg text-on-surface">{storeName}</h1>
 </div>

 {/* Store Info Card */}
 <Card>
 <CardHeader>
 <div className="flex items-start gap-6">
 {store.logo_url && (
 <div className="relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden border border-outline-variant">
 <Image
 src={store.logo_url}
 alt={storeName}
 fill
 className="object-cover"
 />
 </div>
 )}
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
 {store.status}
 </Badge>
 {store.is_premium && (
 <Badge variant="outline">{isRTL ? 'مميز' : 'Premium'}</Badge>
 )}
 {store.is_featured && (
 <Badge variant="outline">{isRTL ? 'مميز' : 'Featured'}</Badge>
 )}
 </div>
 <p className="text-on-surface-variant mt-2">
 {isRTL ? store.description_ar : store.description_en}
 </p>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
 <div>
 <p className="text-label-lg text-on-surface-variant">
 {isRTL ? 'المنتجات' : 'Products'}
 </p>
 <p className="mt-1 text-headline-md">{store.total_products || 0}</p>
 </div>
 <div>
 <p className="text-label-lg text-on-surface-variant">
 {isRTL ? 'التقييم' : 'Rating'}
 </p>
 <p className="mt-1 text-headline-md">
 {store.average_rating ? store.average_rating.toFixed(1) : '0.0'}
 </p>
 </div>
 <div>
 <p className="text-label-lg text-on-surface-variant">
 {isRTL ? 'التقييمات' : 'Reviews'}
 </p>
 <p className="mt-1 text-headline-md">{store.total_reviews || 0}</p>
 </div>
 <div>
 <p className="text-label-lg text-on-surface-variant">
 {isRTL ? 'معدل العمولة' : 'Commission Rate'}
 </p>
 <p className="mt-1 text-headline-md">{store.commission_rate || 0}%</p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Analytics */}
 {analytics && (
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg">
 {isRTL ? 'إجمالي النقرات' : 'Total Clicks'}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-md">{formatNumber(analytics.total_clicks, locale)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg">
 {isRTL ? 'التحويلات' : 'Conversions'}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-md">{formatNumber(analytics.total_conversions, locale)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg">
 {isRTL ? 'الإيرادات' : 'Revenue'}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-md">
 ${(analytics.total_revenue / 1000).toFixed(1)}K
 </p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg">
 {isRTL ? 'متوسط العمولة' : 'Avg Commission'}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-md">
 ${analytics.average_commission.toFixed(2)}
 </p>
 </CardContent>
 </Card>
 </div>
 )}

 {/* Store Data Tabs */}
 <Tabs defaultValue="products" className="space-y-4">
 <TabsList>
 <TabsTrigger value="products">{isRTL ? 'المنتجات' : 'Products'}</TabsTrigger>
 <TabsTrigger value="reviews">{isRTL ? 'التقييمات' : 'Reviews'}</TabsTrigger>
 <TabsTrigger value="transactions">{isRTL ? 'المعاملات' : 'Transactions'}</TabsTrigger>
 </TabsList>

 <TabsContent value="products">
 <DataTable data={storeProducts || []} columns={productsColumns} />
 </TabsContent>

 <TabsContent value="reviews">
 <DataTable data={storeReviews || []} columns={reviewsColumns} />
 </TabsContent>

 <TabsContent value="transactions">
 <DataTable data={transactions || []} columns={transactionsColumns} />
 </TabsContent>
 </Tabs>
 </div>
 );
}

