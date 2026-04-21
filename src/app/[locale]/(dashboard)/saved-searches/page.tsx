'use client';

import { useParams, useRouter } from 'next/navigation';
import { SavedSearches } from '@/components/search/saved-searches';
import type { SearchFilters } from '@/components/search/filter-sidebar';
import { useTranslations } from '@/lib/simple-intl-provider';

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
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-headline-lg text-on-surface">
          {t('search.savedSearches.title')}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {locale === 'ar'
            ? 'إدارة عمليات البحث المحفوظة وإعادة تشغيلها بنقرة واحدة.'
            : 'Manage your saved searches and rerun any of them with one click.'}
        </p>
      </header>

      <SavedSearches
        locale={locale}
        currentQuery=""
        currentFilters={undefined}
        onSearchSelect={handleSelect}
      />
    </div>
  );
}
