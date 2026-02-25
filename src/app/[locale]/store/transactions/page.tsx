import { createClient } from '@/lib/auth/server';
import { getUserProfile } from '@/lib/auth/server';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatsCard } from '@/components/admin/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatNumber } from '@/lib/formatting';
import {
 DollarSign,
 MousePointerClick,
 TrendingUp,
 CreditCard,
} from 'lucide-react';
import { getServerTranslations } from '@/lib/translations-server';

export default async function StoreTransactionsPage({
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
 label: t('common.product'),
 render: (transaction) => {
 const productStore = transaction.product_stores as any;
 const product = productStore?.products as any;
 return product ? (isRTL ? product.name_ar : product.name_en) : '-';
 },
 },
 {
 key: 'amount',
 label: t('common.amount'),
 render: (transaction) => `$${transaction.amount.toLocaleString()}`,
 },
 {
 key: 'commission_amount',
 label: t('common.commission'),
 render: (transaction) => `$${(transaction.commission_amount || 0).toLocaleString()}`,
 },
 {
 key: 'commission_rate',
 label: t('admin.transactions.commissionRate'),
 render: (transaction) => `${transaction.commission_rate || 0}%`,
 },
 {
 key: 'status',
 label: t('common.status'),
 render: (transaction) => (
 <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
 {transaction.status}
 </Badge>
 ),
 },
 {
 key: 'clicked_at',
 label: t('store.dashboard.clickedAt'),
 render: (transaction) =>
 transaction.clicked_at ? formatDate(transaction.clicked_at, locale, 'datetime') : '-',
 },
 {
 key: 'converted_at',
 label: t('store.dashboard.convertedAt'),
 render: (transaction) =>
 transaction.converted_at ? formatDate(transaction.converted_at, locale, 'datetime') : '-',
 },
 ];

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {t('store.dashboard.transactions')}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {t('store.dashboard.transactionsSubtitle')}
 </p>
 </div>

 {/* Stats Cards */}
 {stats && (
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
 <StatsCard
 title={t('store.dashboard.totalClicks')}
 value={formatNumber(stats.totalClicks, locale)}
 icon={<MousePointerClick className="h-6 w-6" />}
 />
 <StatsCard
 title={t('store.dashboard.conversions')}
 value={formatNumber(stats.totalConversions, locale)}
 icon={<TrendingUp className="h-6 w-6" />}
 />
 <StatsCard
 title={t('store.dashboard.conversionRate')}
 value={`${stats.conversionRate.toFixed(1)}%`}
 icon={<TrendingUp className="h-6 w-6" />}
 />
 <StatsCard
 title={t('store.dashboard.totalRevenue')}
 value={`$${((stats.totalRevenue || 0) / 1000).toFixed(1)}K`}
 icon={<DollarSign className="h-6 w-6" />}
 />
 <StatsCard
 title={t('store.dashboard.totalCommissions')}
 value={`$${((stats.totalCommissions || 0) / 1000).toFixed(1)}K`}
 icon={<CreditCard className="h-6 w-6" />}
 />
 </div>
 )}

 {/* Transactions Table */}
 <Card>
 <CardHeader>
 <CardTitle>{t('store.dashboard.recentTransactions')}</CardTitle>
 </CardHeader>
 <CardContent>
 <DataTable data={transactions || []} columns={columns} />
 </CardContent>
 </Card>
 </div>
 );
}

