'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play,
  Save,
  RefreshCw,
  Trash2,
  ListChecks,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  SlidersHorizontal,
  Columns3,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter, useParams } from 'next/navigation';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ScheduleRow {
  id: string;
  store_id: string;
  job_type: 'discovery' | 'price_update';
  cron_expression: string;
  is_enabled: boolean;
  max_pages: number;
  max_products: number;
  older_than_hours: number;
  categories: string[] | null;
  is_live_search_enabled: boolean;
  coverage_mode: boolean;
  target_refresh_hours: number;
  chunk_size: number | null;
  last_run_at: string | null;
  last_success_at: string | null;
  next_run_at: string | null;
  stores: { id: string; slug: string; name_ar: string; name_en: string; logo_url: string | null };
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(mins / 60);
  const days = Math.round(hours / 24);
  const future = diffMs < 0;
  let str: string;
  if (mins < 1) str = 'just now';
  else if (mins < 60) str = `${mins}m`;
  else if (hours < 24) str = `${hours}h`;
  else str = `${days}d`;
  return future ? `in ${str}` : `${str} ago`;
}

type ColumnKey =
  | 'categories'
  | 'enabled'
  | 'cron'
  | 'pages'
  | 'coverage'
  | 'target_hours'
  | 'max_products'
  | 'older_than_hours'
  | 'live_search'
  | 'next_run'
  | 'last_run';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  categories: 'Categories',
  enabled: 'Enabled',
  cron: 'Cron',
  pages: 'Pages',
  coverage: 'Coverage mode',
  target_hours: 'Target refresh (h)',
  max_products: 'Batch cap',
  older_than_hours: 'Stale after (h)',
  live_search: 'Live search',
  next_run: 'Next run',
  last_run: 'Last run',
};

type SortField = 'store' | 'job_type' | 'is_enabled' | 'last_run_at' | 'next_run_at';
type SortDir = 'asc' | 'desc';

