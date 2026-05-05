'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrapingAdminGuide } from '../scraping-admin-guide';

interface StoreHealth {
  store_id: string;
  store_slug: string;
  store_name_en: string;
  total_products: number;
  refreshed_last_24h: number;
  stale_over_48h: number;
  chronic_failures: number;
  oldest_check: string | null;
  newest_check: string | null;
  runs_last_24h: number;
  failed_runs_last_24h: number;
  products_updated_last_24h: number;
  total_errors_last_24h: number;
  coverage_pct_24h: number | null;
}

interface Totals {
  total_products: number;
  refreshed_last_24h: number;
  stale_over_48h: number;
  chronic_failures: number;
}

const HEALTH_TEXT = {
  en: {
    title: 'Scraping health',
    subtitle: 'Coverage and reliability per store. Auto-refreshes every 30s.',
    refresh: 'Refresh',
    totalProducts: 'Total products',
    refreshed24h: 'Refreshed (24h)',
    ofCatalog: 'of catalog',
    stale48h: 'Stale (>48h)',
    chronicFailures: 'Chronic failures',
    store: 'Store',
    products: 'Products',
    coverage24h: '24h coverage',
    staleColumn: 'Stale >48h',
    chronicFails: 'Chronic fails',
    runs24h: 'Runs (24h)',
    errors24h: 'Errors (24h)',
    oldestCheck: 'Oldest check',
    noData: 'No stores with catalog data yet — run discovery to populate.',
    noDataBadge: 'no data',
    failed: 'failed',
  },
  ar: {
    title: 'صحة السكرابر',
    subtitle: 'تغطية وموثوقية التحديث لكل متجر. يتم التحديث تلقائيا كل 30 ثانية.',
    refresh: 'تحديث',
    totalProducts: 'إجمالي المنتجات',
    refreshed24h: 'تم تحديثها (24س)',
    ofCatalog: 'من الكتالوج',
    stale48h: 'قديمة (>48س)',
    chronicFailures: 'إخفاقات متكررة',
    store: 'المتجر',
    products: 'المنتجات',
    coverage24h: 'تغطية 24س',
    staleColumn: 'قديمة >48س',
    chronicFails: 'إخفاقات متكررة',
    runs24h: 'تشغيل (24س)',
    errors24h: 'أخطاء (24س)',
    oldestCheck: 'أقدم فحص',
    noData: 'لا توجد بيانات كتالوج بعد. شغل الاكتشاف لإضافة المنتجات.',
    noDataBadge: 'لا توجد بيانات',
    failed: 'فشل',
  },
};

function coverageBadge(pct: number | null, noDataLabel: string) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">{noDataLabel}</span>;
  }
  if (pct >= 90) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
        <CheckCircle2 size={12} /> {pct}%
      </span>
    );
  }
  if (pct >= 50) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <AlertTriangle size={12} /> {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
      <XCircle size={12} /> {pct}%
    </span>
  );
}

function relTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const isAr = locale === 'ar';
  if (mins < 1) return isAr ? 'الآن' : 'just now';
  if (mins < 60) return isAr ? `قبل ${mins}د` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return isAr ? `قبل ${hours}س` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return isAr ? `قبل ${days}ي` : `${days}d ago`;
}

export default function ScrapingHealthPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const text = HEALTH_TEXT[locale === 'ar' ? 'ar' : 'en'];
  const [stores, setStores] = useState<StoreHealth[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scraping/health');
      const json = await res.json();
      setStores(json.stores ?? []);
      setTotals(json.totals ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 30s — useful while a run is in progress.
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

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

      <ScrapingAdminGuide page="health" locale={locale} />

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={text.totalProducts} value={totals.total_products.toLocaleString()} />
          <StatCard
            label={text.refreshed24h}
            value={totals.refreshed_last_24h.toLocaleString()}
            hint={
              totals.total_products > 0
                ? `${Math.round((totals.refreshed_last_24h / totals.total_products) * 100)}% ${text.ofCatalog}`
                : undefined
            }
          />
          <StatCard
            label={text.stale48h}
            value={totals.stale_over_48h.toLocaleString()}
            variant={totals.stale_over_48h > 0 ? 'warn' : 'ok'}
          />
          <StatCard
            label={text.chronicFailures}
            value={totals.chronic_failures.toLocaleString()}
            variant={totals.chronic_failures > 0 ? 'bad' : 'ok'}
          />
        </div>
      )}

      {/* Per-store table */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        {loading && stores.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-container-low hover:bg-surface-container-low">
                  <TableHead className="font-semibold">{text.store}</TableHead>
                  <TableHead className="font-semibold">{text.products}</TableHead>
                  <TableHead className="font-semibold">{text.coverage24h}</TableHead>
                  <TableHead className="font-semibold">{text.staleColumn}</TableHead>
                  <TableHead className="font-semibold">{text.chronicFails}</TableHead>
                  <TableHead className="font-semibold">{text.runs24h}</TableHead>
                  <TableHead className="font-semibold">{text.errors24h}</TableHead>
                  <TableHead className="font-semibold">{text.oldestCheck}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {text.noData}
                    </TableCell>
                  </TableRow>
                )}
                {stores.map((s) => (
                  <TableRow key={s.store_id}>
                    <TableCell className="font-medium">{s.store_name_en || s.store_slug}</TableCell>
                    <TableCell className="tabular-nums">{s.total_products.toLocaleString()}</TableCell>
                    <TableCell>{coverageBadge(s.coverage_pct_24h, text.noDataBadge)}</TableCell>
                    <TableCell
                      className={cn(
                        'tabular-nums',
                        s.stale_over_48h > 0 && 'text-amber-600 dark:text-amber-400 font-semibold'
                      )}
                    >
                      {s.stale_over_48h.toLocaleString()}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'tabular-nums',
                        s.chronic_failures > 0 && 'text-red-600 dark:text-red-400 font-semibold'
                      )}
                    >
                      {s.chronic_failures.toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s.runs_last_24h}
                      {s.failed_runs_last_24h > 0 && (
                        <span className="ms-1 text-xs text-red-600 dark:text-red-400">
                          ({s.failed_runs_last_24h} {text.failed})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{s.total_errors_last_24h.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relTime(s.oldest_check, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  variant = 'ok',
}: {
  label: string;
  value: string;
  hint?: string;
  variant?: 'ok' | 'warn' | 'bad';
}) {
  const border =
    variant === 'bad'
      ? 'border-red-500/40'
      : variant === 'warn'
        ? 'border-amber-500/40'
        : 'border-outline-variant';
  return (
    <div className={cn('rounded-lg border bg-surface-container-lowest p-3', border)}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
