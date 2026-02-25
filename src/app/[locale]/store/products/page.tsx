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
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth/auth-context';
import type { AvailabilityStatus } from '@/lib/database/types';

interface ProductStore {
 id: string;
 current_price: number;
 original_price: number | null;
 stock_quantity: number | null;
 availability: AvailabilityStatus;
 is_deal: boolean;
 created_at: string;
 products?: {
 id: string;
 name_ar: string;
 name_en: string;
 category: string;
 brand: string;
 image_urls: string[] | null;
 };
}

export default function StoreProductsPage({
 params,
}: {
 params: Promise<{ locale: string }>;
}) {
 const [locale, setLocale] = useState<string>('en');
 const t = useTranslations();
 const [products, setProducts] = useState<ProductStore[]>([]);
 const [filteredProducts, setFilteredProducts] = useState<ProductStore[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [categoryFilter, setCategoryFilter] = useState<string>('all');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [page, setPage] = useState(1);
 const [total, setTotal] = useState(0);
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [productToDelete, setProductToDelete] = useState<ProductStore | null>(null);
 const [storeId, setStoreId] = useState<string | null>(null);
 const { user } = useAuth();
 const router = useRouter();
 const { toast } = useToast();
 const limit = 20;
 const isRTL = locale === 'ar';

 useEffect(() => {
 params.then((p) => setLocale(p.locale));
 }, [params]);

 useEffect(() => {
 loadStore();
 }, [user]);

 useEffect(() => {
 if (storeId) {
 loadProducts();
 }
 }, [page, categoryFilter, statusFilter, storeId]);

 useEffect(() => {
 // Client-side filtering
 let filtered = products;

 if (searchQuery) {
 const query = searchQuery.toLowerCase();
 filtered = filtered.filter(
 (product) =>
 product.products?.name_ar?.toLowerCase().includes(query) ||
 product.products?.name_en?.toLowerCase().includes(query) ||
 product.products?.brand?.toLowerCase().includes(query)
 );
 }

 setFilteredProducts(filtered);
 }, [products, searchQuery]);

 const loadStore = async () => {
 if (!user?.id) return;

 try {
 const supabase = getSupabaseBrowserClient();
 const { data: stores } = await supabase
 .from('stores')
 .select('id')
 .eq('created_by', user.id)
 .order('created_at', { ascending: false })
 .limit(1)
 .single();

 if (stores) {
 setStoreId(stores.id);
 }
 } catch (error) {
 console.error('Error loading store:', error);
 }
 };

 const loadProducts = async () => {
 if (!storeId) return;

 try {
 setLoading(true);
 const supabase = getSupabaseBrowserClient();

 let query = supabase
 .from('product_stores')
 .select(
 `
 *,
 products (
 id,
 name_ar,
 name_en,
 category,
 brand,
 image_urls
 )
 `,
 { count: 'exact' }
 )
 .eq('store_id', storeId);

 if (categoryFilter !== 'all') {
 query = query.eq('products.category', categoryFilter);
 }

 if (statusFilter !== 'all') {
 query = query.eq('availability', statusFilter as AvailabilityStatus);
 }

 const { data, error, count } = await query
 .order('created_at', { ascending: false })
 .range((page - 1) * limit, page * limit - 1);

 if (error) throw error;

 setProducts((data as ProductStore[]) || []);
 setFilteredProducts((data as ProductStore[]) || []);
 setTotal(count || 0);
 } catch (error) {
 console.error('Error loading products:', error);
 toast({
 title: t('common.error'),
 description: t('store.dashboard.products.failedToLoad'),
 variant: 'destructive',
 });
 } finally {
 setLoading(false);
 }
 };

 const handleDelete = async () => {
 if (!productToDelete || !storeId) return;

 try {
 const supabase = getSupabaseBrowserClient();
 const { error } = await supabase
 .from('product_stores')
 .delete()
 .eq('id', productToDelete.id)
 .eq('store_id', storeId);

 if (error) throw error;

 toast({
 title: t('common.deleted'),
 description: t('store.dashboard.products.deleteSuccess'),
 });

 setDeleteDialogOpen(false);
 setProductToDelete(null);
 loadProducts();
 } catch (error) {
 console.error('Error deleting product:', error);
 toast({
 title: t('common.error'),
 description: t('store.dashboard.products.deleteError'),
 variant: 'destructive',
 });
 }
 };

 const handleEdit = (product: ProductStore) => {
 router.push(`/${locale}/store/products/${product.id}`);
 };

 // Get unique categories for filter
 const categories = Array.from(
 new Set(products.map((p) => p.products?.category).filter(Boolean))
 );

 const columns: Column<ProductStore>[] = [
 {
 key: 'product',
 label: t('common.name'),
 render: (product) => {
 const prod = product.products as any;
 return prod ? (isRTL ? prod.name_ar : prod.name_en) : '-';
 },
 },
 {
 key: 'category',
 label: t('store.dashboard.products.category'),
 render: (product) => {
 const prod = product.products as any;
 return prod?.category || '-';
 },
 },
 {
 key: 'current_price',
 label: t('common.price'),
 render: (product) => `${Math.round(product.current_price).toLocaleString()}`,
 },
 {
 key: 'stock_quantity',
 label: t('store.dashboard.products.stock'),
 render: (product) => product.stock_quantity?.toLocaleString() || '-',
 },
 {
 key: 'availability',
 label: t('common.status'),
 render: (product) => (
 <span className="capitalize">{product.availability}</span>
 ),
 },
 {
 key: 'actions',
 label: t('common.actions'),
 render: (product) => (
 <div className="flex items-center gap-2">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleEdit(product)}
 className="h-8 w-8 p-0"
 >
 <Edit className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setProductToDelete(product);
 setDeleteDialogOpen(true);
 }}
 className="h-8 w-8 p-0 text-destructive hover:text-destructive"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 ),
 },
 ];

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {t('store.dashboard.products.title')}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {t('store.dashboard.products.subtitle')}
 </p>
 </div>
 <Button onClick={() => router.push(`/${locale}/store/products/new`)}>
 <Plus className="mr-2 h-4 w-4" />
 {t('store.dashboard.products.addProduct')}
 </Button>
 </div>

 {/* Filters */}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-1 items-center gap-4">
 <Input
 placeholder={t('common.search')}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="max-w-sm"
 />
 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder={t('store.dashboard.products.allCategories')} />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">{t('store.dashboard.products.allCategories')}</SelectItem>
 {categories.map((cat) => (
 <SelectItem key={cat as string} value={cat as string}>
 {cat as string}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder={t('admin.transactions.allStatuses')} />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">{t('admin.transactions.allStatuses')}</SelectItem>
 <SelectItem value="in_stock">{t('store.dashboard.products.inStock')}</SelectItem>
 <SelectItem value="out_of_stock">{t('store.dashboard.products.outOfStock')}</SelectItem>
 <SelectItem value="limited_stock">{t('store.dashboard.products.limitedStock')}</SelectItem>
 <SelectItem value="pre_order">{t('store.dashboard.products.preOrder')}</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Products Table */}
 <DataTable
 data={filteredProducts}
 columns={columns}
 pagination={{
 page,
 limit,
 total,
 onPageChange: setPage,
 }}
 loading={loading}
 />

 {/* Delete Confirmation Dialog */}
 <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>
 {t('store.dashboard.products.confirmDelete')}
 </AlertDialogTitle>
 <AlertDialogDescription>
 {t('store.dashboard.products.confirmDeleteDesc')}
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
 <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
 {t('common.delete')}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}

