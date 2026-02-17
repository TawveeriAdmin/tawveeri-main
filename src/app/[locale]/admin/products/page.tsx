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
import { Eye, Edit, Trash2 } from 'lucide-react';
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

interface Product {
 id: string;
 name_ar: string;
 name_en: string;
 category: string;
 brand: string;
 view_count: number;
 save_count: number;
 created_at: string;
 stores_count?: number;
}

export default function AdminProductsPage({
 params,
}: {
 params: Promise<{ locale: string }>;
}) {
 const [locale, setLocale] = useState<string>('en');
 const [products, setProducts] = useState<Product[]>([]);
 const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [categoryFilter, setCategoryFilter] = useState<string>('all');
 const [brandFilter, setBrandFilter] = useState<string>('all');
 const [page, setPage] = useState(1);
 const [total, setTotal] = useState(0);
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [productToDelete, setProductToDelete] = useState<Product | null>(null);
 const t = useTranslations();
 const router = useRouter();
 const { toast } = useToast();
 const limit = 20;

 useEffect(() => {
 params.then((p) => setLocale(p.locale));
 }, [params]);

 useEffect(() => {
 loadProducts();
 }, [page, categoryFilter, brandFilter]);

 useEffect(() => {
 // Client-side filtering
 let filtered = products;

 if (searchQuery) {
 const query = searchQuery.toLowerCase();
 filtered = filtered.filter(
 (product) =>
 product.name_ar?.toLowerCase().includes(query) ||
 product.name_en?.toLowerCase().includes(query) ||
 product.brand?.toLowerCase().includes(query)
 );
 }

 setFilteredProducts(filtered);
 }, [products, searchQuery]);

 const loadProducts = async () => {
 try {
 setLoading(true);
 const supabase = getSupabaseBrowserClient();

 let query = supabase
 .from('products')
 .select('*, product_stores(count)', { count: 'exact' });

 if (categoryFilter !== 'all') {
 query = query.eq('category', categoryFilter);
 }

 if (brandFilter !== 'all') {
 query = query.eq('brand', brandFilter);
 }

 const { data, error, count } = await query
 .order('created_at', { ascending: false })
 .range((page - 1) * limit, page * limit - 1);

 if (error) throw error;

 // Transform data to include stores count
 const transformedData = (data || []).map((product: any) => ({
 ...product,
 stores_count: product.product_stores?.length || 0,
 }));

 setProducts(transformedData);
 setFilteredProducts(transformedData);
 setTotal(count || 0);
 } catch (error) {
 console.error('Error loading products:', error);
 toast({
 title: t('admin.products.error'),
 description: t('admin.products.loadError'),
 variant: 'destructive',
 });
 } finally {
 setLoading(false);
 }
 };

 const handleDelete = async () => {
 if (!productToDelete) return;

 try {
 const supabase = getSupabaseBrowserClient();
 const { error } = await supabase
 .from('products')
 .delete()
 .eq('id', productToDelete.id);

 if (error) throw error;

 toast({
 title: t('admin.products.deleted'),
 description: t('admin.products.productDeleted'),
 });

 setDeleteDialogOpen(false);
 setProductToDelete(null);
 loadProducts();
 } catch (error) {
 console.error('Error deleting product:', error);
 toast({
 title: t('admin.products.error'),
 description: t('admin.products.deleteError'),
 variant: 'destructive',
 });
 }
 };

 const handleViewDetails = (product: Product) => {
 router.push(`/${locale}/admin/products/${product.id}`);
 };

 // Get unique categories and brands for filters
 const categories = Array.from(new Set(products.map((p) => p.category)));
 const brands = Array.from(new Set(products.map((p) => p.brand)));

 const columns: Column<Product>[] = [
 {
 key: 'name',
 label: t('admin.products.name'),
 render: (product) => (locale === 'ar' ? product.name_ar : product.name_en),
 },
 {
 key: 'category',
 label: t('admin.products.category'),
 render: (product) => (
 <span className="capitalize">{product.category}</span>
 ),
 },
 {
 key: 'brand',
 label: t('admin.products.brand'),
 render: (product) => product.brand,
 },
 {
 key: 'stores_count',
 label: t('admin.products.stores'),
 render: (product) => product.stores_count || 0,
 },
 {
 key: 'view_count',
 label: t('admin.products.views'),
 render: (product) => product.view_count.toLocaleString(),
 },
 {
 key: 'save_count',
 label: t('admin.products.saves'),
 render: (product) => product.save_count.toLocaleString(),
 },
 {
 key: 'created_at',
 label: t('admin.products.createdDate'),
 render: (product) => new Date(product.created_at).toLocaleDateString(),
 },
 {
 key: 'actions',
 label: t('admin.products.actions'),
 render: (product) => (
 <div className="flex items-center gap-2">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleViewDetails(product)}
 className="h-8 w-8 p-0"
 >
 <Eye className="h-4 w-4" />
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
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {t('admin.products.title')}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {t('admin.products.subtitle')}
 </p>
 </div>

 {/* Filters */}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-1 items-center gap-4">
 <Input
 placeholder={t('admin.products.searchPlaceholder')}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="max-w-sm"
 />
 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder={t('admin.products.allCategories')} />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">{t('admin.products.allCategories')}</SelectItem>
 {categories.map((cat) => (
 <SelectItem key={cat} value={cat}>
 {cat}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={brandFilter} onValueChange={setBrandFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder={t('admin.products.allBrands')} />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">{t('admin.products.allBrands')}</SelectItem>
 {brands.map((brand) => (
 <SelectItem key={brand} value={brand}>
 {brand}
 </SelectItem>
 ))}
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
 {t('admin.products.confirmDelete')}
 </AlertDialogTitle>
 <AlertDialogDescription>
 {t('admin.products.confirmDeleteDesc', { 
 name: productToDelete ? (locale === 'ar' ? productToDelete.name_ar : productToDelete.name_en) : t('admin.products.product') 
 })}
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>{t('admin.products.cancel')}</AlertDialogCancel>
 <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
 {t('admin.products.delete')}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}

