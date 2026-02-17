import { getStoreOwnerStats, getStoreProductAnalytics } from '@/lib/store/utils';
import { getStoreRevenue } from '@/lib/store/utils';
import { createClient } from '@/lib/auth/server';
import { getUserProfile } from '@/lib/auth/server';
import { StatsCard } from '@/components/admin/stats-card';
import { RevenueChart } from '@/components/analytics/revenue-chart';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
 Package,
 Eye,
 MousePointerClick,
 TrendingUp,
 DollarSign,
 Star,
} from 'lucide-react';
import { format } from 'date-fns';
import type { RevenueChartData } from '@/lib/analytics/charts';

export default async function StoreDashboardPage({
 params,
}: {
 params: Promise<{ locale: string }>;
}) {
 const { locale } = await params;
 const isRTL = locale === 'ar';
 const supabase = await createClient();

 // Get user profile and store
 const userProfile = await getUserProfile();
 if (!userProfile) {
 return <div>Not authorized</div>;
 }

 const { data: stores } = await supabase
 .from('stores')
 .select('*')
 .eq('created_by', userProfile.id)
 .order('created_at', { ascending: false })
 .limit(1);

 const store = stores?.[0];
 if (!store) {
 return (
 <div className="flex items-center justify-center h-full">
 <p className="text-on-surface-variant">
 {isRTL ? 'لا يوجد متجر مرتبط بحسابك' : 'No store associated with your account'}
 </p>
 </div>
 );
 }

 // Fetch store stats
 const [statsResult, productAnalyticsResult] = await Promise.all([
 getStoreOwnerStats(store.id, userProfile.id),
 getStoreProductAnalytics(store.id),
 ]);

 const stats = statsResult.data;
 const productAnalytics = productAnalyticsResult.data || [];

 // Get revenue data for last 30 days
 const endDate = new Date();
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - 30);

 const revenueResult = await getStoreRevenue(store.id, startDate, endDate);
 const revenueData = revenueResult.data || [];

 // Format revenue chart data
 const revenueChartData: RevenueChartData[] = revenueData.map((item) => ({
 date: item.date,
 value: item.revenue,
 revenue: item.revenue,
 transactions: item.transactions,
 }));

 // Get recent reviews
 const { data: recentReviews } = await supabase
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
 .eq('store_id', store.id)
 .order('created_at', { ascending: false })
 .limit(5);

 // Top performing products (by views)
 const topProducts = productAnalytics
 .sort((a, b) => b.views - a.views)
 .slice(0, 10);

 // Calculate click-through rate
 const clickThroughRate =
 stats && stats.totalViews > 0
 ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1)
 : '0.0';

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
 render: (row) => format(new Date(row.created_at), 'MMM dd, yyyy'),
 },
 ];

 const topProductsColumns: Column<any>[] = [
 {
 key: 'product_name',
 label: isRTL ? 'المنتج' : 'Product',
 render: (row) => (isRTL ? row.product_name_ar : row.product_name_en),
 },
 {
 key: 'views',
 label: isRTL ? 'المشاهدات' : 'Views',
 render: (row) => row.views.toLocaleString(),
 },
 {
 key: 'clicks',
 label: isRTL ? 'النقرات' : 'Clicks',
 render: (row) => row.clicks.toLocaleString(),
 },
 {
 key: 'conversions',
 label: isRTL ? 'التحويلات' : 'Conversions',
 render: (row) => row.conversions.toLocaleString(),
 },
 {
 key: 'revenue',
 label: isRTL ? 'الإيرادات' : 'Revenue',
 render: (row) => `$${row.revenue.toLocaleString()}`,
 },
 ];

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {isRTL ? 'لوحة التحكم' : 'Dashboard'}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {isRTL ? 'نظرة عامة على متجرك' : 'Overview of your store'}
 </p>
 </div>

 {/* Stats Cards */}
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
 <StatsCard
 title={isRTL ? 'المنتجات' : 'Total Products'}
 value={stats?.totalProducts || 0}
 icon={<Package className="h-6 w-6" />}
 />
 <StatsCard
 title={isRTL ? 'المشاهدات' : 'Total Views'}
 value={stats?.totalViews || 0}
 icon={<Eye className="h-6 w-6" />}
 />
 <StatsCard
 title={isRTL ? 'النقرات' : 'Total Clicks'}
 value={stats?.totalClicks || 0}
 icon={<MousePointerClick className="h-6 w-6" />}
 />
 <StatsCard
 title={isRTL ? 'التحويلات' : 'Conversions'}
 value={stats?.totalConversions || 0}
 icon={<TrendingUp className="h-6 w-6" />}
 />
 <StatsCard
 title={isRTL ? 'الإيرادات' : 'Total Revenue'}
 value={`$${((stats?.totalRevenue || 0) / 1000).toFixed(1)}K`}
 icon={<DollarSign className="h-6 w-6" />}
 />
 <StatsCard
 title={isRTL ? 'معدل النقر' : 'Click Rate'}
 value={`${clickThroughRate}%`}
 icon={<MousePointerClick className="h-6 w-6" />}
 />
 </div>

 {/* Revenue Chart */}
 <RevenueChart data={revenueChartData} period="30d" />

 {/* Recent Reviews and Top Products */}
 <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
 {/* Recent Reviews */}
 <Card>
 <CardHeader>
 <CardTitle>{isRTL ? 'التقييمات الأخيرة' : 'Recent Reviews'}</CardTitle>
 </CardHeader>
 <CardContent>
 {recentReviews && recentReviews.length > 0 ? (
 <DataTable data={recentReviews} columns={reviewsColumns} />
 ) : (
 <p className="text-center py-8 text-on-surface-variant">
 {isRTL ? 'لا توجد تقييمات' : 'No reviews yet'}
 </p>
 )}
 </CardContent>
 </Card>

 {/* Top Products */}
 <Card>
 <CardHeader>
 <CardTitle>{isRTL ? 'أفضل المنتجات' : 'Top Products'}</CardTitle>
 </CardHeader>
 <CardContent>
 {topProducts.length > 0 ? (
 <DataTable data={topProducts} columns={topProductsColumns} />
 ) : (
 <p className="text-center py-8 text-on-surface-variant">
 {isRTL ? 'لا توجد منتجات' : 'No products yet'}
 </p>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 );
}

