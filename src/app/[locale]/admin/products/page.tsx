'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { formatDate, formatNumber } from '@/lib/formatting';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import {
  Eye,
  Trash2,
  Package,
  Tag,
  BarChart3,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  SlidersHorizontal,
  Columns3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────
interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  category: string;
  brand: string;
  image_urls: string[] | null;
  view_count: number;
  save_count: number;
  created_at: string;
  product_stores: { count: number }[] | null;
}

interface ProductStats {
  total: number;
  withDeals: number;
  totalViews: number;
  totalSaves: number;
}

type SortField = 'name_en' | 'category' | 'brand' | 'view_count' | 'save_count' | 'created_at';
type SortDir = 'asc' | 'desc';
type ColumnKey = 'name' | 'category' | 'brand' | 'stores' | 'views' | 'saves' | 'createdDate' | 'actions';

// ─── Sub-components ───────────────────────────────────────

function StatsCard({
  title,
  value,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 text-start transition-all',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-outline-variant bg-surface-container-lowest hover:border-primary/40'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          active ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary'
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="tabular-nums text-xl font-bold text-on-surface">
          {value}
        </p>
        <p className="truncate text-xs text-on-surface-variant">{title}</p>
      </div>
    </button>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
      {category}
    </span>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field)
    return <ArrowUpDown className="ms-1 inline h-3.5 w-3.5 text-on-surface-variant/50" />;
  return sortDir === 'asc' ? (
    <ArrowUp className="ms-1 inline h-3.5 w-3.5 text-primary" />
  ) : (
    <ArrowDown className="ms-1 inline h-3.5 w-3.5 text-primary" />
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function AdminProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState('en');
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const isRTL = locale === 'ar';

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProductStats>({
    total: 0, withDeals: 0, totalViews: 0, totalSaves: 0,
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    name: true,
    category: true,
    brand: true,
    stores: true,
    views: true,
    saves: true,
    createdDate: true,
    actions: true,
  });

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  // ─── Data loading ───────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const sb = getSupabaseBrowserClient();
      const [totalRes, dealsRes, viewsRes, savesRes] = await Promise.all([
        sb.from('products').select('id', { count: 'exact', head: true }),
        sb.from('product_stores').select('product_id', { count: 'exact', head: true }).eq('is_deal', true),
        sb.from('products').select('view_count'),
        sb.from('products').select('save_count'),
      ]);
      setStats({
        total: totalRes.count || 0,
        withDeals: dealsRes.count || 0,
        totalViews: (viewsRes.data || []).reduce((sum: number, p: any) => sum + (p.view_count || 0), 0),
        totalSaves: (savesRes.data || []).reduce((sum: number, p: any) => sum + (p.save_count || 0), 0),
      });
    } catch (e) {
      console.error('Error loading stats:', e);
    }
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      const sb = getSupabaseBrowserClient();
      const [catRes, brandRes] = await Promise.all([
        sb.from('products').select('category'),
        sb.from('products').select('brand'),
      ]);
      const uniqueCats = Array.from(new Set((catRes.data || []).map((p: any) => p.category).filter(Boolean)));
      const uniqueBrands = Array.from(new Set((brandRes.data || []).map((p: any) => p.brand).filter(Boolean)));
      setCategories(uniqueCats.sort());
      setBrands(uniqueBrands.sort());
    } catch (e) {
      console.error('Error loading filters:', e);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const sb = getSupabaseBrowserClient();

      // Map sort field for name (locale-dependent)
      const dbSortField = sortField === 'name_en'
        ? (locale === 'ar' ? 'name_ar' : 'name_en')
        : sortField;

      let q = sb
        .from('products')
        .select('id, name_ar, name_en, category, brand, image_urls, view_count, save_count, created_at, product_stores(count)', { count: 'exact' });

      if (categoryFilter !== 'all') q = q.eq('category', categoryFilter);
      if (brandFilter !== 'all') q = q.eq('brand', brandFilter);
      if (searchQuery.trim()) {
        q = q.or(
          `name_ar.ilike.%${searchQuery}%,name_en.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%`
        );
      }

      const { data, error, count } = await q
        .order(dbSortField, { ascending: sortDir === 'asc' })
        .range((page - 1) * rowsPerPage, page * rowsPerPage - 1);

      if (error) throw error;
      setProducts((data as Product[]) || []);
      setTotal(count || 0);
    } catch (e) {
      console.error('Error loading products:', e);
      toast({
        title: t('admin.products.error'),
        description: t('admin.products.loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, categoryFilter, brandFilter, searchQuery, sortField, sortDir, locale, t, toast]);

  useEffect(() => { loadStats(); loadFilters(); }, [loadStats, loadFilters]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { setPage(1); }, [categoryFilter, brandFilter, searchQuery, rowsPerPage]);

  // ─── Handlers ───────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleViewDetails = (product: Product) => {
    router.push(`/${locale}/admin/products/${product.id}`);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      const sb = getSupabaseBrowserClient();
      const { error } = await sb
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
      loadStats();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: t('admin.products.error'),
        description: t('admin.products.deleteError'),
        variant: 'destructive',
      });
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStoresCount = (product: Product) => {
    if (!product.product_stores || product.product_stores.length === 0) return 0;
    return product.product_stores[0]?.count || 0;
  };

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const showFrom = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const showTo = Math.min(page * rowsPerPage, total);

  const colLabels: Record<ColumnKey, string> = useMemo(
    () => ({
      name: t('admin.products.name'),
      category: t('admin.products.category'),
      brand: t('admin.products.brand'),
      stores: t('admin.products.stores'),
      views: t('admin.products.views'),
      saves: t('admin.products.saves'),
      createdDate: t('admin.products.createdDate'),
      actions: t('admin.products.actions'),
    }),
    [t]
  );

  const hasActiveFilter = categoryFilter !== 'all' || brandFilter !== 'all' || searchQuery.trim() !== '';

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatsCard
          title={t('admin.products.totalProducts')}
          value={formatNumber(stats.total, locale)}
          icon={<Package className="h-5 w-5" />}
        />
        <StatsCard
          title={t('admin.products.withDeals')}
          value={formatNumber(stats.withDeals, locale)}
          icon={<Tag className="h-5 w-5" />}
        />
        <StatsCard
          title={t('admin.products.totalViews')}
          value={formatNumber(stats.totalViews, locale)}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatsCard
          title={t('admin.products.totalSaves')}
          value={formatNumber(stats.totalSaves, locale)}
          icon={<Bookmark className="h-5 w-5" />}
        />
      </div>

      {/* ── DataTable Card ── */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              placeholder={t('admin.products.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>

          {/* Toolbar actions */}
          <div className="flex items-center gap-2">
            {/* Filters dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn('gap-1.5', hasActiveFilter && 'border-primary text-primary')}>
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.products.category')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                <DropdownMenuLabel>{t('admin.products.category')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={categoryFilter === 'all'}
                  onCheckedChange={() => setCategoryFilter('all')}
                >
                  {t('admin.products.allCategories')}
                </DropdownMenuCheckboxItem>
                {categories.map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat}
                    checked={categoryFilter === cat}
                    onCheckedChange={() => setCategoryFilter(cat)}
                  >
                    <span className="capitalize">{cat}</span>
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('admin.products.brand')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={brandFilter === 'all'}
                  onCheckedChange={() => setBrandFilter('all')}
                >
                  {t('admin.products.allBrands')}
                </DropdownMenuCheckboxItem>
                {brands.map((brand) => (
                  <DropdownMenuCheckboxItem
                    key={brand}
                    checked={brandFilter === brand}
                    onCheckedChange={() => setBrandFilter(brand)}
                  >
                    {brand}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.products.columns')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(Object.keys(visibleCols) as ColumnKey[]).map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col}
                    checked={visibleCols[col]}
                    onCheckedChange={(checked) =>
                      setVisibleCols((prev) => ({ ...prev, [col]: !!checked }))
                    }
                  >
                    {colLabels[col]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="space-y-px">
            <div className="h-11 bg-surface-container-low" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-outline-variant px-4 py-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="hidden h-4 w-12 lg:block" />
                <Skeleton className="hidden h-4 w-12 lg:block" />
                <Skeleton className="hidden h-4 w-20 xl:block" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-container-low hover:bg-surface-container-low">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={products.length > 0 && selected.size === products.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {visibleCols.name && (
                      <TableHead>
                        <button onClick={() => toggleSort('name_en')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.name}
                          <SortIcon field="name_en" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.category && (
                      <TableHead>
                        <button onClick={() => toggleSort('category')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.category}
                          <SortIcon field="category" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.brand && (
                      <TableHead>
                        <button onClick={() => toggleSort('brand')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.brand}
                          <SortIcon field="brand" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.stores && (
                      <TableHead className="hidden lg:table-cell">
                        {colLabels.stores}
                      </TableHead>
                    )}
                    {visibleCols.views && (
                      <TableHead className="hidden lg:table-cell">
                        <button onClick={() => toggleSort('view_count')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.views}
                          <SortIcon field="view_count" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.saves && (
                      <TableHead className="hidden lg:table-cell">
                        <button onClick={() => toggleSort('save_count')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.saves}
                          <SortIcon field="save_count" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.createdDate && (
                      <TableHead className="hidden xl:table-cell">
                        <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.createdDate}
                          <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.actions && (
                      <TableHead className="w-16 text-center">
                        {colLabels.actions}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Object.values(visibleCols).filter(Boolean).length + 1}
                        className="py-20 text-center text-on-surface-variant"
                      >
                        {t('admin.dashboard.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow
                        key={product.id}
                        data-state={selected.has(product.id) ? 'selected' : undefined}
                      >
                        <TableCell className="w-12">
                          <Checkbox
                            checked={selected.has(product.id)}
                            onCheckedChange={() => toggleSelect(product.id)}
                            aria-label={`Select ${isRTL ? product.name_ar : product.name_en}`}
                          />
                        </TableCell>
                        {visibleCols.name && (
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
                                {product.image_urls && product.image_urls[0] ? (
                                  <img
                                    src={product.image_urls[0]}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Package className="h-5 w-5 text-on-surface-variant" />
                                )}
                              </div>
                              <span className="truncate text-sm font-medium text-on-surface">
                                {isRTL ? product.name_ar : product.name_en}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {visibleCols.category && (
                          <TableCell>
                            <CategoryBadge category={product.category} />
                          </TableCell>
                        )}
                        {visibleCols.brand && (
                          <TableCell className="text-sm text-on-surface-variant">
                            {product.brand || '-'}
                          </TableCell>
                        )}
                        {visibleCols.stores && (
                          <TableCell className="hidden text-sm tabular-nums text-on-surface-variant lg:table-cell">
                            {getStoresCount(product)}
                          </TableCell>
                        )}
                        {visibleCols.views && (
                          <TableCell className="hidden text-sm tabular-nums text-on-surface-variant lg:table-cell">
                            {formatNumber(product.view_count, locale)}
                          </TableCell>
                        )}
                        {visibleCols.saves && (
                          <TableCell className="hidden text-sm tabular-nums text-on-surface-variant lg:table-cell">
                            {formatNumber(product.save_count, locale)}
                          </TableCell>
                        )}
                        {visibleCols.createdDate && (
                          <TableCell className="hidden text-sm text-on-surface-variant xl:table-cell">
                            {formatDate(product.created_at, locale)}
                          </TableCell>
                        )}
                        {visibleCols.actions && (
                          <TableCell className="w-16 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(product)}>
                                  <Eye className="me-2 h-4 w-4" />
                                  {t('admin.products.viewDetails')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setProductToDelete(product);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="me-2 h-4 w-4" />
                                  {t('admin.products.delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-outline-variant md:hidden">
              {products.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant">
                  {t('admin.dashboard.noData')}
                </div>
              ) : (
                products.map((product) => (
                  <div key={product.id} className="flex items-start gap-3 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
                      {product.image_urls && product.image_urls[0] ? (
                        <img
                          src={product.image_urls[0]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-on-surface-variant" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {isRTL ? product.name_ar : product.name_en}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {product.brand || '-'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CategoryBadge category={product.category} />
                        <span className="text-xs tabular-nums text-on-surface-variant">
                          {getStoresCount(product)} {t('admin.products.stores')}
                        </span>
                        <span className="text-xs tabular-nums text-on-surface-variant">
                          {formatNumber(product.view_count, locale)} {t('admin.products.views')}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(product)}>
                          <Eye className="me-2 h-4 w-4" />
                          {t('admin.products.viewDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setProductToDelete(product);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="me-2 h-4 w-4" />
                          {t('admin.products.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── Footer: Rows per page + Pagination ── */}
        <div className="flex flex-col gap-3 border-t border-outline-variant px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span>{t('admin.products.rowsPerPage')}</span>
            <Select value={String(rowsPerPage)} onValueChange={(v) => setRowsPerPage(Number(v))}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info + controls */}
          <div className="flex items-center gap-4">
            <span className="text-sm tabular-nums text-on-surface-variant">
              {total === 0
                ? t('admin.dashboard.noData')
                : `${showFrom}-${showTo} / ${total}`}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="h-8 w-8 p-0"
                title="First"
              >
                <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <span className="min-w-[4rem] text-center text-sm tabular-nums text-on-surface-variant">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="h-8 w-8 p-0"
                title="Last"
              >
                <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.products.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.products.confirmDeleteDesc', {
                name: productToDelete
                  ? (isRTL ? productToDelete.name_ar : productToDelete.name_en)
                  : t('admin.products.product')
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.products.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('admin.products.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
