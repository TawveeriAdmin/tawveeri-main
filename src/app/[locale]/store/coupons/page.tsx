'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { formatDate, formatNumber } from '@/lib/formatting';
import { useToast } from '@/components/ui/use-toast';
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
import { CouponFormDialog } from '@/components/admin/coupon-form-dialog';
import { cn } from '@/lib/utils';
import { SARSymbol } from '@/components/ui/price';
import {
  Ticket,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  MoreHorizontal,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Columns3,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

interface CouponRow {
  id: string;
  store_id: string;
  code: string;
  description_ar: string | null;
  description_en: string | null;
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number | null;
  min_purchase: number | null;
  max_discount: number | null;
  is_active: boolean;
  usage_count: number;
  expires_at: string | null;
  created_at: string;
  store?: {
    id: string;
    name_ar: string;
    name_en: string;
  };
}

interface StoreOption {
  id: string;
  name_ar: string;
  name_en: string;
}

type CouponStatus = 'active' | 'inactive' | 'expired';
type SortField = 'code' | 'discount_value' | 'usage_count' | 'created_at';
type SortDir = 'asc' | 'desc';
type ColumnKey = 'code' | 'discount' | 'status' | 'usage' | 'expires' | 'actions';

// ─── Helpers ──────────────────────────────────────────────

function getCouponStatus(coupon: CouponRow): CouponStatus {
  if (!coupon.is_active) return 'inactive';
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) return 'expired';
  return 'active';
}

function formatDiscount(coupon: CouponRow, t: (key: string) => string): React.ReactNode {
  if (coupon.discount_type === 'free_shipping') return t('coupons.freeShipping');
  if (coupon.discount_type === 'percentage') return `${coupon.discount_value ?? 0}%`;
  return <span className="inline-flex items-center gap-1">{coupon.discount_value ?? 0} <SARSymbol className="w-2.5 h-2.5 fill-current" /></span>;
}

// ─── Sub-components ───────────────────────────────────────

function StatsCard({
  title,
  value,
  icon,
  active,
  onClick,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  loading: boolean;
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
        {loading ? (
          <Skeleton className="h-6 w-12" />
        ) : (
          <p className="tabular-nums text-xl font-bold text-on-surface">
            {value}
          </p>
        )}
        <p className="truncate text-xs text-on-surface-variant">{title}</p>
      </div>
    </button>
  );
}

function StatusBadge({ status, t }: { status: CouponStatus; t: (key: string) => string }) {
  const cfg: Record<CouponStatus, string> = {
    active: 'bg-success/10 text-success',
    expired: 'bg-warning/10 text-warning',
    inactive: 'bg-error/10 text-error',
  };
  const dotCfg: Record<CouponStatus, string> = {
    active: 'bg-success',
    expired: 'bg-warning',
    inactive: 'bg-error',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg[status]
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotCfg[status])} />
      {t(`coupons.status.${status}`)}
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

