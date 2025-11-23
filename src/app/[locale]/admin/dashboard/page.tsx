import { getAdminStats } from '@/lib/admin/utils';
import { getUserGrowthChartData, getRevenueChartData, type RevenueChartData } from '@/lib/analytics/charts';
import { getAuditLogs } from '@/lib/auth/audit';
import { StatsCard } from '@/components/admin/stats-card';
import { RevenueChart } from '@/components/analytics/revenue-chart';
import { UserGrowthChart } from '@/components/analytics/user-growth-chart';
import { DataTable, type Column } from '@/components/admin/data-table';
import { getServerTranslations } from '@/lib/translations-server';
import {
  Users,
  Package,
  Store,
  CreditCard,
  DollarSign,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getServerTranslations(locale);

  // Fetch all dashboard data
  const [statsResult, userGrowthResult, recentActivityResult] = await Promise.all([
    getAdminStats(),
    getUserGrowthChartData('30d'),
    getAuditLogs({ limit: 10, offset: 0 }),
  ]);

  const stats = statsResult.data;
  const userGrowthData = userGrowthResult.data || [];
  const recentActivityResultData = recentActivityResult.data || [];
  const recentActivity = Array.isArray(recentActivityResultData) ? recentActivityResultData : [];

  // Get revenue data (aggregate from all stores for admin view)
  // For now, we'll use a placeholder - in production, this would aggregate from all stores
  const revenueData: RevenueChartData[] = userGrowthData.map((item) => ({
    date: item.date,
    value: item.value * 100, // Placeholder - will be replaced with actual revenue aggregation
    revenue: item.value * 100,
    transactions: Math.floor(item.value / 10),
  }));

  // Define columns for recent activity table
  const activityColumns: Column<any>[] = [
    {
      key: 'created_at',
      label: t('admin.dashboard.date'),
      render: (row) => format(new Date(row.created_at), 'MMM dd, yyyy HH:mm'),
    },
    {
      key: 'action',
      label: t('admin.dashboard.action'),
      render: (row) => (
        <span className="font-medium">{row.action}</span>
      ),
    },
    {
      key: 'entity_type',
      label: t('admin.dashboard.type'),
      render: (row) => row.entity_type || '-',
    },
    {
      key: 'user_id',
      label: t('admin.dashboard.user'),
      render: (row) => row.user_id ? row.user_id.substring(0, 8) + '...' : t('admin.dashboard.system'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('admin.dashboard.title')}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('admin.dashboard.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title={t('admin.dashboard.totalUsers')}
          value={stats?.totalUsers || 0}
          icon={<Users className="h-6 w-6" />}
        />
        <StatsCard
          title={t('admin.dashboard.totalProducts')}
          value={stats?.totalProducts || 0}
          icon={<Package className="h-6 w-6" />}
        />
        <StatsCard
          title={t('admin.dashboard.totalStores')}
          value={stats?.totalStores || 0}
          icon={<Store className="h-6 w-6" />}
        />
        <StatsCard
          title={t('admin.dashboard.transactions')}
          value={stats?.totalTransactions || 0}
          icon={<CreditCard className="h-6 w-6" />}
        />
        <StatsCard
          title={t('admin.dashboard.totalRevenue')}
          value={`$${((stats?.totalRevenue || 0) / 1000).toFixed(1)}K`}
          icon={<DollarSign className="h-6 w-6" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UserGrowthChart data={userGrowthData} period="30d" />
        <RevenueChart data={revenueData} period="30d" />
      </div>

      {/* Recent Activity */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('admin.dashboard.recentActivity')}
          </h2>
        </div>
        <DataTable
          data={recentActivity}
          columns={activityColumns}
          onRowClick={(row) => {
            // Navigate to log details if needed
          }}
        />
      </div>
    </div>
  );
}

