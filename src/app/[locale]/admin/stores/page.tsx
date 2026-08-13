'use client';

// Retailer sources directory (rebuilt, founder mission 2026-08-13).
//
// The previous page showed "Total: 24" next to Active/Pending/Suspended/
// Inactive cards that all read 0 — those four counts filtered on a
// `stores.status` column that does not exist in production, and supabase-js
// surfaces that as `count: null`, which `|| 0` silently turned into zeros.
// The table select also asked for status/total_products/commission_rate/
// is_premium/is_featured/created_at (none exist) → the whole list failed and
// rendered as empty. This rebuild queries only columns production actually
// has, and classifies each row through the SAME code registries the customer
// surface uses (approved-retailers.ts + the provider registry) — so "24"
// finally reads as what it is: registry rows, most of them retired experiments.

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/database';
import {
  APPROVED_STORE_IDS,
  COMPARISON_DISPLAY_EXCLUDED,
  resolveApprovedSlug,
} from '@/lib/retailers/approved-retailers';
import { Eye, Search, Store, XCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoreRow {
  id: string | number;
  slug: string | null;
  name_ar: string | null;
  name_en: string | null;
  logo_url: string | null;
  website_url: string | null;
  average_rating: number | null;
  total_reviews: number | null;
  category: string | null;
}

const AFFILIATE_SLUGS = new Set(['amazon', 'noon']);

const T = {
  ar: {
    title: 'مصادر المتاجر',
    subtitle: 'كل صف في السجل مصنف بحسب بوابات الاعتماد والعرض الفعلية في الكود — لا يوجد عمود «حالة» في قاعدة البيانات.',
    registered: 'مسجلة في السجل',
    registeredHint: 'بينها تجارب سابقة متوقفة',
    approved: 'معتمدة للاستيعاب',
    displayable: 'معروضة للعملاء',
    affiliate: 'مفعّلة للعمولة',
    search: 'ابحث بالاسم أو المعرف…',
    store: 'المتجر',
    classification: 'التصنيف',
    rating: 'التقييم',
    empty: 'لا نتائج مطابقة.',
    error: 'تعذر تحميل المتاجر.',
    retry: 'إعادة المحاولة',
    badgeApproved: 'معتمد للاستيعاب',
    badgeDisplayable: 'معروض للعملاء',
    badgeAffiliate: 'عمولة',
    badgeRetired: 'غير نشط',
    view: 'عرض',
  },
  en: {
    title: 'Retailer sources',
    subtitle: 'Every registry row, classified by the actual code approval/display gates — the database has no "status" column.',
    registered: 'Registered rows',
    registeredHint: 'includes retired experiments',
    approved: 'Approved for ingestion',
    displayable: 'Customer-displayable',
    affiliate: 'Affiliate-enabled',
    search: 'Search by name or slug…',
    store: 'Store',
    classification: 'Classification',
    rating: 'Rating',
    empty: 'No matching results.',
    error: 'Could not load stores.',
    retry: 'Retry',
    badgeApproved: 'ingestion-approved',
    badgeDisplayable: 'customer-displayable',
    badgeAffiliate: 'affiliate',
    badgeRetired: 'retired',
    view: 'View',
  },
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; detail: string }
  | { kind: 'ready'; rows: StoreRow[] };

export default function AdminStoresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const t = T[isAr ? 'ar' : 'en'];
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const sb = getSupabaseBrowserClient() as any;
    const { data, error } = await sb
      .from('stores')
      .select('id, slug, name_ar, name_en, logo_url, website_url, average_rating, total_reviews, category')
      .order('name_en', { ascending: true });
    if (error) {
      setState({ kind: 'error', detail: error.message });
      return;
    }
    setState({ kind: 'ready', rows: (data ?? []) as StoreRow[] });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const classify = (row: StoreRow) => {
    const slug = resolveApprovedSlug(row.slug ?? row.id);
    const numericId = typeof row.id === 'number' ? row.id : Number(row.id);
    const approved =
      (Number.isFinite(numericId) && APPROVED_STORE_IDS.has(numericId)) ||
      (slug !== null &&
        [...APPROVED_STORE_IDS].some((id) => resolveApprovedSlug(id) === slug));
    const displayable = approved && slug !== null && !COMPARISON_DISPLAY_EXCLUDED.has(slug);
    const affiliate = slug !== null && AFFILIATE_SLUGS.has(slug);
    return { approved, displayable, affiliate };
  };

  const rows =
    state.kind === 'ready'
      ? state.rows.filter((r) => {
          if (!query.trim()) return true;
          const q = query.trim().toLowerCase();
          return [r.name_ar, r.name_en, r.slug]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
        })
      : [];

  const counts =
    state.kind === 'ready'
      ? state.rows.reduce(
          (acc, r) => {
            const c = classify(r);
            if (c.approved) acc.approved++;
            if (c.displayable) acc.displayable++;
            if (c.affiliate) acc.affiliate++;
            return acc;
          },
          { approved: 0, displayable: 0, affiliate: 0 }
        )
      : null;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
          <Store size={20} /> {t.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {state.kind === 'loading' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </>
      )}

      {state.kind === 'error' && (
        <div className="rounded-xl border border-red-500/40 bg-red-50 dark:bg-red-950/30 p-6 text-center space-y-3">
          <XCircle className="mx-auto text-red-600 dark:text-red-400" size={28} />
          <p className="font-medium">{t.error}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {state.detail}
          </p>
          <Button variant="outline" onClick={load}>
            {t.retry}
          </Button>
        </div>
      )}

      {state.kind === 'ready' && counts && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <TaxCard label={t.registered} value={state.rows.length} hint={t.registeredHint} />
            <TaxCard label={t.approved} value={counts.approved} />
            <TaxCard label={t.displayable} value={counts.displayable} />
            <TaxCard label={t.affiliate} value={counts.affiliate} />
          </div>

          <div className="relative max-w-sm">
            <Search
              size={15}
              className="absolute top-1/2 -translate-y-1/2 text-muted-foreground start-3"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              className="ps-9"
            />
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-outline-variant p-8 text-center text-muted-foreground">
              {t.empty}
            </div>
          ) : (
            <div className="grid gap-2">
              {rows.map((r) => {
                const c = classify(r);
                const name = (isAr ? r.name_ar : r.name_en) || r.name_en || r.name_ar || r.slug || String(r.id);
                return (
                  <div
                    key={String(r.id)}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-xl border p-3',
                      c.approved ? 'border-outline-variant bg-surface-container-lowest' : 'border-outline-variant/60 bg-surface-container-low/30 opacity-75'
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-white">
                      {r.logo_url ? (
                        <Image src={r.logo_url} alt="" width={40} height={40} className="object-contain" unoptimized />
                      ) : (
                        <Store size={16} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{name}</div>
                      <div className="text-xs text-muted-foreground">
                        <bdi dir="ltr">{r.slug ?? `#${r.id}`}</bdi>
                        {typeof r.average_rating === 'number' && r.average_rating > 0 && (
                          <span className="ms-2">★ {r.average_rating.toFixed(1)} ({r.total_reviews ?? 0})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.approved ? (
                        <>
                          <Chip tone="green">{t.badgeApproved}</Chip>
                          {c.displayable && <Chip tone="blue">{t.badgeDisplayable}</Chip>}
                          {c.affiliate && <Chip tone="amber">{t.badgeAffiliate}</Chip>}
                        </>
                      ) : (
                        <Chip tone="gray">{t.badgeRetired}</Chip>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {r.website_url && (
                        <a
                          href={r.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-2 text-muted-foreground hover:bg-surface-container-low"
                          aria-label="website"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <Link
                        href={`/${locale}/admin/stores/${r.id}`}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-surface-container-low"
                        aria-label={t.view}
                      >
                        <Eye size={15} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaxCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Chip({ tone, children }: { tone: 'green' | 'blue' | 'amber' | 'gray'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }[tone];
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', cls)}>{children}</span>;
}
