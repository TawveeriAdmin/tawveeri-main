'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { applyAffiliateTag, getAffiliateConfig } from '@/lib/transactions/affiliate-config';

interface AffiliateSettingsCardProps {
  store: {
    id: string;
    slug: string;
    name_ar: string;
    name_en: string;
    website_url: string;
    affiliate_config?: Record<string, unknown> | null;
  };
  locale: string;
}

export function AffiliateSettingsCard({ store, locale }: AffiliateSettingsCardProps) {
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const initialConfig = getAffiliateConfig(store.slug, store.affiliate_config);
  const [enabled, setEnabled] = useState(initialConfig?.enabled !== false);
  const [param, setParam] = useState(initialConfig?.param || '');
  const [value, setValue] = useState(initialConfig?.value || '');
  const [saving, setSaving] = useState(false);

  const storeName = isRTL ? store.name_ar : store.name_en;
  const previewUrl = useMemo(
    () => applyAffiliateTag(store.website_url, store.slug, { enabled, param, value }) || store.website_url,
    [enabled, param, store.slug, store.website_url, value],
  );

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/stores/${store.id}/affiliate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, param, value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update affiliate settings');
      }

      toast({
        title: isRTL ? 'تم حفظ إعدادات العمولة' : 'Affiliate settings saved',
        description: storeName,
      });
    } catch (error) {
      toast({
        title: isRTL ? 'فشل الحفظ' : 'Save failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-[1.35rem] border-[#d7ece5] bg-white shadow-none hover:shadow-none dark:border-[#263b33] dark:bg-[#141c18]">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl font-black text-on-surface dark:text-white">{storeName}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant dark:text-white/60">
              {isRTL
                ? 'أضف كود العمولة الذي سيُرفق تلقائياً بروابط الشراء لهذا المتجر.'
                : 'Configure the affiliate parameter automatically appended to outbound store links.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor={`affiliate-enabled-${store.id}`} className="text-sm font-bold text-on-surface-variant dark:text-white/65">
              {isRTL ? 'مفعّل' : 'Enabled'}
            </Label>
            <Switch
              id={`affiliate-enabled-${store.id}`}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`affiliate-param-${store.id}`} className="font-bold text-on-surface dark:text-white">
              {isRTL ? 'اسم معامل الرابط' : 'URL parameter'}
            </Label>
            <Input
              id={`affiliate-param-${store.id}`}
              dir="ltr"
              value={param}
              onChange={(event) => setParam(event.target.value)}
              placeholder={store.slug === 'amazon' ? 'tag' : 'aff_code'}
              className="h-11 rounded-2xl border-[#d7ece5] bg-[#f8fcfa] font-mono dark:border-[#263b33] dark:bg-[#101713] dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`affiliate-value-${store.id}`} className="font-bold text-on-surface dark:text-white">
              {isRTL ? 'كود العمولة' : 'Affiliate code'}
            </Label>
            <Input
              id={`affiliate-value-${store.id}`}
              dir="ltr"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={store.slug === 'amazon' ? 'tawveeri0f-21' : 'C1000094L'}
              className="h-11 rounded-2xl border-[#d7ece5] bg-[#f8fcfa] font-mono dark:border-[#263b33] dark:bg-[#101713] dark:text-white"
            />
          </div>
        </div>

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

        <Button
          onClick={save}
          disabled={saving || (enabled && (!param.trim() || !value.trim()))}
          className="rounded-2xl bg-[#1f6f59] px-5 font-black text-white hover:bg-[#1b604d]"
        >
          <Save className="h-4 w-4" />
          {saving ? (isRTL ? 'جار الحفظ...' : 'Saving...') : (isRTL ? 'حفظ الإعدادات' : 'Save settings')}
        </Button>
      </CardContent>
    </Card>
  );
}
