'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from '@/lib/simple-intl-provider';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Store,
  CheckCircle,
  Clock,
  ShieldOff,
  XCircle,
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
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StoreStatus } from '@/lib/database/types';

// ─── Types ────────────────────────────────────────────────
interface StoreRow {
  id: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  status: StoreStatus;
  total_products: number;
  average_rating: number;
  total_reviews: number;
  commission_rate: number;
  is_premium: boolean;
  is_featured: boolean;
  created_at: string;
}

interface StoreStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  inactive: number;
}

type SortField = 'name_en' | 'status' | 'total_products' | 'average_rating' | 'commission_rate' | 'created_at';
type SortDir = 'asc' | 'desc';
type ColumnKey = 'name' | 'status' | 'products' | 'rating' | 'commission' | 'premium' | 'createdDate' | 'actions';

// ─── Sub-components ───────────────────────────────────────

function StatsCard({
  title,
  value,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: number;
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
          {value.toLocaleString()}
        </p>
        <p className="truncate text-xs text-on-surface-variant">{title}</p>
      </div>
    </button>
  );
}

function StatusBadge({ status, t }: { status: StoreStatus; t: (k: string) => string }) {
  const cfg: Record<StoreStatus, string> = {
    active: 'bg-success/10 text-success',
    pending: 'bg-warning/10 text-warning',
    suspended: 'bg-error/10 text-error',
    inactive: 'bg-on-surface/10 text-on-surface-variant',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg[status]
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' ? 'bg-success' :
          status === 'pending' ? 'bg-warning' :
          status === 'suspended' ? 'bg-error' :
          'bg-on-surface-variant'
        )}
      />
      {t(`admin.stores.${status}`)}
    </span>
  );
}

