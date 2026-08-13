'use client';

// Founder scraping-health surface (rebuilt, founder mission 2026-08-13).
//
// This page renders the ACTUAL /api/admin/scraping/health contract through the
// normalization boundary in scraping-health-contract.ts. Its previous version
// rendered a retired API shape (total_products / refreshed_last_24h /
// coverage_pct_24h) that the rebuilt endpoint never returns — so
// `totals.total_products.toLocaleString()` crashed the route in production,
// and an auth/500 failure rendered as the "no catalog data yet" empty state.
// States are now explicit and never collapse into each other:
// LOADING (bounded skeleton) / ERROR (retry + reason) / EMPTY (true empty) /
// per-field UNKNOWN ("—") vs measured zero ("0").

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, CircleSlash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrapingAdminGuide } from '../scraping-admin-guide';
import {
  normalizeStoreHealth,
  normalizeHealthTotals,
  sortStoresByAttention,
  fmtCount,
  type StoreHealthView,
  type HealthTotalsView,
} from '@/lib/admin/scraping-health-contract';

const TEXT = {
  en: {
    title: 'Store ingestion health',
    subtitle: 'Freshness and reliability per retailer source. Auto-refreshes every 30s.',
    refresh: 'Refresh',
    ingestingStores: 'Ingesting (fresh <24h)',
    staleStores: 'Stale sources',
    withAlerts: 'Sources with alerts',
    failedRuns: 'Failed runs (24h)',
    ofTotal: 'of',
    lastIngestion: 'Last ingestion',
    runs24h: 'Runs 24h',
    written24h: 'Rows written 24h',
    persisted24h: 'Products persisted 24h',
    lastError: 'Last error',
    empty: 'No retailer sources are registered yet.',
    error: 'Could not load health data.',
    retry: 'Retry',
    never: 'never',
    unknown: '—',
    fresh: 'fresh',
    stale: 'stale',
    updated: 'Updated',
    alertLabels: {
      never_ingested: 'never ingested',
      stale_ingestion: 'stale ingestion',
      consecutive_failures: 'repeated failures',
      all_runs_zero_result: 'all runs returned nothing',
      no_runs_last_24h: 'no runs in 24h',
      adapter_error: 'adapter error',
    } as Record<string, string>,
  },
  ar: {
    title: 'صحة استيعاب المتاجر',
    subtitle: 'حداثة البيانات وموثوقية التحديث لكل مصدر. يتحدث تلقائياً كل 30 ثانية.',
    refresh: 'تحديث',
    ingestingStores: 'مصادر حديثة (<24س)',
    staleStores: 'مصادر متوقفة/قديمة',
    withAlerts: 'مصادر عليها تنبيهات',
    failedRuns: 'تشغيلات فاشلة (24س)',
    ofTotal: 'من',
    lastIngestion: 'آخر استيعاب',
    runs24h: 'تشغيلات 24س',
    written24h: 'صفوف مكتوبة 24س',
    persisted24h: 'منتجات مثبتة 24س',
    lastError: 'آخر خطأ',
    empty: 'لا توجد مصادر متاجر مسجلة بعد.',
    error: 'تعذر تحميل بيانات الصحة.',
    retry: 'إعادة المحاولة',
    never: 'أبداً',
    unknown: '—',
    fresh: 'حديث',
    stale: 'قديم',
    updated: 'آخر تحديث',
    alertLabels: {
      never_ingested: 'لم يُستوعب بعد',
      stale_ingestion: 'بيانات قديمة',
      consecutive_failures: 'فشل متكرر',
      all_runs_zero_result: 'كل التشغيلات بلا نتائج',
      no_runs_last_24h: 'لا تشغيل خلال 24س',
      adapter_error: 'خطأ في الموصل',
    } as Record<string, string>,
  },
};

function relAge(hours: number | null, isAr: boolean, neverLabel: string): string {
  if (hours === null) return neverLabel;
  if (hours < 1) return isAr ? 'أقل من ساعة' : '<1h';
  if (hours < 48) {
    const h = Math.round(hours);
    return isAr ? `قبل ${h}س` : `${h}h ago`;
  }
  const d = Math.round(hours / 24);
  return isAr ? `قبل ${d}ي` : `${d}d ago`;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; detail: string }
  | { kind: 'ready'; stores: StoreHealthView[]; totals: HealthTotalsView | null; at: Date };

