'use client';

import { useState, useEffect, useCallback } from 'react';
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

function coverageBadge(pct: number | null) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">no data</span>;
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

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function ScrapingHealthPage() {
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
          <h1 className="text-2xl font-semibold">Scraping health</h1>
          <p className="text-sm text-muted-foreground">
            Coverage and reliability per store. Auto-refreshes every 30s.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
          Refresh
        </Button>
      </div>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total products" value={totals.total_products.toLocaleString()} />
          <StatCard
            label="Refreshed (24h)"
            value={totals.refreshed_last_24h.toLocaleString()}
            hint={
              totals.total_products > 0
                ? `${Math.round((totals.refreshed_last_24h / totals.total_products) * 100)}% of catalog`
                : undefined
            }
          />
          <StatCard
            label="Stale (>48h)"
            value={totals.stale_over_48h.toLocaleString()}
            variant={totals.stale_over_48h > 0 ? 'warn' : 'ok'}
          />
          <StatCard
            label="Chronic failures"
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
                  <TableHead className="font-semibold">Store</TableHead>
                  <TableHead className="font-semibold">Products</TableHead>
                  <TableHead className="font-semibold">24h coverage</TableHead>
                  <TableHead className="font-semibold">Stale {'>'}48h</TableHead>
                  <TableHead className="font-semibold">Chronic fails</TableHead>
                  <TableHead className="font-semibold">Runs (24h)</TableHead>
                  <TableHead className="font-semibold">Errors (24h)</TableHead>
                  <TableHead className="font-semibold">Oldest check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No stores with catalog data yet — run discovery to populate.
                    </TableCell>
                  </TableRow>
                )}
                {stores.map((s) => (
                  <TableRow key={s.store_id}>
                    <TableCell className="font-medium">{s.store_name_en || s.store_slug}</TableCell>
                    <TableCell className="tabular-nums">{s.total_products.toLocaleString()}</TableCell>
                    <TableCell>{coverageBadge(s.coverage_pct_24h)}</TableCell>
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
                          ({s.failed_runs_last_24h} failed)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{s.total_errors_last_24h.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relTime(s.oldest_check)}
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