export default function StoreCouponsPage() {
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations();
  const { toast } = useToast();
  const isRTL = locale === 'ar';

  const API_BASE = '/api/store/coupons';

  // Data
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    code: true,
    discount: true,
    status: true,
    usage: true,
    expires: true,
    actions: true,
  });

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'activate' | 'deactivate';
    coupon: CouponRow;
  } | null>(null);

  // ─── Data loading ───────────────────────────────────────

  const loadStores = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}?stores_only=true`);
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }
    } catch (e) {
      console.error('Error loading stores:', e);
    }
  }, []);

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`${API_BASE}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch coupons');

      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (e) {
      console.error('Error loading coupons:', e);
      toast({
        title: t('common.error'),
        description: t('coupons.loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, t, toast]);

  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { loadCoupons(); }, [loadCoupons]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQuery, rowsPerPage]);

  // ─── Derived data ─────────────────────────────────────

  const filteredCoupons = useMemo(() => {
    if (statusFilter === 'all') return coupons;
    return coupons.filter((c) => getCouponStatus(c) === statusFilter);
  }, [coupons, statusFilter]);

  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => getCouponStatus(c) === 'active').length;
  const expiredCoupons = coupons.filter((c) => getCouponStatus(c) === 'expired').length;

  // Sort
  const sortedCoupons = useMemo(() => {
    const sorted = [...filteredCoupons];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'code':
          cmp = a.code.localeCompare(b.code);
          break;
        case 'discount_value':
          cmp = (a.discount_value ?? 0) - (b.discount_value ?? 0);
          break;
        case 'usage_count':
          cmp = a.usage_count - b.usage_count;
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredCoupons, sortField, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedCoupons.length / rowsPerPage));
  const showFrom = sortedCoupons.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const showTo = Math.min(page * rowsPerPage, sortedCoupons.length);
  const paginatedCoupons = sortedCoupons.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // ─── Handlers ───────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleAdd = () => {
    setEditingCoupon(null);
    setFormOpen(true);
  };

  const handleEdit = (coupon: CouponRow) => {
    setEditingCoupon(coupon);
    setFormOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, coupon } = confirmAction;
    setConfirmAction(null);

    try {
      if (type === 'delete') {
        const res = await fetch(`${API_BASE}/${coupon.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete coupon');
        }
        toast({ title: t('coupons.deleted'), description: t('coupons.deleteSuccess') });
      } else {
        const newActive = type === 'activate';
        const res = await fetch(`${API_BASE}/${coupon.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: newActive }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update coupon');
        }
        toast({
          title: t('coupons.updated'),
          description: newActive ? t('coupons.activated') : t('coupons.deactivated'),
        });
      }
      loadCoupons();
    } catch (error) {
      console.error(`Error ${type} coupon:`, error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : type === 'delete' ? t('coupons.deleteError') : t('coupons.updateError'),
        variant: 'destructive',
      });
    }
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingCoupon(null);
    loadCoupons();
  };

  const handleStatsClick = (filter: string) => {
    setStatusFilter((p) => (p === filter ? 'all' : filter));
  };

  const toggleSelectAll = () => {
    if (selected.size === paginatedCoupons.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginatedCoupons.map((c) => c.id)));
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

  const hasActiveFilter = statusFilter !== 'all' || searchQuery.trim() !== '';

  const colLabels: Record<ColumnKey, string> = useMemo(
    () => ({
      code: t('coupons.code'),
      discount: t('coupons.discount'),
      status: t('coupons.statusLabel'),
      usage: t('coupons.usageCount'),
      expires: t('coupons.expires'),
      actions: t('coupons.actions'),
    }),
    [t]
  );

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">{t('coupons.title')}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{t('coupons.subtitle')}</p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('coupons.addCoupon')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatsCard
          title={t('coupons.totalCoupons')}
          value={formatNumber(totalCoupons, locale)}
          icon={<Ticket className="h-5 w-5" />}
          loading={loading}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <StatsCard
          title={t('coupons.activeCoupons')}
          value={formatNumber(activeCoupons, locale)}
          icon={<CheckCircle className="h-5 w-5" />}
          loading={loading}
          active={statusFilter === 'active'}
          onClick={() => handleStatsClick('active')}
        />
        <StatsCard
          title={t('coupons.expiredCoupons')}
          value={formatNumber(expiredCoupons, locale)}
          icon={<Clock className="h-5 w-5" />}
          loading={loading}
          active={statusFilter === 'expired'}
          onClick={() => handleStatsClick('expired')}
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
              placeholder={t('coupons.searchPlaceholder')}
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
                  <span className="hidden sm:inline">{t('coupons.statusLabel')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t('coupons.statusLabel')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'active', 'inactive', 'expired'] as const).map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statusFilter === s}
                    onCheckedChange={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? t('coupons.allStatuses') : t(`coupons.status.${s}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('coupons.columns')}</span>
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
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="hidden h-4 w-24 lg:block" />
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
                        checked={paginatedCoupons.length > 0 && selected.size === paginatedCoupons.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {visibleCols.code && (
                      <TableHead>
                        <button onClick={() => toggleSort('code')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.code}
                          <SortIcon field="code" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.discount && (
                      <TableHead>
                        <button onClick={() => toggleSort('discount_value')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.discount}
                          <SortIcon field="discount_value" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.status && (
                      <TableHead>{colLabels.status}</TableHead>
                    )}
                    {visibleCols.usage && (
                      <TableHead>
                        <button onClick={() => toggleSort('usage_count')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.usage}
                          <SortIcon field="usage_count" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.expires && (
                      <TableHead className="hidden lg:table-cell">{colLabels.expires}</TableHead>
                    )}
                    {visibleCols.actions && (
                      <TableHead className="w-16 text-center">{colLabels.actions}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCoupons.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Object.values(visibleCols).filter(Boolean).length + 1}
                        className="py-20 text-center text-on-surface-variant"
                      >
                        {t('coupons.noCoupons')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCoupons.map((coupon) => {
                      const status = getCouponStatus(coupon);
                      return (
                        <TableRow
                          key={coupon.id}
                          data-state={selected.has(coupon.id) ? 'selected' : undefined}
                        >
                          <TableCell className="w-12">
                            <Checkbox
                              checked={selected.has(coupon.id)}
                              onCheckedChange={() => toggleSelect(coupon.id)}
                              aria-label={`Select ${coupon.code}`}
                            />
                          </TableCell>
                          {visibleCols.code && (
                            <TableCell>
                              <span className="font-mono text-sm font-medium text-on-surface">
                                {coupon.code}
                              </span>
                            </TableCell>
                          )}
                          {visibleCols.discount && (
                            <TableCell className="text-sm tabular-nums text-on-surface-variant">
                              {formatDiscount(coupon, t)}
                            </TableCell>
                          )}
                          {visibleCols.status && (
                            <TableCell>
                              <StatusBadge status={status} t={t} />
                            </TableCell>
                          )}
                          {visibleCols.usage && (
                            <TableCell className="text-sm tabular-nums text-on-surface-variant">
                              {coupon.usage_count}
                            </TableCell>
                          )}
                          {visibleCols.expires && (
                            <TableCell className="hidden text-sm text-on-surface-variant lg:table-cell">
                              {coupon.expires_at
                                ? formatDate(coupon.expires_at, locale)
                                : t('coupons.noExpiry')}
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
                                  <DropdownMenuItem onClick={() => handleEdit(coupon)}>
                                    <Pencil className="me-2 h-4 w-4" />
                                    {t('coupons.edit')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirmAction({
                                        type: coupon.is_active ? 'deactivate' : 'activate',
                                        coupon,
                                      })
                                    }
                                  >
                                    <Power className="me-2 h-4 w-4" />
                                    {coupon.is_active ? t('coupons.deactivate') : t('coupons.activate')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-error focus:text-error"
                                    onClick={() =>
                                      setConfirmAction({ type: 'delete', coupon })
                                    }
                                  >
                                    <Trash2 className="me-2 h-4 w-4" />
                                    {t('coupons.delete')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-outline-variant md:hidden">
              {paginatedCoupons.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant">
                  {t('coupons.noCoupons')}
                </div>
              ) : (
                paginatedCoupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  return (
                    <div key={coupon.id} className="flex items-start gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Ticket className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-medium text-on-surface">
                          {coupon.code}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusBadge status={status} t={t} />
                          <span className="text-xs tabular-nums text-on-surface-variant">
                            {formatDiscount(coupon, t)}
                          </span>
                          <span className="text-xs tabular-nums text-on-surface-variant">
                            {t('coupons.used')}: {coupon.usage_count}
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
                          <DropdownMenuItem onClick={() => handleEdit(coupon)}>
                            <Pencil className="me-2 h-4 w-4" />
                            {t('coupons.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setConfirmAction({
                                type: coupon.is_active ? 'deactivate' : 'activate',
                                coupon,
                              })
                            }
                          >
                            <Power className="me-2 h-4 w-4" />
                            {coupon.is_active ? t('coupons.deactivate') : t('coupons.activate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-error focus:text-error"
                            onClick={() =>
                              setConfirmAction({ type: 'delete', coupon })
                            }
                          >
                            <Trash2 className="me-2 h-4 w-4" />
                            {t('coupons.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── Footer: Rows per page + Pagination ── */}
        <div className="flex flex-col gap-3 border-t border-outline-variant px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span>{t('coupons.rowsPerPage')}</span>
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
              {sortedCoupons.length === 0
                ? t('coupons.noCoupons')
                : `${showFrom}-${showTo} / ${sortedCoupons.length}`}
            </span>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page <= 1} className="h-8 w-8 p-0" title="First">
                <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <span className="min-w-[4rem] text-center text-sm tabular-nums text-on-surface-variant">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="h-8 w-8 p-0" title="Last">
                <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Coupon Form Dialog */}
      <CouponFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingCoupon(null);
        }}
        coupon={editingCoupon}
        stores={stores}
        locale={locale}
        onSuccess={handleFormSuccess}
        apiEndpoint={API_BASE}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'delete'
                ? t('coupons.confirmDelete')
                : confirmAction?.type === 'activate'
                  ? t('coupons.confirmActivate')
                  : t('coupons.confirmDeactivate')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete'
                ? t('coupons.confirmDeleteDesc')
                : confirmAction?.type === 'activate'
                  ? t('coupons.confirmActivateDesc')
                  : t('coupons.confirmDeactivateDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('coupons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmAction?.type === 'delete' ? 'bg-error text-white hover:bg-error/90' : ''}
            >
              {confirmAction?.type === 'delete' ? t('coupons.delete') : t('coupons.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
