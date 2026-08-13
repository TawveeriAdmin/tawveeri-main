// Commercial signals (rebuilt, founder mission 2026-08-13).
//
// The previous page was a "Transactions" dashboard (total/completed/pending/
// failed/refunded) over the `transactions` table — which has 0 rows and no
// writer (its only ingress was internalized behind CRON_SECRET in ADR-244
// after zero legitimate callers were confirmed). Tawveeri never processes the
// merchant checkout, so a transactions ledger it cannot observe is a
// fabricated certainty. This page is restructured around the events Tawveeri
// CAN observe, in the order of the commercial chain:
//   confirmed retailer exits (ledger) → attributed exits → affiliate
//   conversions (network reports only) → confirmed commission (same).
// Sources are governed by docs/METRIC_DEFINITIONS.md.

import Link from 'next/link';
import { createServerClient } from '@/lib/database';
import { resolveApprovedSlug, retailerDisplayName } from '@/lib/retailers/approved-retailers';
import { ArrowUpRight, Wallet } from 'lucide-react';

const BASELINE_ISO = '2026-08-06T00:00:00Z';

interface ExitRow {
  clicked_at: string;
  store_name: string | null;
  source: string | null;
  affiliate_program: string | null;
  session_id: string | null;
  campaign: Record<string, string> | null;
}

