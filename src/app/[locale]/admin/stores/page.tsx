'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Input } from '@/components/ui/input';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StoreStatus } from '@/lib/database/types';

interface Store {
 id: string;
 name_ar: string;
 name_en: string;
 status: StoreStatus;
 total_products: number;
 average_rating: number | null;
 total_reviews: number;
 created_at: string;
 revenue?: number;
}

export default function AdminStoresPage({
 params,
}: {
 params: Promise<{ locale: string }>;
}) {
 const [locale, setLocale] = useState<string>('en');
 const [stores, setStores] = useState<Store[]>([]);
 const [filteredStores, setFilteredStores] = useState<Store[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [page, setPage] = useState(1);
 const [total, setTotal] = useState(0);
 const router = useRouter();
 const limit = 20;

 useEffect(() => {
 params.then((p) => setLocale(p.locale));
 }, [params]);

 useEffect(() => {
 loadStores();
 }, [page, statusFilter]);

 useEffect(() => {
 // Client-side filtering
 let filtered = stores;

 if (searchQuery) {
 const query = searchQuery.toLowerCase();
 filtered = filtered.filter(
 (store) =>
 store.name_ar?.toLowerCase().includes(query) ||
 store.name_en?.toLowerCase().includes(query)
 );
 }

 setFilteredStores(filtered);
 }, [stores, searchQuery]);

 const loadStores = async () => {
 try {
 setLoading(true);
 const supabase = getSupabaseBrowserClient();

 let query = supabase.from('stores').select('*', { count: 'exact' });

 if (statusFilter !== 'all') {
 query = query.eq('status', statusFilter as StoreStatus);
 }

 const { data, error, count } = await query
 .order('created_at', { ascending: false })
 .range((page - 1) * limit, page * limit - 1);

 if (error) throw error;

 // Calculate revenue for each store (from transactions)
 const storesWithRevenue: Store[] = await Promise.all(
 (data || []).map(async (store: any) => {
 const { data: productStores } = await supabase
 .from('product_stores')
 .select('id')
 .eq('store_id', store.id);

 const productStoreIds = productStores?.map((ps) => ps.id) || [];

 if (productStoreIds.length === 0) {
 return { ...store, revenue: 0 };
 }

 const { data: transactions } = await supabase
 .from('transactions')
 .select('amount')
 .in('product_store_id', productStoreIds)
 .eq('status', 'completed');

 const revenue =
 transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

 return { ...store, revenue } as Store;
 })
 );

 setStores(storesWithRevenue);
 setFilteredStores(storesWithRevenue);
 setTotal(count || 0);
 } catch (error) {
 console.error('Error loading stores:', error);
 } finally {
 setLoading(false);
 }
 };

 const handleViewDetails = (store: Store) => {
 router.push(`/${locale}/admin/stores/${store.id}`);
 };

 const getStatusBadgeVariant = (status: StoreStatus) => {
 switch (status) {
 case 'active':
 return 'default';
 case 'pending':
 return 'secondary';
 case 'suspended':
 return 'warning';
 default:
 return 'secondary';
 }
 };

 const columns: Column<Store>[] = [
 {
 key: 'name',
 label: t('admin.stores.name'),
 render: (store) => (locale === 'ar' ? store.name_ar : store.name_en),
 },
 {
 key: 'status',
 label: t('admin.stores.status'),
 render: (store) => (
 <Badge variant={getStatusBadgeVariant(store.status)}>
 {store.status}
 </Badge>
 ),
 },
 {
 key: 'total_products',
 label: t('admin.stores.products'),
 render: (store) => store.total_products || 0,
 },
 {
 key: 'average_rating',
 label: t('admin.stores.rating'),
 render: (store) =>
 store.average_rating ? store.average_rating.toFixed(1) : '-',
 },
 {
 key: 'revenue',
 label: t('admin.stores.revenue'),
 render: (store) => `$${((store.revenue || 0) / 1000).toFixed(1)}K`,
 },
 {
 key: 'created_at',
 label: t('admin.stores.createdDate'),
 render: (store) => new Date(store.created_at).toLocaleDateString(),
 },
 {
 key: 'actions',
 label: t('admin.stores.actions'),
 render: (store) => (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleViewDetails(store)}
 className="h-8 w-8 p-0"
 >
 <Eye className="h-4 w-4" />
 </Button>
 ),
 },
 ];

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {t('admin.stores.title')}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {t('admin.stores.subtitle')}
 </p>
 </div>

 {/* Filters */}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-1 items-center gap-4">
 <Input
 placeholder={t('admin.stores.searchPlaceholder')}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="max-w-sm"
 />
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder={t('admin.stores.allStatuses')} />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">{t('admin.stores.allStatuses')}</SelectItem>
 <SelectItem value="active">{t('admin.stores.active')}</SelectItem>
 <SelectItem value="pending">{t('admin.stores.pending')}</SelectItem>
 <SelectItem value="suspended">{t('admin.stores.suspended')}</SelectItem>
 <SelectItem value="inactive">{t('admin.stores.inactive')}</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Stores Table */}
 <DataTable
 data={filteredStores}
 columns={columns}
 pagination={{
 page,
 limit,
 total,
 onPageChange: setPage,
 }}
 loading={loading}
 />
 </div>
 );
}

