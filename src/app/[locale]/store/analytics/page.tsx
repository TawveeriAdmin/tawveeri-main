import { getStoreOwnerStats, getStoreProductAnalytics, getStoreRevenue } from '@/lib/store/utils';
import { createClient } from '@/lib/auth/server';
import { getUserProfile } from '@/lib/auth/server';
import { StatsCard } from '@/components/admin/stats-card';
import { RevenueChart } from '@/components/analytics/revenue-chart';
import { BarChart } from '@/components/analytics/bar-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  Eye,
  MousePointerClick,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import type { RevenueChartData } from '@/lib/analytics/charts';

export default async function StoreAnalyticsPage({
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
        <p className="text-gray-600 dark:text-gray-400">
          {isRTL ? 'لا يوجد متجر مرتبط بحسابك' : 'No store associated with your account'}
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isRTL ? 'التحليلات' : 'Analytics'}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {isRTL ? 'إحصائيات وأداء متجرك' : 'Your store statistics and performance'}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          title={isRTL ? 'معدل النقر' : 'Click Rate'}
          value={`${clickThroughRate}%`}
          icon={<MousePointerClick className="h-6 w-6" />}
        />
        <StatsCard
          title={isRTL ? 'معدل التحويل' : 'Conversion Rate'}
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
          title={isRTL ? 'أفضل المنتجات حسب المشاهدات' : 'Top Products by Views'}
        />
      )}

      {/* Additional Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${((stats?.totalRevenue || 0) / 1000).toFixed(1)}K
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {isRTL ? 'التحويلات' : 'Conversions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalConversions || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {isRTL ? 'متوسط التقييم' : 'Average Rating'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{(stats?.averageRating || 0).toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

