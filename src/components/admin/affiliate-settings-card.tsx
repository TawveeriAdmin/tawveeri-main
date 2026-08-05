import { ExternalLink, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { applyAffiliateTag, getAffiliateConfig } from '@/lib/transactions/affiliate-config';

interface AffiliateSettingsCardProps {
  store: {
    id: string;
    slug: string;
    name_ar: string;
    name_en: string;
    website_url: string;
  };
  locale: string;
}

// Read-only by design (fixed 2026-08-05): this used to be an editable form writing to
// `stores.affiliate_config`, a column that was never applied to production (ADR-212) and,
// even where present, isn't what the actual `/go` exit path reads — the code-based Provider
// Registry / DEFAULT_STORE_AFFILIATE_CONFIG (src/lib/providers/registry.ts,
// src/lib/transactions/affiliate-config.ts) is the real authoritative source. Presenting an
// editable "Save" button that silently did nothing meaningful would be fabricating a working
// feature — so this now just shows the real, live value, and says where to change it.
export function AffiliateSettingsCard({ store, locale }: AffiliateSettingsCardProps) {
  const isRTL = locale === 'ar';
  const config = getAffiliateConfig(store.slug);
  const storeName = isRTL ? store.name_ar : store.name_en;
  const previewUrl = applyAffiliateTag(store.website_url, store.slug) || store.website_url;

  return (
    <Card className="rounded-[1.35rem] border-[#d7ece5] bg-white shadow-none hover:shadow-none dark:border-[#263b33] dark:bg-[#141c18]">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle className="text-xl font-black text-on-surface dark:text-white">{storeName}</CardTitle>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f8fcfa] px-2.5 py-1 text-[11px] font-black text-on-surface-variant dark:bg-[#101713] dark:text-white/60">
            <Lock className="h-3 w-3" />
            {isRTL ? 'مُدار بالكود' : 'Code-managed'}
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-on-surface-variant dark:text-white/60">
          {isRTL
            ? 'للتعديل: src/lib/providers/registry.ts ثم نشر التحديث.'
            : 'To change: edit src/lib/providers/registry.ts and deploy.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {config ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-bold text-on-surface-variant dark:text-white/50">{isRTL ? 'معامل الرابط' : 'URL parameter'}</p>
              <p dir="ltr" className="rounded-2xl border border-[#d7ece5] bg-[#f8fcfa] px-3 py-2 font-mono text-sm text-on-surface dark:border-[#263b33] dark:bg-[#101713] dark:text-white">{config.param}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-on-surface-variant dark:text-white/50">{isRTL ? 'كود العمولة' : 'Affiliate code'}</p>
              <p dir="ltr" className="rounded-2xl border border-[#d7ece5] bg-[#f8fcfa] px-3 py-2 font-mono text-sm text-on-surface dark:border-[#263b33] dark:bg-[#101713] dark:text-white">{config.value}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant dark:text-white/50">
            {isRTL ? 'لا يوجد برنامج عمولات مُهيأ لهذا المتجر — الروابط تخرج مباشرة (direct).' : 'No affiliate program configured for this store — exits go out direct.'}
          </p>
        )}

        <div className="rounded-2xl border border-[#d7ece5] bg-[#f8fcfa] p-3 dark:border-[#263b33] dark:bg-[#101713]">
          <p className="text-xs font-black text-on-surface-variant dark:text-white/55">
            {isRTL ? 'معاينة الرابط' : 'URL preview'}
          </p>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="mt-1 inline-flex max-w-full items-center gap-2 truncate font-mono text-sm text-[#1f6f59] hover:underline dark:text-[#9fe4d0]"
          >
            <span className="truncate">{previewUrl}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
