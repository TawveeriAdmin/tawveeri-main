import dynamic from 'next/dynamic';
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
import { DashboardKPICards } from './dashboard-kpis';

const DashboardCharts = dynamic(
  () => import('./dashboard-charts').then((m) => ({ default: m.DashboardCharts }))
);
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity, CircleDollarSign, ShieldCheck, TimerReset } from 'lucide-react';
import { formatDate } from '@/lib/formatting';

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
  const isRTL = locale === 'ar';
  const conversionRate = kpis.totalTransactions > 0
    ? Math.round((kpis.totalTransactions / Math.max(kpis.totalTransactions + kpis.activePriceAlerts, 1)) * 100)
    : 0;

  return (
    <div className="w-full space-y-6">
      <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59]">
              {isRTL ? 'نظرة تشغيلية' : 'Operational overview'}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-on-surface md:text-3xl dark:text-white">
              {t('admin.dashboard.title')}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-on-surface-variant dark:text-white/65">
              {isRTL
                ? 'مؤشرات مختصرة للمتاجر، المنتجات، الإيرادات، والتنبيهات بدون تشويش بصري.'
                : 'A concise read of stores, products, revenue, and alerts without visual noise.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
            {[
              {
                icon: ShieldCheck,
                label: isRTL ? 'حالة النظام' : 'System state',
                value: isRTL ? 'مستقر' : 'Stable',
              },
              {
                icon: TimerReset,
                label: isRTL ? 'نافذة القياس' : 'Reporting window',
                value: isRTL ? '30 يوم' : '30 days',
              },
              {
                icon: CircleDollarSign,
                label: isRTL ? 'معدل النشاط' : 'Activity rate',
                value: `${conversionRate}%`,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-[#d7ece5] bg-[#f8fcfa] p-4 dark:border-[#2d463d] dark:bg-[#101713]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e5f5ef] text-[#1f6f59]">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-on-surface-variant dark:text-white/60">{item.label}</p>
                      <p className="mt-0.5 truncate text-lg font-black text-on-surface dark:text-white">{item.value}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <DashboardKPICards kpis={kpis} locale={locale} />

      <DashboardCharts
        locale={locale}
        revenueData={revenueData}
        userGrowthData={userGrowthData}
        categoryData={categoryData}
        storePerformance={storePerformance}
        funnelData={funnelData}
        dealActivity={dealActivity}
      />

      <section className="overflow-hidden rounded-[1.6rem] border border-[#d7ece5] bg-white/90 dark:border-[#263b33] dark:bg-[#141c18]">
        <div className="flex items-center justify-between gap-4 border-b border-[#e1f0eb] px-5 py-4 dark:border-[#263b33]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf7f2] text-[#1f6f59]">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59]">
                {isRTL ? 'السجل' : 'Ledger'}
              </p>
              <h2 className="text-xl font-black tracking-tight text-on-surface dark:text-white">
                {t('admin.dashboard.recentActivity')}
              </h2>
            </div>
          </div>
          <span className="rounded-full bg-[#eff8f5] px-3 py-1.5 text-xs font-bold text-on-surface-variant dark:bg-white/8 dark:text-white/70">
            {recentActivity.length} {isRTL ? 'سجل' : 'entries'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#e1f0eb] hover:bg-transparent dark:border-[#263b33]">
                <TableHead className="h-12 text-xs font-black uppercase tracking-[0.12em] text-on-surface-variant dark:text-white/55">{t('admin.dashboard.date')}</TableHead>
                <TableHead className="h-12 text-xs font-black uppercase tracking-[0.12em] text-on-surface-variant dark:text-white/55">{t('admin.dashboard.action')}</TableHead>
                <TableHead className="h-12 text-xs font-black uppercase tracking-[0.12em] text-on-surface-variant dark:text-white/55">{t('admin.dashboard.type')}</TableHead>
                <TableHead className="h-12 text-xs font-black uppercase tracking-[0.12em] text-on-surface-variant dark:text-white/55">{t('admin.dashboard.user')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-on-surface-variant dark:text-white/60">
                    {t('admin.dashboard.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                recentActivity.map((row) => (
                  <TableRow key={row.id} className="border-[#e1f0eb] dark:border-[#263b33]">
                    <TableCell className="whitespace-nowrap font-mono text-xs text-on-surface-variant dark:text-white/60">
                      {formatDate(row.created_at, locale, 'datetime')}
                    </TableCell>
                    <TableCell className="font-bold text-on-surface dark:text-white">{row.action}</TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-[#eff8f5] px-2.5 py-1 text-xs font-bold text-[#1f6f59] dark:bg-[#16382e] dark:text-[#9fe4d0]">
                        {row.entity_type || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-on-surface-variant dark:text-white/60">
                      {row.user_id ? `${row.user_id.substring(0, 8)}...` : t('admin.dashboard.system')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
