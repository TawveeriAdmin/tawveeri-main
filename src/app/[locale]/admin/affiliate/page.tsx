import { createClient } from '@/lib/auth/server';
import { createServerClient } from '@/lib/database';
import { AffiliateSettingsCard } from '@/components/admin/affiliate-settings-card';
import { AffiliateReportUpload } from '@/components/admin/affiliate-report-upload';
import { AlertCircle, HandCoins } from 'lucide-react';

const BASELINE_ISO = '2026-08-06T00:00:00Z';

/**
 * Commercial truth per affiliate program (founder mission 2026-08-13):
 * what Tawveeri can actually measure today is TAGGED OUTBOUND TRAFFIC (the
 * /go ledger). A conversion or commission figure only ever exists after an
 * affiliate-network report import — it is never inferred from clicks.
 */
async function getProgramTruth(program: 'amazon' | 'noon') {
  const sb = createServerClient() as any;
  const [tagged, last, conversions] = await Promise.all([
    sb.from('outbound_clicks').select('id', { count: 'exact', head: true })
      .eq('is_test', false).eq('affiliate_program', program).gte('clicked_at', BASELINE_ISO),
    sb.from('outbound_clicks').select('clicked_at')
      .eq('is_test', false).eq('affiliate_program', program)
      .order('clicked_at', { ascending: false }).limit(1),
    sb.from('affiliate_conversions').select('id', { count: 'exact', head: true }),
  ]);
  return {
    taggedExits: tagged.error ? null : (tagged.count ?? 0),
    lastExitAt: last.error ? null : (last.data?.[0]?.clicked_at ?? null),
    conversions: conversions.error ? null : (conversions.count ?? 0),
  };
}

export default async function AdminAffiliatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRTL = locale === 'ar';
  const supabase = await createClient();
  const [amazonTruth, noonTruth] = await Promise.all([
    getProgramTruth('amazon'),
    getProgramTruth('noon'),
  ]);

  // `affiliate_config` is deliberately NOT selected here — that column (migration 20) was
  // never applied to production (ADR-212) and, where it exists elsewhere, isn't what the
  // actual exit path reads anyway. The Provider Registry (src/lib/providers/registry.ts,
  // ADR-085) / DEFAULT_STORE_AFFILIATE_CONFIG is the real authoritative source — see
  // AffiliateSettingsCard, which now reads from there, read-only.
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, slug, name_ar, name_en, website_url')
    .in('slug', ['amazon', 'noon'])
    .order('slug');

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59] dark:text-[#9fe4d0]">
              {isRTL ? 'إعدادات التتبع' : 'Tracking settings'}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-on-surface md:text-3xl dark:text-white">
              {isRTL ? 'إدارة روابط العمولات' : 'Affiliate Management'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-on-surface-variant dark:text-white/60">
              {isRTL
                ? 'أكواد أمازون ونون معروضة هنا للمرجع — يتم إدارتها في الكود (src/lib/providers/registry.ts) وتُطبّق تلقائياً عند ضغط المستخدم على عرض في المتجر.'
                : 'Amazon and Noon affiliate codes shown here for reference — managed in code (src/lib/providers/registry.ts), applied automatically when users click View at Store.'}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d7ece5] bg-[#f8fcfa] px-3 py-1.5 text-xs font-black text-on-surface-variant dark:border-[#263b33] dark:bg-[#101713] dark:text-white/60">
            <HandCoins className="h-4 w-4 text-[#1f6f59] dark:text-[#9fe4d0]" />
            {isRTL ? 'برنامجان مفعّلان' : '2 enabled programs'}
          </span>
        </div>
      </section>

      {/* Commercial truth per program — traffic sent vs. attributable vs. a sale
          vs. confirmed revenue are DIFFERENT events; only the first two are
          measurable before a network report import. */}
      <section className="grid gap-4 md:grid-cols-2">
        {(
          [
            { key: 'amazon', label: isRTL ? 'أمازون السعودية' : 'Amazon Saudi Arabia', truth: amazonTruth },
            { key: 'noon', label: isRTL ? 'نون' : 'Noon', truth: noonTruth },
          ] as const
        ).map(({ key, label, truth }) => (
          <div
            key={key}
            className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]"
          >
            <h2 className="font-black text-on-surface dark:text-white">{label}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-on-surface-variant dark:text-white/60">
                  {isRTL ? 'خروج موسوم مؤكد (منذ 2026-08-06)' : 'Tagged confirmed exits (since 2026-08-06)'}
                </dt>
                <dd className="font-black tabular-nums">
                  {truth.taggedExits === null ? '—' : truth.taggedExits.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-on-surface-variant dark:text-white/60">
                  {isRTL ? 'آخر خروج موسوم' : 'Last tagged exit'}
                </dt>
                <dd className="font-medium">
                  {truth.lastExitAt ? (
                    <bdi dir="ltr">
                      {new Date(truth.lastExitAt).toLocaleString(isRTL ? 'ar-SA' : 'en-GB', {
                        timeZone: 'Asia/Riyadh',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </bdi>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-on-surface-variant dark:text-white/60">
                  {isRTL ? 'تحويلات/عمولة مؤكدة' : 'Conversions / confirmed commission'}
                </dt>
                <dd className="text-xs font-medium text-on-surface-variant dark:text-white/60">
                  {(truth.conversions ?? 0) > 0
                    ? truth.conversions!.toLocaleString()
                    : isRTL
                      ? 'غير متاح — لم يُستورد تقرير الشبكة بعد'
                      : 'unavailable — no network report imported yet'}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </section>

      {error && (
        <div className="rounded-[1.35rem] border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">
                {isRTL ? 'تعذر تحميل إعدادات العمولات' : 'Could not load affiliate settings'}
              </p>
              <p className="mt-1 text-sm opacity-80">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {(stores || []).map((store) => (
          <AffiliateSettingsCard
            key={store.id}
            store={store as {
              id: string;
              slug: string;
              name_ar: string;
              name_en: string;
              website_url: string;
            }}
            locale={locale}
          />
        ))}
      </div>

      {!error && (!stores || stores.length === 0) && (
        <div className="rounded-[1.35rem] border border-dashed border-[#bfe7dc] bg-white p-10 text-center dark:border-[#315145] dark:bg-[#141c18]">
          <HandCoins className="mx-auto h-8 w-8 text-[#1f6f59] dark:text-[#9fe4d0]" />
          <p className="mt-3 font-black text-on-surface dark:text-white">
            {isRTL ? 'لا توجد متاجر عمولات' : 'No affiliate stores found'}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant dark:text-white/60">
            {isRTL
              ? 'تأكد من وجود متجري أمازون ونون في جدول المتاجر.'
              : 'Make sure Amazon and Noon exist in the stores table.'}
          </p>
        </div>
      )}

      <AffiliateReportUpload locale={locale} />
    </div>
  );
}