export default function ScrapingSchedulesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, Partial<ScheduleRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingRow, setDeletingRow] = useState<ScheduleRow | null>(null);

  // Data-table controls
  const [searchQuery, setSearchQuery] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState<'all' | 'discovery' | 'price_update'>('all');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [sortField, setSortField] = useState<SortField>('store');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    categories: true,
    enabled: true,
    cron: true,
    pages: true,
    coverage: true,
    target_hours: true,
    max_products: false,
    older_than_hours: true,
    live_search: false,
    next_run: true,
    last_run: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scraping/schedules');
      const json = await res.json();
      setRows(json.schedules ?? []);
    } catch (err) {
      toast({ title: 'Failed to load schedules', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (id: string, changes: Partial<ScheduleRow>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  };

  const save = async (id: string) => {
    const changes = edits[id];
    if (!changes) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/scraping/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Save failed');
      }
      toast({ title: 'Schedule updated' });
      setEdits((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const runNow = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/scraping/schedules/${id}/run-now`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Run failed');
      toast({ title: 'Run triggered — check the Runs tab' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Run failed', variant: 'destructive' });
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/scraping/schedules/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Delete failed');
      }
      toast({ title: 'Schedule deleted' });
      setDeletingRow(null);
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Delete failed', variant: 'destructive' });
    }
  };

  const viewRuns = (storeId: string) => {
    router.push(`/${locale}/admin/scraping/runs?store_id=${storeId}`);
  };

  const effective = (row: ScheduleRow): ScheduleRow => ({ ...row, ...edits[row.id] });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredSortedRows = useMemo(() => {
    let result = rows.filter((r) => {
      const e = effective(r);
      // Search: store name (AR + EN) and slug
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${r.stores?.name_en ?? ''} ${r.stores?.name_ar ?? ''} ${r.stores?.slug ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (jobTypeFilter !== 'all' && r.job_type !== jobTypeFilter) return false;
      if (enabledFilter === 'enabled' && !e.is_enabled) return false;
      if (enabledFilter === 'disabled' && e.is_enabled) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      const ea = effective(a);
      const eb = effective(b);
      let av: string | number | null | undefined;
      let bv: string | number | null | undefined;
      switch (sortField) {
        case 'store':
          av = a.stores?.name_en || a.stores?.slug;
          bv = b.stores?.name_en || b.stores?.slug;
          break;
        case 'job_type':
          av = a.job_type;
          bv = b.job_type;
          break;
        case 'is_enabled':
          av = ea.is_enabled ? 1 : 0;
          bv = eb.is_enabled ? 1 : 0;
          break;
        case 'last_run_at':
          av = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
          bv = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
          break;
        case 'next_run_at':
          av = ea.next_run_at ? new Date(ea.next_run_at).getTime() : Number.POSITIVE_INFINITY;
          bv = eb.next_run_at ? new Date(eb.next_run_at).getTime() : Number.POSITIVE_INFINITY;
          break;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return result;
  }, [rows, edits, searchQuery, jobTypeFilter, enabledFilter, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ms-1 inline h-3 w-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ms-1 inline h-3 w-3" />
      : <ArrowDown className="ms-1 inline h-3 w-3" />;
  };

  const activeFilterCount =
    (jobTypeFilter !== 'all' ? 1 : 0) + (enabledFilter !== 'all' ? 1 : 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scraping schedules</h1>
          <p className="text-sm text-muted-foreground">
            Enable, schedule, and tune the automatic scrapers per store.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              placeholder="Search stores…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('gap-1.5', activeFilterCount > 0 && 'border-primary text-primary')}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="ms-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Job type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'discovery', 'price_update'] as const).map((v) => (
                  <DropdownMenuCheckboxItem
                    key={v}
                    checked={jobTypeFilter === v}
                    onCheckedChange={() => setJobTypeFilter(v)}
                  >
                    {v === 'all' ? 'All jobs' : v}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'enabled', 'disabled'] as const).map((v) => (
                  <DropdownMenuCheckboxItem
                    key={v}
                    checked={enabledFilter === v}
                    onCheckedChange={() => setEnabledFilter(v)}
                  >
                    {v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Columns</span>
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
                    {COLUMN_LABELS[col]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container-low hover:bg-surface-container-low">
                <TableHead
                  className="font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('store')}
                >
                  Store <SortIcon field="store" />
                </TableHead>
                <TableHead
                  className="font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('job_type')}
                >
                  Job <SortIcon field="job_type" />
                </TableHead>
                {visibleCols.categories && <TableHead className="font-semibold">Categories</TableHead>}
                {visibleCols.enabled && (
                  <TableHead
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort('is_enabled')}
                  >
                    Enabled <SortIcon field="is_enabled" />
                  </TableHead>
                )}
                {visibleCols.cron && <TableHead className="font-semibold">Cron</TableHead>}
                {visibleCols.pages && (
                  <TableHead
                    className="font-semibold"
                    title="Discovery: max category-listing pages to crawl per run. Scrapers stop early when a page returns zero new products, so this is a safety cap — set it high to scrape everything."
                  >
                    Pages
                  </TableHead>
                )}
                {visibleCols.coverage && (
                  <TableHead
                    className="font-semibold"
                    title="Price update only. When ON (recommended), the dispatcher computes batch size per run so the entire catalog is refreshed within the target window — scales automatically as the catalog grows."
                  >
                    Coverage mode
                  </TableHead>
                )}
                {visibleCols.target_hours && (
                  <TableHead
                    className="font-semibold"
                    title="Price update only. Target SLA: every product's price gets re-checked within this many hours. Default 24."
                  >
                    Target (h)
                  </TableHead>
                )}
                {visibleCols.max_products && (
                  <TableHead
                    className="font-semibold"
                    title="Price update only. Hard upper-bound on batch size (0 = uncapped). Only applied when Coverage mode is OFF, or as a ceiling in Coverage mode for stores you want to throttle."
                  >
                    Batch cap
                  </TableHead>
                )}
                {visibleCols.older_than_hours && (
                  <TableHead
                    className="font-semibold"
                    title="Price update: only re-check products whose last_checked_at is older than this many hours."
                  >
                    Stale after (h)
                  </TableHead>
                )}
                {visibleCols.live_search && <TableHead className="font-semibold">Live search</TableHead>}
                {visibleCols.next_run && (
                  <TableHead
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort('next_run_at')}
                  >
                    Next run <SortIcon field="next_run_at" />
                  </TableHead>
                )}
                {visibleCols.last_run && (
                  <TableHead
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort('last_run_at')}
                  >
                    Last run <SortIcon field="last_run_at" />
                  </TableHead>
                )}
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSortedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    No schedules match your filters.
                  </TableCell>
                </TableRow>
              )}
              {filteredSortedRows.map((r) => {
                const e = effective(r);
                const dirty = !!edits[r.id];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.stores?.name_en || r.stores?.slug}</TableCell>
                    <TableCell>{r.job_type}</TableCell>
                    {visibleCols.categories && (
                      <TableCell>
                        {r.job_type === 'discovery' ? (
                          <Input
                            className="w-48 text-xs"
                            placeholder="all (leave empty)"
                            value={(e.categories ?? []).join(',')}
                            onChange={(ev) => {
                              const parsed = ev.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean);
                              patch(r.id, { categories: parsed.length ? parsed : null });
                            }}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.enabled && (
                      <TableCell>
                        <Switch
                          checked={e.is_enabled}
                          onCheckedChange={(v) => patch(r.id, { is_enabled: v })}
                        />
                      </TableCell>
                    )}
                    {visibleCols.cron && (
                      <TableCell>
                        <Input
                          className="w-32 font-mono text-xs"
                          value={e.cron_expression}
                          onChange={(ev) => patch(r.id, { cron_expression: ev.target.value })}
                        />
                      </TableCell>
                    )}
                    {visibleCols.pages && (
                      <TableCell>
                        {r.job_type === 'discovery' ? (
                          <Input
                            className="w-20"
                            type="number"
                            value={e.max_pages ?? 200}
                            onChange={(ev) => patch(r.id, { max_pages: parseInt(ev.target.value) || 1 })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.coverage && (
                      <TableCell>
                        {r.job_type === 'price_update' ? (
                          <Switch
                            checked={e.coverage_mode ?? true}
                            onCheckedChange={(v) => patch(r.id, { coverage_mode: v })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.target_hours && (
                      <TableCell>
                        {r.job_type === 'price_update' ? (
                          <Input
                            className="w-20"
                            type="number"
                            value={e.target_refresh_hours ?? 24}
                            onChange={(ev) => patch(r.id, { target_refresh_hours: parseInt(ev.target.value) || 1 })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.max_products && (
                      <TableCell>
                        {r.job_type === 'price_update' ? (
                          <Input
                            className="w-20"
                            type="number"
                            value={e.max_products ?? 500}
                            onChange={(ev) => patch(r.id, { max_products: parseInt(ev.target.value) || 1 })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.older_than_hours && (
                      <TableCell>
                        {r.job_type === 'price_update' ? (
                          <Input
                            className="w-16"
                            type="number"
                            value={e.older_than_hours ?? 24}
                            onChange={(ev) => patch(r.id, { older_than_hours: parseInt(ev.target.value) || 1 })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.live_search && (
                      <TableCell>
                        <Switch
                          checked={e.is_live_search_enabled}
                          onCheckedChange={(v) => patch(r.id, { is_live_search_enabled: v })}
                        />
                      </TableCell>
                    )}
                    {visibleCols.next_run && (
                      <TableCell className="text-xs text-muted-foreground">
                        {relTime(e.next_run_at)}
                      </TableCell>
                    )}
                    {visibleCols.last_run && (
                      <TableCell className="text-xs text-muted-foreground">
                        {relTime(r.last_run_at)}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1">
                        {dirty && (
                          <Button
                            size="sm"
                            onClick={() => save(r.id)}
                            disabled={savingId === r.id}
                            title="Save edits"
                          >
                            <Save size={14} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runNow(r.id)}
                          title="Run this schedule now (manual test)"
                        >
                          <Play size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewRuns(r.store_id)}
                          title="View run history for this store"
                        >
                          <ListChecks size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeletingRow(r)}
                          title="Delete this schedule"
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

        <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3 text-sm text-muted-foreground">
          <span>
            {loading
              ? 'Loading…'
              : `${filteredSortedRows.length} of ${rows.length} schedules`}
          </span>
        </div>
      </div>

      <AlertDialog open={!!deletingRow} onOpenChange={(open) => !open && setDeletingRow(null)}>
        <AlertDialogContent className="!bg-white dark:!bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRow && (
                <>
                  This removes the <strong>{deletingRow.job_type}</strong> schedule for{' '}
                  <strong>{deletingRow.stores?.name_en || deletingRow.stores?.slug}</strong>. Run
                  history (in the Runs page) is kept. The scraper for this store will stop
                  running automatically until you create a new schedule.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRow && deleteSchedule(deletingRow.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
