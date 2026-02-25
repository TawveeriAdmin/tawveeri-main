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
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useToast } from '@/components/ui/use-toast';
import { Price } from '@/components/ui/price';
import {
  ArrowRightLeft,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Columns3,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatNumber } from '@/lib/formatting';
import type { TransactionStatus } from '@/lib/database/types';

// ─── Types ────────────────────────────────────────────────
interface Transaction {
  id: string;
  amount: number;
  commission_amount: number | null;
  commission_rate: number | null;
  status: TransactionStatus;
  clicked_at: string | null;
  converted_at: string | null;
  created_at: string;
  product_stores?: {
    id: string;
    current_price: number;
    products?: {
      id: string;
      name_ar: string;
      name_en: string;
    };
    stores?: {
      id: string;
      name_ar: string;
      name_en: string;
    };
  };
  users?: {
    id: string;
    email: string | null;
    full_name: string | null;
  };
}

interface TransactionStats {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  refunded: number;
}

type SortField = 'amount' | 'commission_amount' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';
type ColumnKey = 'product' | 'store' | 'user' | 'amount' | 'commission' | 'commissionRate' | 'status' | 'date' | 'actions';

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

function TransactionStatusBadge({ status, t }: { status: TransactionStatus; t: (k: string) => string }) {
  const cfg: Record<TransactionStatus, string> = {
    completed: 'bg-success/10 text-success',
    pending: 'bg-warning/10 text-warning',
    failed: 'bg-error/10 text-error',
    refunded: 'bg-on-surface/10 text-on-surface-variant',
  };
  const dotCfg: Record<TransactionStatus, string> = {
    completed: 'bg-success',
    pending: 'bg-warning',
    failed: 'bg-error',
    refunded: 'bg-on-surface-variant',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg[status]
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotCfg[status])} />
      {t(`admin.transactions.${status}`)}
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

