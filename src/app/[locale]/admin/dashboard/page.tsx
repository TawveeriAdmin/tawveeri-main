// Founder operating picture (rebuilt, founder mission 2026-08-13).
//
// The previous dashboard hardcoded "System state: stable", showed a
// meaningless "activity rate" (transactions ÷ transactions+alerts, both empty
// tables), rendered failed queries as zeros, injected Math.random() sparklines,
// and labeled 24 registry rows "stores" while a status breakdown queried a
// column production does not have. Every number below traces to a governed
// source (founder-home-queries.ts) and UNKNOWN renders as "—", never 0.

import Link from 'next/link';
import { getFounderHomeData, type Metric } from '@/lib/admin/founder-home-queries';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Layers,
  Radio,
  Store,
  Users,
  Wallet,
} from 'lucide-react';

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const data = await getFounderHomeData();

  const t = (ar: string, en: string) => (isAr ? ar : en);
  const trackingAlive =
    data.system.lastEventMinutesAgo.value !== null &&
    data.system.lastEventMinutesAgo.value <= 360;
  const systemHealthy = trackingAlive && data.attention.every((a) => a.severity !== 'critical');

  const noAnswerRate =
    data.consumer7d.searches.value && data.consumer7d.noAnswer.value !== null
      ? Math.round((data.consumer7d.noAnswer.value / data.consumer7d.searches.value) * 100)
      : null;
  const comparablePct =
    data.catalog.canonicalProducts.value && data.catalog.comparableProducts.value !== null
      ? Math.round(
          (data.catalog.comparableProducts.value / data.catalog.canonicalProducts.value) * 100
        )
      : null;

  return (
    <div className="w-full space-y-5">
      {/* SYSTEM strip — derived from measurements, never hardcoded */}
      <section
        className={`rounded-2xl border p-4 md:p-5 ${
          systemHealthy
            ? 'border-green-500/30 bg-green-50/60 dark:bg-green-950/20'
            : 'border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2 font-bold">
            <Radio size={18} className={systemHealthy ? 'text-green-600' : 'text-amber-600'} />
            {systemHealthy
              ? t('النظام يعمل ويقيس', 'System running and measuring')
              : t('النظام يحتاج انتباهاً', 'System needs attention')}
          </div>
          <SysFact
            label={t('آخر حدث استخدام', 'Last usage event')}
            value={
              data.system.lastEventMinutesAgo.value === null
                ? '—'
                : data.system.lastEventMinutesAgo.value < 60
                  ? t(
                      `قبل ${data.system.lastEventMinutesAgo.value} دقيقة`,
                      `${data.system.lastEventMinutesAgo.value}m ago`
                    )
                  : t(
                      `قبل ${Math.round(data.system.lastEventMinutesAgo.value / 60)} ساعة`,
                      `${Math.round(data.system.lastEventMinutesAgo.value / 60)}h ago`
                    )
            }
          />
          <SysFact
            label={t('مصادر حديثة (24س)', 'Fresh sources (24h)')}
            value={`${fmt(data.system.freshApprovedSources24h)} / ${data.system.approvedSourcesTotal}`}
          />
          <SysFact
            label={t('تشغيلات الاستيعاب (24س)', 'Ingestion runs (24h)')}
            value={`${fmt(data.system.scrapingRuns24h)}${
              (data.system.failedRuns24h.value ?? 0) > 0
                ? ` (${data.system.failedRuns24h.value} ${t('فاشلة', 'failed')})`
                : ''
            }`}
          />
        </div>
      </section>

      {/* ATTENTION — rendered only when something actually requires it */}
      {data.attention.length > 0 && (
        <section className="rounded-2xl border border-amber-500/40 bg-surface-container-lowest p-4 space-y-2">
          <h2 className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle size={16} /> {t('يتطلب انتباهك', 'Needs your attention')}
          </h2>
          <ul className="space-y-1.5">
            {data.attention.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                />
                {a.href ? (
                  <Link href={`/${locale}${a.href}`} className="hover:underline">
                    {isAr ? a.titleAr : a.titleEn}
                  </Link>
                ) : (
                  <span>{isAr ? a.titleAr : a.titleEn}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* RETAILERS */}
      <Section
        icon={<Store size={16} />}
        title={t('المتاجر', 'Retailers')}
        link={{ href: `/${locale}/admin/scraping/health`, label: t('صحة المصادر', 'Source health') }}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card
            label={t('مصادر مسجلة', 'Registered sources')}
            value={fmt(data.retailers.registeredRows)}
            hint={t('كل صفوف السجل، وبينها تجارب سابقة متوقفة', 'all registry rows, incl. retired experiments')}
          />
          <Card
            label={t('معتمدة للاستيعاب', 'Approved for ingestion')}
            value={String(data.retailers.approvedForIngestion)}
            hint={t('قائمة الاعتماد في الكود', 'code approval registry')}
          />
          <Card
            label={t('معروضة للعملاء', 'Customer-displayable')}
            value={String(data.retailers.customerDisplayable)}
            hint={t('تجتاز بوابة العرض', 'passes the display gate')}
          />
          <Card
            label={t('مفعّلة للعمولة', 'Affiliate-enabled')}
            value={String(data.retailers.affiliateEnabled)}
            hint={t('أمازون ونون', 'Amazon + Noon')}
          />
        </div>
      </Section>

      {/* CATALOG — TPS knowledge layer (canonical_products / tps_product_projection).
          Kept in its own section, deliberately NOT sharing a grid with the
          storefront-layer count below: the two pipelines have no foreign key
          between them, so a reader must not be able to eyeball a ratio across
          them (see docs/DECISIONS.md ADR-242 — canonical_products/
          tps_product_projection vs the legacy products/product_stores layer). */}
      <Section
        icon={<Boxes size={16} />}
        title={t('الكتالوج — طبقة هوية TPS', 'Catalog — TPS identity layer')}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card
            label={t('منتجات معرفة الهوية', 'Canonical products')}
            value={fmt(data.catalog.canonicalProducts)}
          />
          <Card
            label={t('قابلة للمقارنة (≥2 متاجر)', 'Comparable (≥2 stores)')}
            value={fmt(data.catalog.comparableProducts)}
            hint={comparablePct !== null ? `${comparablePct}% ${t('من الكتالوج', 'of catalog')}` : undefined}
          />
          <Card
            label={t('حديثة (<72س)', 'Fresh (<72h)')}
            value={fmt(data.catalog.freshCanonicals72h)}
          />
        </div>
      </Section>

      {/* STOREFRONT LAYER — legacy products/product_stores. A separate table
          with no join to canonical_products (confirmed: product_stores.product_id
          → products.id only; products.canonical_product_id is the only real
          link, and it covers a minority of rows — see ADR-242). Never divide
          this number by anything in the Catalog section above. */}
      <Section
        icon={<Layers size={16} />}
        title={t('طبقة الواجهة (تراثية)', 'Storefront layer (legacy)')}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card
            label={t('قوائم المتاجر (كل الطبقات)', 'Store listings (all layers)')}
            value={fmt(data.catalog.storefrontListings)}
            hint={t(
              'حجم فقط — جدول منفصل تماماً عن الكتالوج أعلاه، لا رابط بينهما',
              'volume only — a separate table from the catalog above, not joined to it'
            )}
          />
        </div>
      </Section>

      {/* CONSUMER — REAL only, 7 days */}
      <Section
        icon={<Activity size={16} />}
        title={t('قيمة العملاء — آخر 7 أيام (حقيقي فقط)', 'Consumer value — last 7 days (REAL only)')}
        link={{ href: `/${locale}/admin/command-center`, label: t('مركز القيادة', 'Command Center') }}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label={t('جلسات', 'Sessions')} value={fmt(data.consumer7d.sessions)} />
          <Card label={t('عمليات بحث', 'Searches')} value={fmt(data.consumer7d.searches)} />
          <Card
            label={t('بلا نتيجة', 'No result')}
            value={fmt(data.consumer7d.noAnswer)}
            hint={noAnswerRate !== null ? `${noAnswerRate}%` : undefined}
            warn={noAnswerRate !== null && noAnswerRate > 20}
          />
          <Card
            label={t('خروج لمتاجر', 'Retailer exits')}
            value={fmt(data.consumer7d.outboundExits)}
            hint={t('من سجل الخروج المؤكد', 'from the confirmed exit ledger')}
          />
        </div>
      </Section>

      {/* COMMERCIAL */}
      <Section
        icon={<Wallet size={16} />}
        title={t('الحقيقة التجارية', 'Commercial truth')}
        link={{ href: `/${locale}/admin/transactions`, label: t('الإشارات التجارية', 'Commercial signals') }}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card
            label={t('خروج مؤكد منذ الأساس', 'Exits since baseline')}
            value={fmt(data.commercial.exitsSinceBaseline)}
            hint={t('منذ 2026-08-06', 'since 2026-08-06')}
          />
          <Card
            label={t('خروج موسوم بالعمولة', 'Affiliate-tagged exits')}
            value={fmt(data.commercial.affiliateTaggedExits)}
            hint={t('أمازون + نون', 'Amazon + Noon')}
          />
          <Card
            label={t('تحويلات العمولة', 'Affiliate conversions')}
            value={fmt(data.commercial.affiliateConversions)}
            hint={
              (data.commercial.affiliateConversions.value ?? 0) === 0
                ? t('لم يُستورد أي تقرير شبكة بعد', 'no network report imported yet')
                : undefined
            }
          />
          <Card
            label={t('عمولة مؤكدة', 'Confirmed commission')}
            value="—"
            hint={t('غير قابلة للقياس قبل استيراد تقرير الشبكة', 'unmeasurable until a network report import')}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            '«أرسلنا زيارة» ≠ «حدث شراء» ≠ «تأكدت عمولة». توفيري يرى الخروج المؤكد فقط؛ الشراء والعمولة لا يأتيان إلا من تقارير شبكات العمولة.',
            '"We sent traffic" ≠ "a sale occurred" ≠ "commission confirmed." Tawveeri observes confirmed exits only; sales and commission only ever come from affiliate-network reports.'
          )}
        </p>
      </Section>

      {/* USERS — honest framing */}
      <Section icon={<Users size={16} />} title={t('الحسابات', 'Accounts')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card
            label={t('حسابات مسجلة', 'Registered accounts')}
            value={fmt(data.users.registeredAccounts)}
            hint={t(
              'التسجيل اختياري — الجلسات أعلاه هي مقياس الاستخدام',
              'registration is optional — sessions above measure usage'
            )}
          />
        </div>
      </Section>

      <p className="text-xs text-muted-foreground">
        {t('كل رقم أعلاه يُقرأ من مصدره لحظة فتح الصفحة؛ «—» تعني غير قابل للقياس الآن وليس صفراً.',
          'Every number reads from its source at page load; "—" means unmeasurable right now, not zero.')}
      </p>
    </div>
  );
}

function fmt(m: Metric): string {
  return m.value === null ? '—' : m.value.toLocaleString();
}

function SysFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Section({
  icon,
  title,
  link,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          {icon} {title}
        </h2>
        {link && (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
          >
            {link.label} <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Card({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        warn ? 'border-amber-500/40' : 'border-outline-variant'
      } bg-surface-container-low/40`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