function RatingDisplay({ rating, reviews }: { rating: number; reviews: number }) {
  if (!rating && !reviews) return <span className="text-sm text-on-surface-variant">-</span>;
  return (
    <div className="flex items-center gap-1.5">
      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
      <span className="text-sm tabular-nums text-on-surface">{rating.toFixed(1)}</span>
      <span className="text-xs tabular-nums text-on-surface-variant">({reviews})</span>
    </div>
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

export default function AdminStoresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState('en');
  const t = useTranslations();
  const router = useRouter();
  const isRTL = locale === 'ar';

  // Data
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StoreStats>({
    total: 0, active: 0, pending: 0, suspended: 0, inactive: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
    status: true,
    products: true,
    rating: true,
    commission: true,
    premium: true,
    createdDate: true,
    actions: true,
  });

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  // ─── Data loading ───────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const sb = getSupabaseBrowserClient();
      const [tot, act, pen, sus, ina] = await Promise.all([
        sb.from('stores').select('id', { count: 'exact', head: true }),
        sb.from('stores').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        sb.from('stores').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('stores').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
        sb.from('stores').select('id', { count: 'exact', head: true }).eq('status', 'inactive'),
      ]);
      setStats({
        total: tot.count || 0,
        active: act.count || 0,
        pending: pen.count || 0,
        suspended: sus.count || 0,
        inactive: ina.count || 0,
      });
    } catch (e) {
      console.error('Error loading stats:', e);
    }
  }, []);

  const loadStores = useCallback(async () => {
    try {
      setLoading(true);
      const sb = getSupabaseBrowserClient();

      const dbSortField = sortField === 'name_en'
        ? (isRTL ? 'name_ar' : 'name_en')
        : sortField;

      let q = sb
        .from('stores')
        .select('id, name_ar, name_en, logo_url, status, total_products, average_rating, total_reviews, commission_rate, is_premium, is_featured, created_at', { count: 'exact' });

      if (statusFilter !== 'all') q = q.eq('status', statusFilter as StoreStatus);
      if (searchQuery.trim()) {
        q = q.or(
          `name_ar.ilike.%${searchQuery}%,name_en.ilike.%${searchQuery}%`
        );
      }

      const { data, error, count } = await q
        .order(dbSortField, { ascending: sortDir === 'asc' })
        .range((page - 1) * rowsPerPage, page * rowsPerPage - 1);

      if (error) throw error;
      setStores((data as StoreRow[]) || []);
      setTotal(count || 0);
    } catch (e) {
      console.error('Error loading stores:', e);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter, searchQuery, sortField, sortDir, isRTL]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQuery, rowsPerPage]);

  // ─── Handlers ───────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleViewDetails = (store: StoreRow) => {
    router.push(`/${locale}/admin/stores/${store.id}`);
  };

  const handleStatsClick = (filter: string) => {
    setStatusFilter((p) => (p === filter ? 'all' : filter));
  };

  const toggleSelectAll = () => {
    if (selected.size === stores.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(stores.map((s) => s.id)));
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

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const showFrom = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const showTo = Math.min(page * rowsPerPage, total);

  const colLabels: Record<ColumnKey, string> = useMemo(
    () => ({
      name: t('admin.stores.name'),
      status: t('admin.stores.status'),
      products: t('admin.stores.products'),
      rating: t('admin.stores.rating'),
      commission: t('admin.stores.commission'),
      premium: t('admin.stores.premium'),
      createdDate: t('admin.stores.createdDate'),
      actions: t('admin.stores.actions'),
    }),
    [t]
  );

  const hasActiveFilter = statusFilter !== 'all' || searchQuery.trim() !== '';

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatsCard
          title={t('admin.stores.totalStores')}
          value={stats.total}
          icon={<Store className="h-5 w-5" />}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <StatsCard
          title={t('admin.stores.active')}
          value={stats.active}
          icon={<CheckCircle className="h-5 w-5" />}
          active={statusFilter === 'active'}
          onClick={() => handleStatsClick('active')}
        />
        <StatsCard
          title={t('admin.stores.pending')}
          value={stats.pending}
          icon={<Clock className="h-5 w-5" />}
          active={statusFilter === 'pending'}
          onClick={() => handleStatsClick('pending')}
        />
        <StatsCard
          title={t('admin.stores.suspended')}
          value={stats.suspended}
          icon={<ShieldOff className="h-5 w-5" />}
          active={statusFilter === 'suspended'}
          onClick={() => handleStatsClick('suspended')}
        />
        <StatsCard
          title={t('admin.stores.inactive')}
          value={stats.inactive}
          icon={<XCircle className="h-5 w-5" />}
          active={statusFilter === 'inactive'}
          onClick={() => handleStatsClick('inactive')}
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
              placeholder={t('admin.stores.searchPlaceholder')}
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
                  <span className="hidden sm:inline">{t('admin.stores.status')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t('admin.stores.status')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'active', 'pending', 'suspended', 'inactive'] as const).map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statusFilter === s}
                    onCheckedChange={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? t('admin.stores.allStatuses') : t(`admin.stores.${s}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.stores.columns')}</span>
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
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="hidden h-4 w-16 lg:block" />
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
                        checked={stores.length > 0 && selected.size === stores.length}
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
                    {visibleCols.status && (
                      <TableHead>
                        <button onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.status}
                          <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.products && (
                      <TableHead>
                        <button onClick={() => toggleSort('total_products')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.products}
                          <SortIcon field="total_products" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.rating && (
                      <TableHead className="hidden lg:table-cell">
                        <button onClick={() => toggleSort('average_rating')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.rating}
                          <SortIcon field="average_rating" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.commission && (
                      <TableHead className="hidden lg:table-cell">
                        <button onClick={() => toggleSort('commission_rate')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.commission}
                          <SortIcon field="commission_rate" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.premium && (
                      <TableHead className="hidden lg:table-cell">
                        {colLabels.premium}
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
                  {stores.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Object.values(visibleCols).filter(Boolean).length + 1}
                        className="py-20 text-center text-on-surface-variant"
                      >
                        {t('admin.dashboard.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stores.map((store) => (
                      <TableRow
                        key={store.id}
                        data-state={selected.has(store.id) ? 'selected' : undefined}
                      >
                        <TableCell className="w-12">
                          <Checkbox
                            checked={selected.has(store.id)}
                            onCheckedChange={() => toggleSelect(store.id)}
                            aria-label={`Select ${isRTL ? store.name_ar : store.name_en}`}
                          />
                        </TableCell>
                        {visibleCols.name && (
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
                                {store.logo_url ? (
                                  <img
                                    src={store.logo_url}
                                    alt=""
                                    className="h-full w-full object-contain p-1"
                                  />
                                ) : (
                                  <Store className="h-4 w-4 text-on-surface-variant" />
                                )}
                              </div>
                              <span className="truncate text-sm font-medium text-on-surface">
                                {isRTL ? store.name_ar : store.name_en}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {visibleCols.status && (
                          <TableCell>
                            <StatusBadge status={store.status} t={t} />
                          </TableCell>
                        )}
                        {visibleCols.products && (
                          <TableCell className="text-sm tabular-nums text-on-surface-variant">
                            {store.total_products.toLocaleString()}
                          </TableCell>
                        )}
                        {visibleCols.rating && (
                          <TableCell className="hidden lg:table-cell">
                            <RatingDisplay rating={store.average_rating} reviews={store.total_reviews} />
                          </TableCell>
                        )}
                        {visibleCols.commission && (
                          <TableCell className="hidden text-sm tabular-nums text-on-surface-variant lg:table-cell">
                            {store.commission_rate}%
                          </TableCell>
                        )}
                        {visibleCols.premium && (
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              {store.is_premium && (
                                <span className="inline-flex items-center rounded-full bg-tertiary/10 px-2 py-0.5 text-xs font-medium text-tertiary">
                                  {t('admin.stores.premium')}
                                </span>
                              )}
                              {store.is_featured && (
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  {t('admin.stores.featured')}
                                </span>
                              )}
                              {!store.is_premium && !store.is_featured && (
                                <span className="text-sm text-on-surface-variant">-</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {visibleCols.createdDate && (
                          <TableCell className="hidden text-sm text-on-surface-variant xl:table-cell">
                            {new Date(store.created_at).toLocaleDateString(
                              isRTL ? 'ar-SA' : 'en-US',
                              { year: 'numeric', month: 'short', day: 'numeric' }
                            )}
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
                                <DropdownMenuItem onClick={() => handleViewDetails(store)}>
                                  <Eye className="me-2 h-4 w-4" />
                                  {t('admin.stores.viewDetails')}
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
              {stores.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant">
                  {t('admin.dashboard.noData')}
                </div>
              ) : (
                stores.map((store) => (
                  <div key={store.id} className="flex items-start gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
                      {store.logo_url ? (
                        <img
                          src={store.logo_url}
                          alt=""
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <Store className="h-5 w-5 text-on-surface-variant" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {isRTL ? store.name_ar : store.name_en}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={store.status} t={t} />
                        <span className="text-xs tabular-nums text-on-surface-variant">
                          {store.total_products} {t('admin.stores.products')}
                        </span>
                        <RatingDisplay rating={store.average_rating} reviews={store.total_reviews} />
                      </div>
                      {(store.is_premium || store.is_featured) && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {store.is_premium && (
                            <span className="inline-flex items-center rounded-full bg-tertiary/10 px-2 py-0.5 text-xs font-medium text-tertiary">
                              {t('admin.stores.premium')}
                            </span>
                          )}
                          {store.is_featured && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {t('admin.stores.featured')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(store)}>
                          <Eye className="me-2 h-4 w-4" />
                          {t('admin.stores.viewDetails')}
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
            <span>{t('admin.stores.rowsPerPage')}</span>
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
    </div>
  );
}
