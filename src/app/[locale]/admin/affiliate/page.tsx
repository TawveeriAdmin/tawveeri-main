import { createClient } from '@/lib/auth/server';
import { AffiliateSettingsCard } from '@/components/admin/affiliate-settings-card';
import { AlertCircle, HandCoins } from 'lucide-react';

export default async function AdminAffiliatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRTL = locale === 'ar';
  const supabase = await createClient();

  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, slug, name_ar, name_en, website_url, affiliate_config')
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
                ? 'عدّل أكواد أمازون ونون من هنا. سيتم استخدامها تلقائياً عند ضغط المستخدم على عرض في المتجر.'
                : 'Edit Amazon and Noon affiliate codes here. They are applied automatically when users click View at Store.'}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d7ece5] bg-[#f8fcfa] px-3 py-1.5 text-xs font-black text-on-surface-variant dark:border-[#263b33] dark:bg-[#101713] dark:text-white/60">
            <HandCoins className="h-4 w-4 text-[#1f6f59] dark:text-[#9fe4d0]" />
            {stores?.length || 0} {isRTL ? 'متجر' : 'stores'}
          </span>
        </div>
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
              affiliate_config?: Record<string, unknown> | null;
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
    </div>
  );
}
