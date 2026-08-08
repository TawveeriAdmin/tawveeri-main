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
import { ScrapingAdminGuide } from '../scraping-admin-guide';

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

function relTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(mins / 60);
  const days = Math.round(hours / 24);
  const future = diffMs < 0;
  const isAr = locale === 'ar';
  let str: string;
  if (mins < 1) return isAr ? 'الآن' : 'just now';
  else if (mins < 60) str = isAr ? `${mins}د` : `${mins}m`;
  else if (hours < 24) str = isAr ? `${hours}س` : `${hours}h`;
  else str = isAr ? `${days}ي` : `${days}d`;
  return future ? (isAr ? `بعد ${str}` : `in ${str}`) : (isAr ? `قبل ${str}` : `${str} ago`);
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

const SCHEDULE_TEXT = {
  en: {
    title: 'Scraping schedules',
    subtitle: 'Enable, schedule, and tune the automatic scrapers per store.',
    refresh: 'Refresh',
    search: 'Search stores...',
    filters: 'Filters',
    columns: 'Columns',
    jobType: 'Job type',
    allJobs: 'All jobs',
    discovery: 'Discovery',
    priceUpdate: 'Price update',
    status: 'Status',
    all: 'All',
    enabled: 'Enabled',
    disabled: 'Disabled',
    store: 'Store',
    job: 'Job',
    categories: 'Categories',
    cron: 'Cron',
    pages: 'Pages',
    coverage: 'Coverage mode',
    target: 'Target (h)',
    staleAfter: 'Stale after (h)',
    nextRun: 'Next run',
    lastRun: 'Last run',
    actions: 'Actions',
    legacyLive: 'Legacy live flag',
    adminOnly: 'admin only',
    noMatches: 'No schedules match the current filters.',
    loading: 'Loading...',
    rows: 'schedules',
    allCategories: 'all (leave empty)',
    batchCap: 'Batch cap',
    columnLabels: {
      categories: 'Categories',
      enabled: 'Enabled',
      cron: 'Cron',
      pages: 'Pages',
      coverage: 'Coverage mode',
      target_hours: 'Target refresh (h)',
      max_products: 'Batch cap',
      older_than_hours: 'Stale after (h)',
      live_search: 'Legacy live flag',
      next_run: 'Next run',
      last_run: 'Last run',
    },
    tooltips: {
      pages: 'Discovery: max category-listing pages to crawl per run. Scrapers stop early when a page returns zero new products, so this is a safety cap.',
      coverage: 'Price update only. When enabled, the dispatcher computes batch size so the catalog is refreshed inside the target window.',
      target: "Price update only. Target SLA: every product's price gets re-checked within this many hours.",
      batchCap: 'Price update only. Hard upper-bound on batch size for stores that need throttling.',
      staleAfter: "Price update: only re-check products whose last_checked_at is older than this many hours.",
      legacyLive: 'Legacy schedule flag only. Public live scraping is disabled; customer search reads the catalog.',
      save: 'Save edits',
      run: 'Run this schedule now',
      history: 'View run history',
      delete: 'Delete this schedule',
    },
    deleteDialog: {
      title: 'Delete this schedule?',
      descriptionPrefix: 'This removes the',
      descriptionMiddle: 'schedule for',
      descriptionSuffix: 'Run history is kept. The scraper for this store will stop running automatically until you create a new schedule.',
      cancel: 'Cancel',
      confirm: 'Delete',
    },
  },
  ar: {
    title: 'جداول السكرابر',
    subtitle: 'تفعيل وجدولة وضبط السكرابر التلقائي لكل متجر.',
    refresh: 'تحديث',
    search: 'ابحث في المتاجر...',
    filters: 'الفلاتر',
    columns: 'الأعمدة',
    jobType: 'نوع المهمة',
    allJobs: 'كل المهام',
    discovery: 'اكتشاف المنتجات',
    priceUpdate: 'تحديث الأسعار',
    status: 'الحالة',
    all: 'الكل',
    enabled: 'مفعل',
    disabled: 'معطل',
    store: 'المتجر',
    job: 'المهمة',
    categories: 'التصنيفات',
    cron: 'كرون',
    pages: 'الصفحات',
    coverage: 'وضع التغطية',
    target: 'الهدف (س)',
    staleAfter: 'قديم بعد (س)',
    nextRun: 'التشغيل القادم',
    lastRun: 'آخر تشغيل',
    actions: 'الإجراءات',
    legacyLive: 'علامة مباشرة قديمة',
    adminOnly: 'للمدير فقط',
    noMatches: 'لا توجد جداول تطابق الفلاتر.',
    loading: 'جار التحميل...',
    rows: 'جدولا',
    allCategories: 'الكل (اتركه فارغا)',
    batchCap: 'حد الدفعة',
    columnLabels: {
      categories: 'التصنيفات',
      enabled: 'مفعل',
      cron: 'كرون',
      pages: 'الصفحات',
      coverage: 'وضع التغطية',
      target_hours: 'هدف التحديث (س)',
      max_products: 'حد الدفعة',
      older_than_hours: 'قديم بعد (س)',
      live_search: 'علامة مباشرة قديمة',
      next_run: 'التشغيل القادم',
      last_run: 'آخر تشغيل',
    },
    tooltips: {
      pages: 'الاكتشاف: الحد الأقصى لصفحات التصنيفات في كل تشغيل. يتوقف السكرابر مبكرا عند عدم العثور على منتجات جديدة.',
      coverage: 'تحديث الأسعار فقط. عند تفعيله يحسب النظام حجم الدفعة لتحديث الكتالوج داخل النافذة المستهدفة.',
      target: 'تحديث الأسعار فقط. الهدف هو إعادة فحص سعر كل منتج خلال هذا العدد من الساعات.',
      batchCap: 'تحديث الأسعار فقط. حد أعلى لحجم الدفعة للمتاجر التي تحتاج تهدئة.',
      staleAfter: 'تحديث الأسعار: أعد فحص المنتجات التي مر على آخر فحص لها هذا العدد من الساعات.',
      legacyLive: 'علامة جدول قديمة فقط. السكرابر المباشر العام معطل وبحث العملاء يقرأ من الكتالوج.',
      save: 'حفظ التعديلات',
      run: 'تشغيل هذا الجدول الآن',
      history: 'عرض سجل التشغيل',
      delete: 'حذف هذا الجدول',
    },
    deleteDialog: {
      title: 'حذف هذا الجدول؟',
      descriptionPrefix: 'سيتم حذف جدول',
      descriptionMiddle: 'للمتجر',
      descriptionSuffix: 'سيبقى سجل التشغيل محفوظا. سيتوقف السكرابر لهذا المتجر تلقائيا حتى يتم إنشاء جدول جديد.',
      cancel: 'إلغاء',
      confirm: 'حذف',
    },
  },
};

