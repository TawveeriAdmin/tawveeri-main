import dynamic from 'next/dynamic';
import {
  getDashboardKPIs,
  getUserRegistrationsByDay,
  getCategoryDistribution,
} from '@/lib/admin/dashboard-queries';
import { createClient } from '@/lib/auth/server';
import { getServerTranslations } from '@/lib/translations-server';
import { DashboardKPICards } from './analytics-kpis';

const AnalyticsCharts = dynamic(
  () => import('./analytics-charts').then((m) => ({ default: m.AnalyticsCharts }))
);

export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getServerTranslations(locale);
  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    kpis,
    revenueData,
    userGrowthData,
    categoryData,
    roleResult,
    storeStatusResult,
  ] = await Promise.all([
    getDashboardKPIs(),
    Promise.resolve([]), // Legacy transactions are not affiliate-network revenue evidence.
    getUserRegistrationsByDay('30d'),
    getCategoryDistribution(),
    supabase.from('users').select('role'),
    supabase.from('stores').select('slug'),
  ]);

  // Build role distribution
  const roleCounts: Record<string, number> = {};
  roleResult.data?.forEach((user) => {
    const role = user.role || 'unknown';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });
  const roleData = Object.entries(roleCounts)
    .map(([name, value]) => ({
      name: name === 'admin' ? t('admin.users.admin')
        : name === 'customer' ? t('admin.users.customer')
        : name === 'store' ? t('admin.users.store')
        : name === 'guest' ? t('admin.users.guest')
        : name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // Build store status distribution
  const statusCounts: Record<string, number> = {};
  storeStatusResult.data?.forEach(() => {
    const status = 'registered'; // Production has no lifecycle status column.
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  const storeStatusData = Object.entries(statusCounts)
    .map(([name, value]) => ({
      name: name === 'active' ? t('admin.stores.active')
        : name === 'pending' ? t('admin.stores.pending')
        : name === 'suspended' ? t('admin.stores.suspended')
        : name === 'inactive' ? t('admin.stores.inactive')
        : name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <p className="text-sm leading-7">{locale === 'ar' ? 'هذه إحصاءات حسابات وقوائم الكتالوج الحالية، وليست زيارات أو مبيعات. لا توجد حالة نشاط موثقة للمتاجر في هذا المصدر. الإيراد والطلبات يُراجعان من تقارير الشركاء في صفحة العمولات؛ لا يُستنتجان من جدول المعاملات التراثي.' : 'Current account and catalog counts, not visits or sales. Store lifecycle status is not recorded here. Use partner reports for revenue and orders.'}</p>
      {/* KPI Cards */}
      <DashboardKPICards kpis={kpis} locale={locale} />

      {/* Charts */}
      <AnalyticsCharts
        locale={locale}
        revenueData={revenueData}
        userGrowthData={userGrowthData}
        categoryData={categoryData}
        roleData={roleData}
        storeStatusData={storeStatusData}
      />
    </div>
  );
}
