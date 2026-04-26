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
import { ProductIdentity } from '@/components/products/shared-product-card';
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
  X,
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
        'group flex min-h-[104px] items-center gap-3 rounded-2xl border p-4 text-start transition-all duration-200 active:scale-[0.99]',
        active
          ? 'border-[#55b295] bg-[#eaf7f2] ring-1 ring-[#55b295]/25 dark:border-[#55b295] dark:bg-[#17382e] dark:ring-[#55b295]/20'
          : 'border-[#d7ece5] bg-white hover:border-[#9fd9c9] dark:border-[#263b33] dark:bg-[#141c18] dark:hover:border-[#3f6657]'
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
          active
            ? 'bg-[#55b295] text-white'
            : 'bg-[#eaf7f2] text-[#1f6f59] dark:bg-[#1d2a23] dark:text-[#9fe4d0]'
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-2xl font-black tabular-nums text-on-surface dark:text-white">
          {value}
        </p>
        <p className="truncate text-xs font-bold text-on-surface-variant dark:text-white/55">{title}</p>
      </div>
    </button>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex max-w-[180px] items-center rounded-full bg-[#eaf7f2] px-2.5 py-1 text-xs font-black capitalize text-[#1f6f59] dark:bg-[#17382e] dark:text-[#9fe4d0]">
      <span className="truncate">{category || '-'}</span>
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
      const viewRows = (viewsRes.data || []) as Array<{ view_count: number | null }>;
      const saveRows = (savesRes.data || []) as Array<{ save_count: number | null }>;

      setStats({
        total: totalRes.count || 0,
        withDeals: dealsRes.count || 0,
        totalViews: viewRows.reduce((sum, p) => sum + (p.view_count || 0), 0),
        totalSaves: saveRows.reduce((sum, p) => sum + (p.save_count || 0), 0),
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
      const categoryRows = (catRes.data || []) as Array<{ category: string | null }>;
      const brandRows = (brandRes.data || []) as Array<{ brand: string | null }>;
      const uniqueCats = Array.from(new Set(categoryRows.map((p) => p.category).filter((value): value is string => Boolean(value))));
      const uniqueBrands = Array.from(new Set(brandRows.map((p) => p.brand).filter((value): value is string => Boolean(value))));
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
      setProducts((data as unknown as Product[]) || []);
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
  const activeFilterLabel = categoryFilter !== 'all'
    ? categoryFilter
    : brandFilter !== 'all'
      ? brandFilter
      : t('admin.products.allCategories');

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setBrandFilter('all');
  };

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59] dark:text-[#9fe4d0]">
              {isRTL ? 'كتالوج المنتجات' : 'Catalog operations'}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-on-surface md:text-3xl dark:text-white">
              {t('admin.products.title')}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-on-surface-variant dark:text-white/60">
              {isRTL
                ? 'راجع المنتجات، الفئات، العلامات، وحضور المنتج في المتاجر من مساحة واحدة واضحة.'
                : 'Review products, categories, brands, and store coverage from one focused workspace.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#d7ece5] bg-[#f8fcfa] px-3 py-1.5 text-xs font-black text-on-surface-variant dark:border-[#263b33] dark:bg-[#101713] dark:text-white/60">
              {formatNumber(total, locale)} {isRTL ? 'نتيجة' : 'results'}
            </span>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe7dc] bg-[#eaf7f2] px-3 py-1.5 text-xs font-black text-[#1f6f59] transition-colors hover:border-[#55b295] dark:border-[#315145] dark:bg-[#17382e] dark:text-[#9fe4d0]"
              >
                <X className="h-3.5 w-3.5" />
                <span className="max-w-[180px] truncate">{activeFilterLabel}</span>
              </button>
            )}
          </div>
        </div>
      </section>

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
      <div className="overflow-hidden rounded-[1.35rem] border border-[#d7ece5] bg-white dark:border-[#263b33] dark:bg-[#141c18]">

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 border-b border-[#e1f0eb] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#263b33]">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant dark:text-white/45" />
            <Input
              placeholder={t('admin.products.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-2xl border-[#d7ece5] bg-[#f8fcfa] ps-9 font-semibold dark:border-[#263b33] dark:bg-[#101713] dark:text-white dark:placeholder:text-white/35"
            />
          </div>

          {/* Toolbar actions */}
          <div className="flex items-center gap-2">
            {/* Filters dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-11 gap-1.5 rounded-2xl border-[#d7ece5] bg-white px-4 font-black dark:border-[#263b33] dark:bg-[#101713] dark:text-white',
                    hasActiveFilter && 'border-[#55b295] text-[#1f6f59] dark:border-[#55b295] dark:text-[#9fe4d0]'
                  )}
                >
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
                <Button variant="outline" size="sm" className="h-11 gap-1.5 rounded-2xl border-[#d7ece5] bg-white px-4 font-black dark:border-[#263b33] dark:bg-[#101713] dark:text-white">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.products.columns')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
            <div className="h-11 bg-[#f8fcfa] dark:bg-[#101713]" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-[#e1f0eb] px-4 py-3 dark:border-[#263b33]">
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
                  <TableRow className="border-[#e1f0eb] bg-[#f8fcfa] hover:bg-[#f8fcfa] dark:border-[#263b33] dark:bg-[#101713] dark:hover:bg-[#101713]">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={products.length > 0 && selected.size === products.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {visibleCols.name && (
                      <TableHead>
                        <button onClick={() => toggleSort('name_en')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.name}
                          <SortIcon field="name_en" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.category && (
                      <TableHead>
                        <button onClick={() => toggleSort('category')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.category}
                          <SortIcon field="category" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.brand && (
                      <TableHead>
                        <button onClick={() => toggleSort('brand')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.brand}
                          <SortIcon field="brand" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.stores && (
                      <TableHead className="hidden font-black text-on-surface-variant dark:text-white/60 lg:table-cell">
                        {colLabels.stores}
                      </TableHead>
                    )}
                    {visibleCols.views && (
                      <TableHead className="hidden lg:table-cell">
                        <button onClick={() => toggleSort('view_count')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.views}
                          <SortIcon field="view_count" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.saves && (
                      <TableHead className="hidden lg:table-cell">
                        <button onClick={() => toggleSort('save_count')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.saves}
                          <SortIcon field="save_count" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.createdDate && (
                      <TableHead className="hidden xl:table-cell">
                        <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.createdDate}
                          <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.actions && (
                      <TableHead className="w-16 text-center font-black text-on-surface-variant dark:text-white/60">
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
                        className="py-20 text-center text-on-surface-variant dark:text-white/60"
                      >
                        {t('admin.dashboard.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow
                        key={product.id}
                        data-state={selected.has(product.id) ? 'selected' : undefined}
                        className="border-[#e1f0eb] transition-colors hover:bg-[#f8fcfa] data-[state=selected]:bg-[#eaf7f2] dark:border-[#263b33] dark:hover:bg-[#101713] dark:data-[state=selected]:bg-[#17382e]"
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
                            <ProductIdentity
                              product={product}
                              locale={locale}
                              imageSizeClassName="h-10 w-10"
                              titleClassName="font-black dark:text-white"
                              subtitleClassName="dark:text-white/50"
                              fallbackIcon={<Package className="h-5 w-5" />}
                            />
                          </TableCell>
                        )}
                        {visibleCols.category && (
                          <TableCell>
                            <CategoryBadge category={product.category} />
                          </TableCell>
                        )}
                        {visibleCols.brand && (
                          <TableCell className="text-sm font-semibold text-on-surface-variant dark:text-white/60">
                            {product.brand || '-'}
                          </TableCell>
                        )}
                        {visibleCols.stores && (
                          <TableCell className="hidden font-mono text-sm tabular-nums text-on-surface-variant dark:text-white/60 lg:table-cell">
                            {getStoresCount(product)}
                          </TableCell>
                        )}
                        {visibleCols.views && (
                          <TableCell className="hidden font-mono text-sm tabular-nums text-on-surface-variant dark:text-white/60 lg:table-cell">
                            {formatNumber(product.view_count, locale)}
                          </TableCell>
                        )}
                        {visibleCols.saves && (
                          <TableCell className="hidden font-mono text-sm tabular-nums text-on-surface-variant dark:text-white/60 lg:table-cell">
                            {formatNumber(product.save_count, locale)}
                          </TableCell>
                        )}
                        {visibleCols.createdDate && (
                          <TableCell className="hidden text-sm font-semibold text-on-surface-variant dark:text-white/55 xl:table-cell">
                            {formatDate(product.created_at, locale)}
                          </TableCell>
                        )}
                        {visibleCols.actions && (
                          <TableCell className="w-16 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-9 w-9 rounded-xl p-0 dark:text-white/70 dark:hover:bg-white/8">
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
            <div className="divide-y divide-[#e1f0eb] dark:divide-[#263b33] md:hidden">
              {products.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant dark:text-white/60">
                  {t('admin.dashboard.noData')}
                </div>
              ) : (
                products.map((product) => (
                  <div key={product.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <ProductIdentity
                        product={product}
                        locale={locale}
                        imageSizeClassName="h-12 w-12"
                        titleClassName="font-black dark:text-white"
                        subtitleClassName="dark:text-white/50"
                        fallbackIcon={<Package className="h-5 w-5" />}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CategoryBadge category={product.category} />
                        <span className="font-mono text-xs tabular-nums text-on-surface-variant dark:text-white/55">
                          {getStoresCount(product)} {t('admin.products.stores')}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-on-surface-variant dark:text-white/55">
                          {formatNumber(product.view_count, locale)} {t('admin.products.views')}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 rounded-xl p-0 dark:text-white/70 dark:hover:bg-white/8">
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
        <div className="flex flex-col gap-3 border-t border-[#e1f0eb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#263b33]">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant dark:text-white/60">
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
            <span className="font-mono text-sm tabular-nums text-on-surface-variant dark:text-white/60">
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
              <span className="min-w-[4rem] text-center font-mono text-sm tabular-nums text-on-surface-variant dark:text-white/60">
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