export default function AdminTransactionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState('en');
  const t = useTranslations();
  const { toast } = useToast();
  const isRTL = locale === 'ar';

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TransactionStats>({
    total: 0, completed: 0, pending: 0, failed: 0, refunded: 0,
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
    product: true,
    store: true,
    user: true,
    amount: true,
    commission: true,
    commissionRate: true,
    status: true,
    date: true,
    actions: false,
  });

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Export
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  // ─── Data loading ───────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const sb = getSupabaseBrowserClient();
      const [tot, comp, pen, fail, ref] = await Promise.all([
        sb.from('transactions').select('id', { count: 'exact', head: true }),
        sb.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        sb.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        sb.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'refunded'),
      ]);
      setStats({
        total: tot.count || 0,
        completed: comp.count || 0,
        pending: pen.count || 0,
        failed: fail.count || 0,
        refunded: ref.count || 0,
      });
    } catch (e) {
      console.error('Error loading stats:', e);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const sb = getSupabaseBrowserClient();

      let q = sb
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
            ),
            stores (
              id,
              name_ar,
              name_en
            )
          ),
          users (
            id,
            email,
            full_name
          )
        `,
          { count: 'exact' }
        );

      if (statusFilter !== 'all') q = q.eq('status', statusFilter as TransactionStatus);

      const { data, error, count } = await q
        .order(sortField, { ascending: sortDir === 'asc' })
        .range((page - 1) * rowsPerPage, page * rowsPerPage - 1);

      if (error) throw error;
      setTransactions((data as Transaction[]) || []);
      setTotal(count || 0);
    } catch (e) {
      console.error('Error loading transactions:', e);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter, sortField, sortDir]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQuery, rowsPerPage]);

  // ─── Client-side search filter on loaded data ───────────
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.id.toLowerCase().includes(q) ||
        tx.product_stores?.products?.name_en?.toLowerCase().includes(q) ||
        tx.product_stores?.products?.name_ar?.toLowerCase().includes(q) ||
        tx.product_stores?.stores?.name_en?.toLowerCase().includes(q) ||
        tx.product_stores?.stores?.name_ar?.toLowerCase().includes(q) ||
        tx.users?.email?.toLowerCase().includes(q) ||
        tx.users?.full_name?.toLowerCase().includes(q)
    );
  }, [transactions, searchQuery]);

  // ─── Handlers ───────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleStatsClick = (filter: string) => {
    setStatusFilter((p) => (p === filter ? 'all' : filter));
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const exportParams = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        exportParams.append('status', statusFilter);
      }

      const response = await fetch(`/api/admin/transactions/export?${exportParams.toString()}`);

      if (!response.ok) {
        if (response.status === 403) throw new Error(t('admin.transactions.unauthorized'));
        if (response.status === 404) throw new Error(t('admin.transactions.noTransactions'));
        throw new Error(t('admin.transactions.exportFailed'));
      }

      const csvContent = await response.text();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'transactions_export.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) filename = filenameMatch[1];
      }

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: t('admin.transactions.exportSuccess'),
        description: t('admin.transactions.exportSuccessDesc'),
      });
    } catch (error) {
      console.error('Error exporting transactions:', error);
      toast({
        title: t('admin.transactions.exportError'),
        description: error instanceof Error ? error.message : t('admin.transactions.exportErrorDesc'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredTransactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredTransactions.map((tx) => tx.id)));
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
      product: t('admin.transactions.product'),
      store: t('admin.transactions.store'),
      user: t('admin.transactions.user'),
      amount: t('admin.transactions.amount'),
      commission: t('admin.transactions.commission'),
      commissionRate: t('admin.transactions.commissionRate'),
      status: t('admin.transactions.status'),
      date: t('admin.transactions.date'),
      actions: t('admin.transactions.actions'),
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
          title={t('admin.transactions.totalTransactions')}
          value={formatNumber(stats.total, locale)}
          icon={<ArrowRightLeft className="h-5 w-5" />}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <StatsCard
          title={t('admin.transactions.completed')}
          value={formatNumber(stats.completed, locale)}
          icon={<CheckCircle className="h-5 w-5" />}
          active={statusFilter === 'completed'}
          onClick={() => handleStatsClick('completed')}
        />
        <StatsCard
          title={t('admin.transactions.pending')}
          value={formatNumber(stats.pending, locale)}
          icon={<Clock className="h-5 w-5" />}
          active={statusFilter === 'pending'}
          onClick={() => handleStatsClick('pending')}
        />
        <StatsCard
          title={t('admin.transactions.failed')}
          value={formatNumber(stats.failed, locale)}
          icon={<XCircle className="h-5 w-5" />}
          active={statusFilter === 'failed'}
          onClick={() => handleStatsClick('failed')}
        />
        <StatsCard
          title={t('admin.transactions.refunded')}
          value={formatNumber(stats.refunded, locale)}
          icon={<RotateCcw className="h-5 w-5" />}
          active={statusFilter === 'refunded'}
          onClick={() => handleStatsClick('refunded')}
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
              placeholder={t('admin.transactions.searchPlaceholder')}
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
                  <span className="hidden sm:inline">{t('admin.transactions.status')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t('admin.transactions.status')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'completed', 'pending', 'failed', 'refunded'] as const).map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statusFilter === s}
                    onCheckedChange={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? t('admin.transactions.allStatuses') : t(`admin.transactions.${s}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.transactions.columns')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(Object.keys(visibleCols) as ColumnKey[]).filter((c) => c !== 'actions').map((col) => (
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

            {/* Export button */}
            <Button
              onClick={handleExport}
              disabled={exporting || total === 0}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">
                {exporting ? t('admin.transactions.exporting') : t('admin.transactions.export')}
              </span>
            </Button>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="space-y-px">
            <div className="h-11 bg-surface-container-low" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-outline-variant px-4 py-3">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="hidden h-4 w-16 lg:block" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="hidden h-4 w-24 xl:block" />
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
                        checked={filteredTransactions.length > 0 && selected.size === filteredTransactions.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {visibleCols.product && (
                      <TableHead>{colLabels.product}</TableHead>
                    )}
                    {visibleCols.store && (
                      <TableHead className="hidden lg:table-cell">{colLabels.store}</TableHead>
                    )}
                    {visibleCols.user && (
                      <TableHead className="hidden lg:table-cell">{colLabels.user}</TableHead>
                    )}
                    {visibleCols.amount && (
                      <TableHead>
                        <button onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.amount}
                          <SortIcon field="amount" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.commission && (
                      <TableHead className="hidden xl:table-cell">
                        <button onClick={() => toggleSort('commission_amount')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.commission}
                          <SortIcon field="commission_amount" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.commissionRate && (
                      <TableHead className="hidden xl:table-cell">
                        {colLabels.commissionRate}
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
                    {visibleCols.date && (
                      <TableHead className="hidden xl:table-cell">
                        <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.date}
                          <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Object.values(visibleCols).filter(Boolean).length + 1}
                        className="py-20 text-center text-on-surface-variant"
                      >
                        {t('admin.dashboard.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const product = tx.product_stores?.products;
                      const store = tx.product_stores?.stores;
                      const user = tx.users;
                      return (
                        <TableRow
                          key={tx.id}
                          data-state={selected.has(tx.id) ? 'selected' : undefined}
                        >
                          <TableCell className="w-12">
                            <Checkbox
                              checked={selected.has(tx.id)}
                              onCheckedChange={() => toggleSelect(tx.id)}
                              aria-label={`Select transaction`}
                            />
                          </TableCell>
                          {visibleCols.product && (
                            <TableCell>
                              <span className="truncate text-sm font-medium text-on-surface">
                                {product ? (isRTL ? product.name_ar : product.name_en) : '-'}
                              </span>
                            </TableCell>
                          )}
                          {visibleCols.store && (
                            <TableCell className="hidden text-sm text-on-surface-variant lg:table-cell">
                              {store ? (isRTL ? store.name_ar : store.name_en) : '-'}
                            </TableCell>
                          )}
                          {visibleCols.user && (
                            <TableCell className="hidden text-sm text-on-surface-variant lg:table-cell">
                              {user?.full_name || user?.email || '-'}
                            </TableCell>
                          )}
                          {visibleCols.amount && (
                            <TableCell>
                              <Price amount={tx.amount} className="text-sm font-medium tabular-nums text-on-surface" />
                            </TableCell>
                          )}
                          {visibleCols.commission && (
                            <TableCell className="hidden xl:table-cell">
                              <Price amount={tx.commission_amount || 0} className="text-sm tabular-nums text-on-surface-variant" />
                            </TableCell>
                          )}
                          {visibleCols.commissionRate && (
                            <TableCell className="hidden text-sm tabular-nums text-on-surface-variant xl:table-cell">
                              {tx.commission_rate || 0}%
                            </TableCell>
                          )}
                          {visibleCols.status && (
                            <TableCell>
                              <TransactionStatusBadge status={tx.status} t={t} />
                            </TableCell>
                          )}
                          {visibleCols.date && (
                            <TableCell className="hidden text-sm text-on-surface-variant xl:table-cell">
                              {formatDate(tx.created_at, locale, 'datetime')}
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
              {filteredTransactions.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant">
                  {t('admin.dashboard.noData')}
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const product = tx.product_stores?.products;
                  const store = tx.product_stores?.stores;
                  const user = tx.users;
                  return (
                    <div key={tx.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-on-surface">
                            {product ? (isRTL ? product.name_ar : product.name_en) : '-'}
                          </p>
                          <p className="truncate text-xs text-on-surface-variant">
                            {store ? (isRTL ? store.name_ar : store.name_en) : '-'}
                          </p>
                        </div>
                        <TransactionStatusBadge status={tx.status} t={t} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Price amount={tx.amount} className="text-sm font-medium tabular-nums text-on-surface" />
                        {tx.commission_amount ? (
                          <span className="text-xs text-on-surface-variant">
                            {t('admin.transactions.commission')}: <Price amount={tx.commission_amount} className="inline text-xs tabular-nums" />
                          </span>
                        ) : null}
                        <span className="text-xs text-on-surface-variant">
                          {user?.full_name || user?.email || '-'}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        {formatDate(tx.created_at, locale, 'datetime')}
                      </p>
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
            <span>{t('admin.transactions.rowsPerPage')}</span>
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