export default function ScrapingHealthPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const isAr = locale === 'ar';
  const text = TEXT[isAr ? 'ar' : 'en'];
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const hasData = useRef(false);

  const load = useCallback(async () => {
    if (hasData.current) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/scraping/health');
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        /* non-JSON body — handled below as an error */
      }
      if (!res.ok || json === null || typeof json !== 'object') {
        const detail =
          (json as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
        setState({ kind: 'error', detail });
        return;
      }
      const payload = json as { stores?: unknown; totals?: unknown };
      const stores = Array.isArray(payload.stores)
        ? payload.stores
            .map(normalizeStoreHealth)
            .filter((s): s is StoreHealthView => s !== null)
        : [];
      hasData.current = true;
      setState({
        kind: 'ready',
        stores: sortStoresByAttention(stores),
        totals: normalizeHealthTotals(payload.totals),
        at: new Date(),
      });
    } catch (e) {
      setState({ kind: 'error', detail: e instanceof Error ? e.message : 'network' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      // Background refresh only while the tab is visible — never resets to skeleton.
      if (typeof document === 'undefined' || !document.hidden) load();
    }, 30000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">{text.title}</h1>
          <p className="text-sm text-muted-foreground">{text.subtitle}</p>
          {state.kind === 'ready' && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {text.updated}:{' '}
              <span dir="ltr">{state.at.toLocaleTimeString(isAr ? 'ar-SA' : 'en-GB')}</span>
            </p>
          )}
        </div>
        <Button variant="outline" onClick={load} disabled={refreshing}>
          <RefreshCw className={refreshing ? 'animate-spin' : ''} size={14} />
          {text.refresh}
        </Button>
      </div>

      <ScrapingAdminGuide page="health" locale={locale} />

      {state.kind === 'loading' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-xl border border-red-500/40 bg-red-50 dark:bg-red-950/30 p-6 text-center space-y-3">
          <XCircle className="mx-auto text-red-600 dark:text-red-400" size={28} />
          <p className="font-medium">{text.error}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {state.detail}
          </p>
          <Button variant="outline" onClick={load}>
            {text.retry}
          </Button>
        </div>
      )}

      {state.kind === 'ready' && (
        <>
          {state.totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label={text.ingestingStores}
                value={fmtCount(state.totals.ingestingStores)}
                hint={
                  state.totals.stores !== null
                    ? `${text.ofTotal} ${state.totals.stores}`
                    : undefined
                }
                variant="ok"
              />
              <StatCard
                label={text.staleStores}
                value={fmtCount(state.totals.staleStores)}
                variant={(state.totals.staleStores ?? 0) > 0 ? 'warn' : 'ok'}
              />
              <StatCard
                label={text.withAlerts}
                value={fmtCount(state.totals.storesWithAlerts)}
                variant={(state.totals.storesWithAlerts ?? 0) > 0 ? 'warn' : 'ok'}
              />
              <StatCard
                label={text.failedRuns}
                value={fmtCount(state.totals.failedRunsLast24h)}
                variant={(state.totals.failedRunsLast24h ?? 0) > 0 ? 'bad' : 'ok'}
              />
            </div>
          )}

          {state.stores.length === 0 ? (
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center text-muted-foreground">
              <CircleSlash className="mx-auto mb-2 opacity-60" size={24} />
              {text.empty}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {state.stores.map((s) => (
                <StoreCard key={s.storeId} s={s} isAr={isAr} text={text} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FreshnessBadge({
  s,
  isAr,
  text,
}: {
  s: StoreHealthView;
  isAr: boolean;
  text: (typeof TEXT)['en'];
}) {
  if (s.ingestionAgeHours === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-muted-foreground">
        <CircleSlash size={11} /> {text.never}
      </span>
    );
  }
  if (s.isStale === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangle size={11} /> {text.stale} · {relAge(s.ingestionAgeHours, isAr, text.never)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-950/50 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
      <CheckCircle2 size={11} /> {text.fresh} · {relAge(s.ingestionAgeHours, isAr, text.never)}
    </span>
  );
}

function StoreCard({
  s,
  isAr,
  text,
}: {
  s: StoreHealthView;
  isAr: boolean;
  text: (typeof TEXT)['en'];
}) {
  const failed = s.failedRunsLast24h ?? 0;
  const written =
    s.rawWrittenLast24h === null && s.priceWrittenLast24h === null
      ? null
      : (s.rawWrittenLast24h ?? 0) + (s.priceWrittenLast24h ?? 0);
  return (
    <div
      className={cn(
        'rounded-xl border bg-surface-container-lowest p-4 space-y-2',
        s.alerts.length > 0 ? 'border-amber-500/50' : 'border-outline-variant'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{s.name}</div>
        <FreshnessBadge s={s} isAr={isAr} text={text} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">{text.runs24h}</div>
          <div className="tabular-nums">
            {fmtCount(s.runsLast24h)}
            {failed > 0 && (
              <span className="ms-1 text-xs font-semibold text-red-600 dark:text-red-400">
                ({failed}✗)
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{text.written24h}</div>
          <div className="tabular-nums">{fmtCount(written)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{text.persisted24h}</div>
          <div className="tabular-nums">{fmtCount(s.persistedLast24h)}</div>
        </div>
      </div>

      {s.alerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s.alerts.map((a) => (
            <span
              key={a}
              className="rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300"
            >
              {text.alertLabels[a] ?? a}
            </span>
          ))}
        </div>
      )}

      {s.lastError && (
        <div className="text-xs text-muted-foreground">
          <span>{text.lastError}: </span>
          <bdi dir="ltr" className="break-all">
            {s.lastError.slice(0, 160)}
          </bdi>
        </div>
      )}
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
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
