'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SavedSearches } from '@/components/search/saved-searches';
import type { SearchFilters } from '@/components/search/filter-sidebar';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Button } from '@/components/ui/button';
import { BookmarkCheck, Search, Sparkles } from 'lucide-react';

export default function SavedSearchesPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();

  const handleSelect = (query: string, filters: SearchFilters) => {
    const sp = new URLSearchParams();
    if (query) sp.set('q', query);
    // Encode common filters (minimal — the search page picks what it recognises).
    if (filters?.brands?.length) sp.set('brand', filters.brands[0]);
    if (filters?.minPrice !== undefined) sp.set('min_price', String(filters.minPrice));
    if (filters?.maxPrice !== undefined) sp.set('max_price', String(filters.maxPrice));
    const qs = sp.toString();
    router.push(`/${locale}/search${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <section className="overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,rgba(45,178,139,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,1),rgba(244,249,247,1))] p-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(45,178,139,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,1),rgba(3,7,18,1))] md:p-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--brand-green-dark)] shadow-sm dark:bg-gray-900/80 dark:text-emerald-300">
              <BookmarkCheck className="h-3.5 w-3.5" />
              {locale === 'ar' ? 'اختصارات البحث' : 'Search shortcuts'}
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-normal text-gray-950 dark:text-white md:text-4xl">
              {t('search.savedSearches.title')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              {locale === 'ar'
                ? 'إدارة عمليات البحث المحفوظة وإعادة تشغيلها بنقرة واحدة.'
                : 'Manage your saved searches and rerun any of them with one click.'}
            </p>
            <Button asChild className="mt-6 h-11 rounded-2xl px-5">
              <Link href={`/${locale}/search`}>
                <Search className="me-2 h-4 w-4" />
                {locale === 'ar' ? 'بحث جديد' : 'New search'}
              </Link>
            </Button>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-950 dark:text-white">
              {locale === 'ar' ? 'احفظ البحث المتكرر مرة واحدة.' : 'Save repeated searches once.'}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {locale === 'ar'
                ? 'ارجع لاحقاً لنفس الكلمات والفلاتر بدون إعادة ضبطها من البداية.'
                : 'Return later to the same query and filters without rebuilding them.'}
            </p>
          </div>
        </div>
      </section>

      <SavedSearches
        locale={locale}
        currentQuery=""
        currentFilters={undefined}
        onSearchSelect={handleSelect}
      />
    </div>
  );
}
