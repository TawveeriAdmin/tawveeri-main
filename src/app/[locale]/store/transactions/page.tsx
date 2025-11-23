import { createClient } from '@/lib/auth/server';
import { getUserProfile } from '@/lib/auth/server';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatsCard } from '@/components/admin/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  DollarSign,
  MousePointerClick,
  TrendingUp,
  CreditCard,
} from 'lucide-react';

export default async function StoreTransactionsPage({
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

  // Get product store IDs
  const { data: productStores } = await supabase
    .from('product_stores')
    .select('id')
    .eq('store_id', store.id);

  const productStoreIds = productStores?.map((ps) => ps.id) || [];

  // Fetch transactions
  const { data: transactions } =
    productStoreIds.length > 0
      ? await supabase
          .from('transactions')
          .select(
            `
            *,
            product_stores (
              id,
              current_price,
              products (
                id,
                name_ar,
                name_en
              )
            )
          `
          )
          .in('product_store_id', productStoreIds)
          .order('created_at', { ascending: false })
          .limit(100)
      : { data: [] };

  // Get transaction stats (needs to be called on client side)
  // For now, calculate stats manually
  const stats = transactions
    ? {
        totalClicks: transactions.length,
        totalConversions: transactions.filter((t: any) => t.status === 'completed').length,
        conversionRate:
          transactions.length > 0
            ? (transactions.filter((t: any) => t.status === 'completed').length / transactions.length) * 100
            : 0,
        totalRevenue: transactions
          .filter((t: any) => t.status === 'completed')
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
        totalCommissions: transactions
          .filter((t: any) => t.status === 'completed')
          .reduce((sum: number, t: any) => sum + (t.commission_amount || 0), 0),
      }
    : null;

  const columns: Column<any>[] = [
    {
      key: 'product',
      label: isRTL ? 'المنتج' : 'Product',
      render: (transaction) => {
        const productStore = transaction.product_stores as any;
        const product = productStore?.products as any;
        return product ? (isRTL ? product.name_ar : product.name_en) : '-';
      },
    },
    {
      key: 'amount',
      label: isRTL ? 'المبلغ' : 'Amount',
      render: (transaction) => `$${transaction.amount.toLocaleString()}`,
    },
    {
      key: 'commission_amount',
      label: isRTL ? 'العمولة' : 'Commission',
      render: (transaction) => `$${(transaction.commission_amount || 0).toLocaleString()}`,
    },
    {
      key: 'commission_rate',
      label: isRTL ? 'نسبة العمولة' : 'Commission Rate',
      render: (transaction) => `${transaction.commission_rate || 0}%`,
    },
    {
      key: 'status',
      label: isRTL ? 'الحالة' : 'Status',
      render: (transaction) => (
        <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
          {transaction.status}
        </Badge>
      ),
    },
    {
      key: 'clicked_at',
      label: isRTL ? 'تاريخ النقر' : 'Clicked At',
      render: (transaction) =>
        transaction.clicked_at ? format(new Date(transaction.clicked_at), 'MMM dd, yyyy HH:mm') : '-',
    },
    {
      key: 'converted_at',
      label: isRTL ? 'تاريخ التحويل' : 'Converted At',
      render: (transaction) =>
        transaction.converted_at ? format(new Date(transaction.converted_at), 'MMM dd, yyyy HH:mm') : '-',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isRTL ? 'المعاملات' : 'Transactions'}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {isRTL ? 'عرض معاملات متجرك والعمولات' : 'View your store transactions and commissions'}
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatsCard
            title={isRTL ? 'إجمالي النقرات' : 'Total Clicks'}
            value={stats.totalClicks.toLocaleString()}
            icon={<MousePointerClick className="h-6 w-6" />}
          />
          <StatsCard
            title={isRTL ? 'التحويلات' : 'Conversions'}
            value={stats.totalConversions.toLocaleString()}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatsCard
            title={isRTL ? 'معدل التحويل' : 'Conversion Rate'}
            value={`${stats.conversionRate.toFixed(1)}%`}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatsCard
            title={isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}
            value={`$${((stats.totalRevenue || 0) / 1000).toFixed(1)}K`}
            icon={<DollarSign className="h-6 w-6" />}
          />
          <StatsCard
            title={isRTL ? 'إجمالي العمولات' : 'Total Commissions'}
            value={`$${((stats.totalCommissions || 0) / 1000).toFixed(1)}K`}
            icon={<CreditCard className="h-6 w-6" />}
          />
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'المعاملات الأخيرة' : 'Recent Transactions'}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={transactions || []} columns={columns} />
        </CardContent>
      </Card>
    </div>
  );
}

