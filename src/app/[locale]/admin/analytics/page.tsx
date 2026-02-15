import { getAdminStats } from '@/lib/admin/utils';
import {
  getRevenueChartData,
  getUserGrowthChartData,
  type RevenueChartData,
} from '@/lib/analytics/charts';
import { RevenueChart } from '@/components/analytics/revenue-chart';
import { UserGrowthChart } from '@/components/analytics/user-growth-chart';
import { BarChart } from '@/components/analytics/bar-chart';
import { PieChart } from '@/components/analytics/pie-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/auth/server';
import { getServerTranslations } from '@/lib/translations-server';

export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getServerTranslations(locale);
  const isRTL = locale === 'ar';
  const supabase = await createClient();

  // Fetch analytics data
  const [statsResult, userGrowthResult] = await Promise.all([
    getAdminStats(),
    getUserGrowthChartData('30d'),
  ]);

  const stats = statsResult.data;
  const userGrowthData = userGrowthResult.data || [];

  // Get category distribution
  const { data: categoryData } = await supabase
    .from('products')
    .select('category');

  const categoryCounts: Record<string, number> = {};
  categoryData?.forEach((product) => {
    categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
  });

  const categoryChartData = Object.entries(categoryCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Get role distribution
  const { data: roleData } = await supabase.from('users').select('role');

  const roleCounts: Record<string, number> = {};
  roleData?.forEach((user) => {
    roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
  });

  const roleChartData = Object.entries(roleCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Get store status distribution
  const { data: storeData } = await supabase.from('stores').select('status');

  const statusCounts: Record<string, number> = {};
  storeData?.forEach((store) => {
    statusCounts[store.status] = (statusCounts[store.status] || 0) + 1;
  });

  const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('admin.analytics.title')}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('admin.analytics.subtitle')}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.analytics.totalUsers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.analytics.totalProducts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalProducts || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.analytics.totalStores')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalStores || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.analytics.totalTransactions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalTransactions || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.analytics.totalRevenue')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${((stats?.totalRevenue || 0) / 1000).toFixed(1)}K
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UserGrowthChart data={userGrowthData} period="30d" />
        <RevenueChart
          data={userGrowthData.map((item) => ({
            date: item.date,
            value: item.value * 100,
            revenue: item.value * 100,
            transactions: Math.floor(item.value / 10),
          })) as RevenueChartData[]}
          period="30d"
        />
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PieChart
          data={categoryChartData}
          title={t('admin.analytics.categoryDistribution')}
        />
        <PieChart
          data={roleChartData}
          title={t('admin.analytics.roleDistribution')}
        />
        <PieChart
          data={statusChartData}
          title={t('admin.analytics.storeStatus')}
        />
      </div>
    </div>
  );
}

