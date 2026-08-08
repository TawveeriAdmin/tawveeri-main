'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
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
import {
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatting';

// ─── Types ────────────────────────────────────────────────
interface AuditLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user_id: string | null;
  users?: {
    email: string | null;
    full_name: string | null;
    role: string;
  };
}

type SortField = 'action' | 'entity_type' | 'created_at';
type SortDir = 'asc' | 'desc';
type ColumnKey = 'date' | 'action' | 'entityType' | 'user' | 'details';

// ─── Sub-components ───────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const color = action.includes('delete') || action.includes('removed')
    ? 'bg-error/10 text-error'
    : action.includes('create') || action.includes('added') || action.includes('signup')
      ? 'bg-success/10 text-success'
      : action.includes('update') || action.includes('changed')
        ? 'bg-warning/10 text-warning'
        : 'bg-primary/10 text-primary';

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', color)}>
      {action}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-sm text-on-surface-variant">-</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-on-surface/8 px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
      {type}
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

export default function AdminLogsPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = use(props.params);
  const [locale, setLocale] = useState('en');
  const t = useTranslations();
  const isRTL = locale === 'ar';

  // Data
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic filter options
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    date: true,
    action: true,
    entityType: true,
    user: true,
    details: true,
  });

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocale(params.locale);
  }, [params]);

  // ─── Load filter options ────────────────────────────────
  const loadFilterOptions = useCallback(async () => {
    try {
      const sb = getSupabaseBrowserClient();
      const [actRes, entRes] = await Promise.all([
        sb.from('admin_logs').select('action'),
        sb.from('admin_logs').select('entity_type'),
      ]);
      const uniqueActions = Array.from(new Set((actRes.data || []).map((r: any) => r.action).filter(Boolean)));
      const uniqueTypes = Array.from(new Set((entRes.data || []).map((r: any) => r.entity_type).filter(Boolean)));
      setActions(uniqueActions.sort());
      setEntityTypes(uniqueTypes.sort());
    } catch (e) {
      console.error('Error loading filter options:', e);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const sb = getSupabaseBrowserClient();

      let q = sb
        .from('admin_logs')
        .select(
          `
          *,
          users (
            email,
            full_name,
            role
          )
        `,
          { count: 'exact' }
        );

      if (actionFilter !== 'all') q = q.eq('action', actionFilter);
      if (entityTypeFilter !== 'all') q = q.eq('entity_type', entityTypeFilter);

      const { data, error, count } = await q
        .order(sortField, { ascending: sortDir === 'asc' })
        .range((page - 1) * rowsPerPage, page * rowsPerPage - 1);

      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
      setTotal(count || 0);
    } catch (e) {
      console.error('Error loading logs:', e);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, actionFilter, entityTypeFilter, sortField, sortDir]);

  useEffect(() => { loadFilterOptions(); }, [loadFilterOptions]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { setPage(1); }, [actionFilter, entityTypeFilter, searchQuery, rowsPerPage]);

  // ─── Client-side search on loaded data ──────────────────
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.entity_type?.toLowerCase().includes(q) ||
        log.users?.email?.toLowerCase().includes(q) ||
        log.users?.full_name?.toLowerCase().includes(q) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(q))
    );
  }, [logs, searchQuery]);

  // ─── Handlers ───────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredLogs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLogs.map((l) => l.id)));
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
      date: t('admin.logs.date'),
      action: t('admin.logs.action'),
      entityType: t('admin.logs.entityType'),
      user: t('admin.logs.user'),
      details: t('admin.logs.details'),
    }),
    [t]
  );

  const hasActiveFilter = actionFilter !== 'all' || entityTypeFilter !== 'all' || searchQuery.trim() !== '';

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── DataTable Card ── */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              placeholder={t('admin.logs.searchPlaceholder')}
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
                  <span className="hidden sm:inline">{t('admin.logs.action')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                <DropdownMenuLabel>{t('admin.logs.action')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={actionFilter === 'all'}
                  onCheckedChange={() => setActionFilter('all')}
                >
                  {t('admin.logs.allActions')}
                </DropdownMenuCheckboxItem>
                {actions.map((action) => (
                  <DropdownMenuCheckboxItem
                    key={action}
                    checked={actionFilter === action}
                    onCheckedChange={() => setActionFilter(action)}
                  >
                    {action}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('admin.logs.entityType')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={entityTypeFilter === 'all'}
                  onCheckedChange={() => setEntityTypeFilter('all')}
                >
                  {t('admin.logs.allTypes')}
                </DropdownMenuCheckboxItem>
                {entityTypes.map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={entityTypeFilter === type}
                    onCheckedChange={() => setEntityTypeFilter(type)}
                  >
                    {type}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.logs.columns')}</span>
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
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="hidden h-4 w-28 lg:block" />
                <Skeleton className="hidden h-4 w-40 xl:block" />
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
                        checked={filteredLogs.length > 0 && selected.size === filteredLogs.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {visibleCols.date && (
                      <TableHead>
                        <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.date}
                          <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.action && (
                      <TableHead>
                        <button onClick={() => toggleSort('action')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.action}
                          <SortIcon field="action" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.entityType && (
                      <TableHead>
                        <button onClick={() => toggleSort('entity_type')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.entityType}
                          <SortIcon field="entity_type" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.user && (
                      <TableHead className="hidden lg:table-cell">{colLabels.user}</TableHead>
                    )}
                    {visibleCols.details && (
                      <TableHead className="hidden xl:table-cell">{colLabels.details}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Object.values(visibleCols).filter(Boolean).length + 1}
                        className="py-20 text-center text-on-surface-variant"
                      >
                        {t('admin.dashboard.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => {
                      const user = log.users;
                      return (
                        <TableRow
                          key={log.id}
                          data-state={selected.has(log.id) ? 'selected' : undefined}
                        >
                          <TableCell className="w-12">
                            <Checkbox
                              checked={selected.has(log.id)}
                              onCheckedChange={() => toggleSelect(log.id)}
                              aria-label="Select log"
                            />
                          </TableCell>
                          {visibleCols.date && (
                            <TableCell className="text-sm tabular-nums text-on-surface-variant whitespace-nowrap">
                              {formatDate(log.created_at, locale, 'datetime')}
                            </TableCell>
                          )}
                          {visibleCols.action && (
                            <TableCell>
                              <ActionBadge action={log.action} />
                            </TableCell>
                          )}
                          {visibleCols.entityType && (
                            <TableCell>
                              <EntityTypeBadge type={log.entity_type} />
                            </TableCell>
                          )}
                          {visibleCols.user && (
                            <TableCell className="hidden text-sm text-on-surface-variant lg:table-cell">
                              {user?.full_name || user?.email || t('admin.logs.system')}
                            </TableCell>
                          )}
                          {visibleCols.details && (
                            <TableCell className="hidden max-w-xs xl:table-cell">
                              {log.details ? (
                                <p className="truncate text-xs text-on-surface-variant">
                                  {JSON.stringify(log.details).substring(0, 80)}
                                </p>
                              ) : (
                                <span className="text-sm text-on-surface-variant">-</span>
                              )}
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
              {filteredLogs.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant">
                  {t('admin.dashboard.noData')}
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const user = log.users;
                  return (
                    <div key={log.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <ActionBadge action={log.action} />
                          <EntityTypeBadge type={log.entity_type} />
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">
                          {formatDate(log.created_at, locale, 'datetime')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span>{user?.full_name || user?.email || t('admin.logs.system')}</span>
                        <span>&middot;</span>
                        <span>{formatDate(log.created_at, locale)}</span>
                      </div>
                      {log.details && (
                        <p className="line-clamp-2 text-xs text-on-surface-variant">
                          {JSON.stringify(log.details).substring(0, 120)}
                        </p>
                      )}
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
            <span>{t('admin.logs.rowsPerPage')}</span>
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
