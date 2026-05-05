'use client';

import { Activity, Clock3, Database, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type GuidePage = 'schedules' | 'runs' | 'health' | 'live-search';
type LocaleKey = 'en' | 'ar';

const ICONS = {
  database: Database,
  clock: Clock3,
  shield: ShieldCheck,
  activity: Activity,
  warning: TriangleAlert,
  search: Search,
};

const COPY: Record<LocaleKey, Record<GuidePage, {
  title: string;
  body: string;
  items: Array<{ icon: keyof typeof ICONS; label: string }>;
}>> = {
  en: {
    schedules: {
      title: 'Scraper operating rules',
      body: 'Discovery adds catalog offers. Price update refreshes existing offers. Customer search reads the catalog only.',
      items: [
        { icon: 'database', label: 'Leave discovery categories empty for full coverage' },
        { icon: 'clock', label: 'Keep price coverage mode on for the 24h target' },
        { icon: 'shield', label: 'Manual runs require CRON_SECRET' },
      ],
    },
    runs: {
      title: 'Run review rules',
      body: 'Use this page to verify whether a run completed, partially completed, or failed before tuning schedules.',
      items: [
        { icon: 'activity', label: 'Success means zero counted errors' },
        { icon: 'warning', label: 'Partial usually means product URL or parser misses' },
        { icon: 'database', label: 'Use details before changing catalog data' },
      ],
    },
    health: {
      title: 'Refresh health rules',
      body: 'This is the release dashboard for catalog freshness. Coverage should trend toward the target window.',
      items: [
        { icon: 'activity', label: 'Aim for 90%+ refreshed in 24h' },
        { icon: 'warning', label: 'Stale rows need schedule or batch tuning' },
        { icon: 'shield', label: 'Chronic failures are skipped until fixed' },
      ],
    },
    'live-search': {
      title: 'Admin-only live search',
      body: 'Use this for QA and controlled ingest. Normal users cannot trigger live scraping.',
      items: [
        { icon: 'search', label: 'Start with one page and a few stores' },
        { icon: 'database', label: 'Ingest only valid Tawveeri products' },
        { icon: 'shield', label: 'Public search stays catalog-backed' },
      ],
    },
  },
  ar: {
    schedules: {
      title: 'قواعد تشغيل السكرابر',
      body: 'الاكتشاف يضيف عروضا للكتالوج. تحديث الأسعار يراجع العروض الموجودة. بحث العملاء يعتمد على الكتالوج فقط.',
      items: [
        { icon: 'database', label: 'اترك التصنيفات فارغة لتغطية الاكتشاف بالكامل' },
        { icon: 'clock', label: 'اترك وضع التغطية مفعلا لهدف 24 ساعة' },
        { icon: 'shield', label: 'التشغيل اليدوي يتطلب CRON_SECRET' },
      ],
    },
    runs: {
      title: 'قواعد مراجعة التشغيل',
      body: 'استخدم هذه الصفحة لمعرفة هل اكتمل التشغيل أو اكتمل جزئيا أو فشل قبل تعديل الجداول.',
      items: [
        { icon: 'activity', label: 'نجاح يعني عدم وجود أخطاء محسوبة' },
        { icon: 'warning', label: 'جزئي غالبا يعني رابط منتج أو محلل صفحة يحتاج إصلاحا' },
        { icon: 'database', label: 'راجع التفاصيل قبل تعديل بيانات الكتالوج' },
      ],
    },
    health: {
      title: 'قواعد صحة التحديث',
      body: 'هذه لوحة متابعة جاهزية الكتالوج. يجب أن تتحسن التغطية باتجاه نافذة التحديث المستهدفة.',
      items: [
        { icon: 'activity', label: 'استهدف تحديث 90% أو أكثر خلال 24 ساعة' },
        { icon: 'warning', label: 'الصفوف القديمة تحتاج ضبط الجدولة أو الدفعات' },
        { icon: 'shield', label: 'الإخفاقات المتكررة يتم تجاوزها حتى إصلاحها' },
      ],
    },
    'live-search': {
      title: 'البحث المباشر للمدير فقط',
      body: 'استخدمه للاختبار والإدخال المنضبط. المستخدمون لا يستطيعون تشغيل السكرابر المباشر.',
      items: [
        { icon: 'search', label: 'ابدأ بصفحة واحدة وعدد قليل من المتاجر' },
        { icon: 'database', label: 'أدخل المنتجات المناسبة لتوفيري فقط' },
        { icon: 'shield', label: 'بحث العملاء يبقى معتمدا على الكتالوج' },
      ],
    },
  },
};

export function ScrapingAdminGuide({
  page,
  locale,
  className,
}: {
  page: GuidePage;
  locale: string;
  className?: string;
}) {
  const copy = COPY[locale === 'ar' ? 'ar' : 'en'][page];

  return (
    <section
      className={cn(
        'rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3',
        className,
      )}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-on-surface">{copy.title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{copy.body}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {copy.items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface-variant"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {item.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
