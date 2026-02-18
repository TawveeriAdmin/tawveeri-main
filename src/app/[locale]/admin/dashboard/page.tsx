import {
  getDashboardKPIs,
  getRevenueOverTime,
  getUserRegistrationsByDay,
  getCategoryDistribution,
  getStorePerformanceRanking,
  getConversionFunnel,
  getDealActivityOverTime,
} from '@/lib/admin/dashboard-queries';
import { getAuditLogs } from '@/lib/auth/audit';
import { getServerTranslations } from '@/lib/translations-server';
import { DashboardCharts } from './dashboard-charts';
import { DashboardKPICards } from './dashboard-kpis';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity } from 'lucide-react';
import { format } from 'date-fns';

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getServerTranslations(locale);

  const [
    kpis,
    revenueData,
    userGrowthData,
    categoryData,
    storePerformance,
    funnelData,
    dealActivity,
    recentActivityResult,
  ] = await Promise.all([
    getDashboardKPIs(),
    getRevenueOverTime('30d'),
    getUserRegistrationsByDay('30d'),
    getCategoryDistribution(),
    getStorePerformanceRanking(locale),
    getConversionFunnel(),
    getDealActivityOverTime('30d'),
    getAuditLogs({ limit: 10, offset: 0 }),
  ]);

  const recentActivityData = recentActivityResult.data || [];
  const recentActivity = Array.isArray(recentActivityData) ? recentActivityData : [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <DashboardKPICards kpis={kpis} locale={locale} />

      {/* Charts */}
      <DashboardCharts
        locale={locale}
        revenueData={revenueData}
        userGrowthData={userGrowthData}
        categoryData={categoryData}
        storePerformance={storePerformance}
        funnelData={funnelData}
        dealActivity={dealActivity}
      />

      {/* Recent Activity */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-on-surface-variant" />
          <h2 className="text-title-lg text-on-surface">
            {t('admin.dashboard.recentActivity')}
          </h2>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.dashboard.date')}</TableHead>
                <TableHead>{t('admin.dashboard.action')}</TableHead>
                <TableHead>{t('admin.dashboard.type')}</TableHead>
                <TableHead>{t('admin.dashboard.user')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-on-surface-variant">
                    {t('admin.dashboard.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                recentActivity.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{format(new Date(row.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell>{row.entity_type || '-'}</TableCell>
                    <TableCell>
                      {row.user_id ? `${row.user_id.substring(0, 8)}...` : t('admin.dashboard.system')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
