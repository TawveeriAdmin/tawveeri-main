import dynamic from 'next/dynamic';
import { getStoreOwnerStats, getStoreProductAnalytics, getStoreRevenue } from '@/lib/store/utils';
import { createClient } from '@/lib/auth/server';
import { getUserProfile } from '@/lib/auth/server';
import { StatsCard } from '@/components/admin/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RevenueChart = dynamic(
  () => import('@/components/analytics/revenue-chart').then((m) => ({ default: m.RevenueChart }))
);
const BarChart = dynamic(
  () => import('@/components/analytics/bar-chart').then((m) => ({ default: m.BarChart }))
);
import {
 Package,
 Eye,
 MousePointerClick,
 TrendingUp,
 DollarSign,
} from 'lucide-react';
import type { RevenueChartData } from '@/lib/analytics/charts';
import { getServerTranslations } from '@/lib/translations-server';

export default async function StoreAnalyticsPage({
 params,
}: {
 params: Promise<{ locale: string }>;
}) {
 const { locale } = await params;
 const t = await getServerTranslations(locale);
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
 {t('store.dashboard.noStoreAssociated')}
 </p>
 </div>
 );
 }

 // Fetch analytics data
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

 // Top products for bar chart
 const topProducts = productAnalytics
 .sort((a, b) => b.views - a.views)
 .slice(0, 10)
 .map((product) => ({
 name: isRTL ? product.product_name_ar : product.product_name_en,
 value: product.views,
 }));

 // Calculate click-through rate
 const clickThroughRate =
 stats && stats.totalViews > 0
 ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1)
 : '0.0';

 // Calculate conversion rate
 const conversionRate =
 stats && stats.totalClicks > 0
 ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)
 : '0.0';

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {t('store.dashboard.analytics')}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {t('store.dashboard.analyticsSubtitle')}
 </p>
 </div>

 {/* Overview Stats */}
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
 <StatsCard
 title={t('store.dashboard.totalProducts')}
 value={stats?.totalProducts || 0}
 icon={<Package className="h-6 w-6" />}
 />
 <StatsCard
 title={t('store.dashboard.totalViews')}
 value={stats?.totalViews || 0}
 icon={<Eye className="h-6 w-6" />}
 />
 <StatsCard
 title={t('store.dashboard.totalClicks')}
 value={stats?.totalClicks || 0}
 icon={<MousePointerClick className="h-6 w-6" />}
 />
 <StatsCard
 title={t('store.dashboard.clickRate')}
 value={`${clickThroughRate}%`}
 icon={<MousePointerClick className="h-6 w-6" />}
 />
 <StatsCard
 title={t('store.dashboard.conversionRate')}
 value={`${conversionRate}%`}
 icon={<TrendingUp className="h-6 w-6" />}
 />
 </div>

 {/* Revenue Chart */}
 <RevenueChart data={revenueChartData} period="30d" />

 {/* Product Performance */}
 {topProducts.length > 0 && (
 <BarChart
 data={topProducts}
 dataKey="value"
 labelKey="name"
 title={t('store.dashboard.topProductsByViews')}
 />
 )}

 {/* Additional Stats */}
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg">
 {t('store.dashboard.totalRevenue')}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-md">
 ${((stats?.totalRevenue || 0) / 1000).toFixed(1)}K
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg">
 {t('store.dashboard.conversions')}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-md">{stats?.totalConversions || 0}</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-label-lg">
 {t('store.dashboard.averageRating')}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-headline-md">{(stats?.averageRating || 0).toFixed(1)}</p>
 </CardContent>
 </Card>
 </div>
 </div>
 );
}