export default async function CommercialSignalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const sb = createServerClient() as any;

  const iso7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [exits7d, exitsBaseline, attributed, tagged, conversions, recent, byStore] =
    await Promise.all([
      sb.from('outbound_clicks').select('id', { count: 'exact', head: true })
        .eq('is_test', false).gte('clicked_at', iso7d),
      sb.from('outbound_clicks').select('id', { count: 'exact', head: true })
        .eq('is_test', false).gte('clicked_at', BASELINE_ISO),
      sb.from('outbound_clicks').select('id', { count: 'exact', head: true })
        .eq('is_test', false).not('session_id', 'is', null).gte('clicked_at', BASELINE_ISO),
      sb.from('outbound_clicks').select('id', { count: 'exact', head: true })
        .eq('is_test', false).neq('affiliate_program', 'direct').gte('clicked_at', BASELINE_ISO),
      sb.from('affiliate_conversions').select('id', { count: 'exact', head: true }),
      sb.from('outbound_clicks')
        .select('clicked_at, store_name, source, affiliate_program, session_id, campaign')
        .eq('is_test', false)
        .order('clicked_at', { ascending: false })
        .limit(25),
      sb.from('outbound_clicks')
        .select('store_name')
        .eq('is_test', false)
        .gte('clicked_at', BASELINE_ISO)
        .limit(10000),
    ]);

  const cnt = (r: { count: number | null; error: { message: string } | null }) =>
    r.error ? null : (r.count ?? 0);

  const storeCounts = new Map<string, number>();
  if (!byStore.error) {
    for (const row of (byStore.data ?? []) as Array<{ store_name: string | null }>) {
      const slug = resolveApprovedSlug(row.store_name);
      const label =
        (slug && retailerDisplayName(slug, isAr ? 'ar' : 'en')) || row.store_name || '—';
      storeCounts.set(label, (storeCounts.get(label) ?? 0) + 1);
    }
  }
  const topStores = [...storeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const fmt = (v: number | null) => (v === null ? '—' : v.toLocaleString());
  const recentRows: ExitRow[] = recent.error ? [] : ((recent.data ?? []) as ExitRow[]);

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
          <Wallet size={20} /> {t('الإشارات التجارية', 'Commercial signals')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {t(
            'توفيري لا يعالج الشراء لدى المتاجر، لذلك لا توجد «معاملات» يمكنه رصدها مباشرة. هذه الصفحة تعرض السلسلة التجارية القابلة للقياس فعلاً: خروج مؤكد → خروج منسوب → تحويلات الشبكات → عمولة مؤكدة.',
            'Tawveeri does not process merchant checkout, so there are no directly observable "transactions." This page shows the commercial chain that IS measurable: confirmed exits → attributed exits → network conversions → confirmed commission.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card
          label={t('خروج مؤكد (7 أيام)', 'Confirmed exits (7d)')}
          value={fmt(cnt(exits7d))}
          hint={t('سجل /go — حقيقي فقط', '/go ledger — REAL only')}
        />
        <Card
          label={t('خروج مؤكد منذ الأساس', 'Exits since baseline')}
          value={fmt(cnt(exitsBaseline))}
          hint={t('منذ 2026-08-06', 'since 2026-08-06')}
        />
        <Card
          label={t('موسوم بالعمولة', 'Affiliate-tagged')}
          value={fmt(cnt(tagged))}
          hint={t('أمازون + نون', 'Amazon + Noon')}
        />
        <Card
          label={t('تحويلات مؤكدة من الشبكات', 'Network-confirmed conversions')}
          value={fmt(cnt(conversions))}
          hint={
            (cnt(conversions) ?? 0) === 0
              ? t('لم يُستورد أي تقرير بعد', 'no report imported yet')
              : undefined
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          `الخروج المنسوب لجلسة (بعد تحديث 2026-08-13): ${fmt(cnt(attributed))} — الصفوف الأقدم كتبت قبل ختم الجلسة وتبقى غير منسوبة بأمانة. العمولة المؤكدة تظهر فقط بعد استيراد تقرير شبكة العمولة من صفحة العمولات.`,
          `Session-attributed exits (post 2026-08-13 cutover): ${fmt(cnt(attributed))} — older rows predate session stamping and honestly stay unattributed. Confirmed commission appears only after an affiliate-network report import on the Affiliate page.`
        )}
      </p>

      {topStores.length > 0 && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <h2 className="mb-3 font-bold">
            {t('الخروج حسب المتجر (منذ الأساس)', 'Exits by retailer (since baseline)')}
          </h2>
          <div className="space-y-1.5">
            {topStores.map(([name, count]) => (
              <div key={name} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate font-medium">{name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-low">
                  <div
                    className="h-full rounded-full bg-primary-500"
                    style={{ width: `${Math.round((count / topStores[0][1]) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-end tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t('آخر عمليات الخروج', 'Latest exits')}</h2>
          <Link
            href={`/${locale}/admin/affiliate`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
          >
            {t('إدارة العمولات', 'Affiliate management')} <ArrowUpRight size={12} />
          </Link>
        </div>
        {recentRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {recent.error
              ? t('تعذر تحميل السجل.', 'Could not load the ledger.')
              : t('لا عمليات خروج حقيقية بعد.', 'No real exits yet.')}
          </p>
        ) : (
          <div className="divide-y divide-outline-variant/60">
            {recentRows.map((r, i) => {
              const slug = resolveApprovedSlug(r.store_name);
              const store =
                (slug && retailerDisplayName(slug, isAr ? 'ar' : 'en')) || r.store_name || '—';
              const utm = r.campaign?.utm_source
                ? `${r.campaign.utm_source}${r.campaign.utm_content ? ` / ${r.campaign.utm_content}` : ''}`
                : null;
              return (
                <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                  <span className="w-32 shrink-0 text-xs text-muted-foreground" dir="ltr">
                    {new Date(r.clicked_at).toLocaleString(isAr ? 'ar-SA' : 'en-GB', {
                      timeZone: 'Asia/Riyadh',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="font-medium">{store}</span>
                  {r.affiliate_program && r.affiliate_program !== 'direct' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      {r.affiliate_program}
                    </span>
                  )}
                  {r.source && (
                    <span className="text-xs text-muted-foreground">
                      <bdi dir="ltr">{r.source}</bdi>
                    </span>
                  )}
                  {utm && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                      <bdi dir="ltr">{utm}</bdi>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