type SortField = 'store' | 'job_type' | 'is_enabled' | 'last_run_at' | 'next_run_at';

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: 'asc' | 'desc';
}) {
  if (sortField !== field) return <ArrowUpDown className="ms-1 inline h-3 w-3 opacity-40" />;
  return sortDir === 'asc'
    ? <ArrowUp className="ms-1 inline h-3 w-3" />
    : <ArrowDown className="ms-1 inline h-3 w-3" />;
}
type SortDir = 'asc' | 'desc';

export default function ScrapingSchedulesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const text = SCHEDULE_TEXT[locale === 'ar' ? 'ar' : 'en'];
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

  const activeFilterCount =
    (jobTypeFilter !== 'all' ? 1 : 0) + (enabledFilter !== 'all' ? 1 : 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{text.title}</h1>
          <p className="text-sm text-muted-foreground">
            {text.subtitle}
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
          {text.refresh}
        </Button>
      </div>

      <ScrapingAdminGuide page="schedules" locale={locale} />

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              placeholder={text.search}
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
                  <span className="hidden sm:inline">{text.filters}</span>
                  {activeFilterCount > 0 && (
                    <span className="ms-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{text.jobType}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'discovery', 'price_update'] as const).map((v) => (
                  <DropdownMenuCheckboxItem
                    key={v}
                    checked={jobTypeFilter === v}
                    onCheckedChange={() => setJobTypeFilter(v)}
                  >
                    {v === 'all' ? text.allJobs : v === 'discovery' ? text.discovery : text.priceUpdate}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{text.status}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'enabled', 'disabled'] as const).map((v) => (
                  <DropdownMenuCheckboxItem
                    key={v}
                    checked={enabledFilter === v}
                    onCheckedChange={() => setEnabledFilter(v)}
                  >
                    {v === 'all' ? text.all : v === 'enabled' ? text.enabled : text.disabled}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{text.columns}</span>
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
                    {text.columnLabels[col]}
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
                  {text.store} <SortIcon field="store" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className="font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('job_type')}
                >
                  {text.job} <SortIcon field="job_type" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                {visibleCols.categories && <TableHead className="font-semibold">{text.categories}</TableHead>}
                {visibleCols.enabled && (
                  <TableHead
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort('is_enabled')}
                  >
                    {text.enabled} <SortIcon field="is_enabled" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                )}
                {visibleCols.cron && <TableHead className="font-semibold">{text.cron}</TableHead>}
                {visibleCols.pages && (
                  <TableHead
                    className="font-semibold"
                    title={text.tooltips.pages}
                  >
                    {text.pages}
                  </TableHead>
                )}
                {visibleCols.coverage && (
                  <TableHead
                    className="font-semibold"
                    title={text.tooltips.coverage}
                  >
                    {text.coverage}
                  </TableHead>
                )}
                {visibleCols.target_hours && (
                  <TableHead
                    className="font-semibold"
                    title={text.tooltips.target}
                  >
                    {text.target}
                  </TableHead>
                )}
                {visibleCols.max_products && (
                  <TableHead
                    className="font-semibold"
                    title={text.tooltips.batchCap}
                  >
                    {text.batchCap}
                  </TableHead>
                )}
                {visibleCols.older_than_hours && (
                  <TableHead
                    className="font-semibold"
                    title={text.tooltips.staleAfter}
                  >
                    {text.staleAfter}
                  </TableHead>
                )}
                {visibleCols.live_search && (
                  <TableHead
                    className="font-semibold"
                    title={text.tooltips.legacyLive}
                  >
                    {text.legacyLive}
                  </TableHead>
                )}
                {visibleCols.next_run && (
                  <TableHead
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort('next_run_at')}
                  >
                    {text.nextRun} <SortIcon field="next_run_at" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                )}
                {visibleCols.last_run && (
                  <TableHead
                    className="font-semibold cursor-pointer select-none"
                    onClick={() => toggleSort('last_run_at')}
                  >
                    {text.lastRun} <SortIcon field="last_run_at" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                )}
                <TableHead className="font-semibold">{text.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSortedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    {text.noMatches}
                  </TableCell>
                </TableRow>
              )}
              {filteredSortedRows.map((r) => {
                const e = effective(r);
                const dirty = !!edits[r.id];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {locale === 'ar' ? r.stores?.name_ar || r.stores?.name_en || r.stores?.slug : r.stores?.name_en || r.stores?.slug}
                    </TableCell>
                    <TableCell>{r.job_type === 'discovery' ? text.discovery : text.priceUpdate}</TableCell>
                    {visibleCols.categories && (
                      <TableCell>
                        {r.job_type === 'discovery' ? (
                          <Input
                            className="w-48 text-xs"
                            placeholder={text.allCategories}
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
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={e.is_live_search_enabled}
                            onCheckedChange={(v) => patch(r.id, { is_live_search_enabled: v })}
                          />
                          <span className="text-xs text-muted-foreground">{text.adminOnly}</span>
                        </div>
                      </TableCell>
                    )}
                    {visibleCols.next_run && (
                      <TableCell className="text-xs text-muted-foreground">
                        {relTime(e.next_run_at, locale)}
                      </TableCell>
                    )}
                    {visibleCols.last_run && (
                      <TableCell className="text-xs text-muted-foreground">
                        {relTime(r.last_run_at, locale)}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1">
                        {dirty && (
                          <Button
                            size="sm"
                            onClick={() => save(r.id)}
                            disabled={savingId === r.id}
                            title={text.tooltips.save}
                          >
                            <Save size={14} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runNow(r.id)}
                          title={text.tooltips.run}
                        >
                          <Play size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewRuns(r.store_id)}
                          title={text.tooltips.history}
                        >
                          <ListChecks size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeletingRow(r)}
                          title={text.tooltips.delete}
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
              ? text.loading
              : `${filteredSortedRows.length} / ${rows.length} ${text.rows}`}
          </span>
        </div>
      </div>

      <AlertDialog open={!!deletingRow} onOpenChange={(open) => !open && setDeletingRow(null)}>
        <AlertDialogContent className="!bg-white dark:!bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{text.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRow && (
                <>
                  {text.deleteDialog.descriptionPrefix}{' '}
                  <strong>{deletingRow.job_type === 'discovery' ? text.discovery : text.priceUpdate}</strong>{' '}
                  {text.deleteDialog.descriptionMiddle}{' '}
                  <strong>
                    {locale === 'ar'
                      ? deletingRow.stores?.name_ar || deletingRow.stores?.name_en || deletingRow.stores?.slug
                      : deletingRow.stores?.name_en || deletingRow.stores?.slug}
                  </strong>
                  . {text.deleteDialog.descriptionSuffix}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{text.deleteDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRow && deleteSchedule(deletingRow.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {text.deleteDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
