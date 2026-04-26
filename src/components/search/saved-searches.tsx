'use client';

import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getSavedSearches, deleteSavedSearch, saveSearch, type SavedSearch } from '@/lib/search/saved-searches';
import { createNotification } from '@/lib/auth/notifications';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { BookmarkCheck, CalendarDays, Filter, Play, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { SearchFilters } from './filter-sidebar';
import { useTranslations } from '@/lib/simple-intl-provider';
import { formatDate } from '@/lib/formatting';

interface SavedSearchesProps {
  locale: string;
  currentQuery?: string;
  currentFilters?: SearchFilters;
  onSearchSelect: (query: string, filters: SearchFilters) => void;
}

export function SavedSearches({
  locale,
  currentQuery = '',
  currentFilters,
  onSearchSelect,
}: SavedSearchesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useTranslations();
  const isRTL = locale === 'ar';
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const canSaveCurrentSearch = Boolean(currentQuery || currentFilters);

  const loadSavedSearches = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await getSavedSearches(user.id);
      if (result.error) throw result.error;
      setSavedSearches(result.data || []);
    } catch (error) {
      console.error('Error loading saved searches:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSavedSearches();
    }
  }, [user, loadSavedSearches]);

  const handleSaveSearch = async () => {
    if (!user || !searchName.trim()) return;

    try {
      const result = await saveSearch({
        userId: user.id,
        name: searchName.trim(),
        query: currentQuery,
        filters: currentFilters || {},
      });

      if (result.error) throw result.error;

      // Required Action Pattern: in-app notification + audit log (email skipped — no template)
      const savedId = result.data?.id ?? null;
      createNotification({
        user_id: user.id,
        type: 'system',
        title_ar: 'تم حفظ البحث',
        title_en: 'Search saved',
        message_ar: `تم حفظ البحث "${searchName.trim()}" بنجاح.`,
        message_en: `Search "${searchName.trim()}" saved successfully.`,
      }).catch(() => {});

      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saved_search_created',
          entity_type: 'saved_search',
          entity_id: savedId,
          details: { name: searchName.trim(), query: currentQuery || null },
        }),
      }).catch(() => {});

      toast({
        title: t('search.savedSearches.saved'),
        description: t('search.savedSearches.searchSaved'),
      });

      setSaveDialogOpen(false);
      setSearchName('');
      loadSavedSearches();
    } catch (error) {
      console.error('Error saving search:', error);
      toast({
        title: t('search.savedSearches.error'),
        description: t('search.savedSearches.saveFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (searchId: string) => {
    if (!user) return;

    if (!confirm(t('search.savedSearches.confirmDelete'))) {
      return;
    }

    try {
      const result = await deleteSavedSearch(searchId, user.id);
      if (result.error) throw result.error;

      // Audit log (deletion is a destructive action, worth tracking — notification skipped to avoid noise)
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saved_search_deleted',
          entity_type: 'saved_search',
          entity_id: searchId,
        }),
      }).catch(() => {});

      toast({
        title: t('search.savedSearches.deleted'),
        description: t('search.savedSearches.searchDeleted'),
      });

      loadSavedSearches();
    } catch (error) {
      console.error('Error deleting search:', error);
      toast({
        title: t('search.savedSearches.error'),
        description: t('search.savedSearches.deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const getFilterCount = (filters: SavedSearch['filters'] | SearchFilters | undefined) => {
    if (!filters) return 0;
    return Object.values(filters).reduce((count, value) => {
      if (Array.isArray(value)) return count + value.length;
      if (value && typeof value === 'object') {
        return count + Object.values(value).filter((nested) => Array.isArray(nested) ? nested.length > 0 : Boolean(nested)).length;
      }
      return value === undefined || value === null || value === false || value === '' ? count : count + 1;
    }, 0);
  };

  const searchesWithQuery = savedSearches.filter((search) => Boolean(search.search_query)).length;
  const searchesWithFilters = savedSearches.filter((search) => getFilterCount(search.filters) > 0).length;

  const handleSearchClick = (search: SavedSearch) => {
    const query = search.search_query || '';
    const filters = search.filters || {};
    onSearchSelect(query, filters as SearchFilters);
  };

  if (!user) {
    return null; // Don't show saved searches for guests
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950 md:p-5">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Search className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-950 dark:text-white">{t('search.savedSearches.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isRTL ? 'شغّل أي بحث محفوظ بنفس الكلمات والفلاتر.' : 'Run any saved search with its original query and filters.'}
              </p>
            </div>
          </div>
          <Button
            variant={canSaveCurrentSearch ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            disabled={!canSaveCurrentSearch}
            className="h-10 rounded-2xl"
          >
            <Plus className="me-1.5 h-4 w-4" />
            {t('search.savedSearches.save')}
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : savedSearches.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-5 py-14 text-center dark:border-gray-800 dark:bg-gray-900/40">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <BookmarkCheck className="h-6 w-6" />
            </div>
            <p className="text-lg font-bold text-gray-950 dark:text-white">{t('search.savedSearches.noSearches')}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
              {isRTL
                ? 'ابدأ من صفحة البحث واحفظ الكلمات والفلاتر التي تستخدمها كثيراً.'
                : 'Start from search and save the queries and filters you use often.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {savedSearches.map((search) => {
              const filterCount = getFilterCount(search.filters);
              return (
                <div
                  key={search.id}
                  className="group rounded-3xl border border-gray-100 bg-gray-50/70 p-4 transition hover:-translate-y-0.5 hover:border-[var(--brand-green)]/40 hover:bg-white hover:shadow-sm dark:border-gray-800 dark:bg-gray-900/60 dark:hover:bg-gray-900"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-start"
                      onClick={() => handleSearchClick(search)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--brand-green-dark)] shadow-sm dark:bg-gray-950 dark:text-emerald-300">
                          <Search className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-bold text-gray-950 dark:text-white" title={search.name}>
                            {search.name}
                          </p>
                          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400" dir="auto">
                            {search.search_query || (isRTL ? 'بحث بالفلاتر فقط' : 'Filter-only search')}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                      <Button size="sm" onClick={() => handleSearchClick(search)} className="h-9 rounded-xl">
                        <Play className="me-1.5 h-3.5 w-3.5" />
                        {isRTL ? 'تشغيل' : 'Run'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl text-destructive hover:text-destructive"
                        onClick={() => handleDelete(search.id)}
                      >
                        <Trash2 className="me-1.5 h-3.5 w-3.5" />
                        {isRTL ? 'حذف' : 'Delete'}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 dark:bg-gray-950">
                      <Filter className="h-3.5 w-3.5" />
                      {filterCount} {isRTL ? 'فلتر' : 'filters'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 dark:bg-gray-950">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(search.created_at, locale)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <BookmarkCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-gray-950 dark:text-white">{isRTL ? 'ملخص البحث' : 'Search summary'}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{isRTL ? 'حالة عمليات البحث المحفوظة' : 'Saved search status'}</p>
            </div>
          </div>
          <div className="grid gap-3">
            {[
              [isRTL ? 'الإجمالي' : 'Total', savedSearches.length],
              [isRTL ? 'بكلمات بحث' : 'With query', searchesWithQuery],
              [isRTL ? 'بفلاتر' : 'With filters', searchesWithFilters],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/70">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</span>
                <span className="text-xl font-bold tabular-nums text-gray-950 dark:text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-gray-950 dark:text-white">{isRTL ? 'ماذا يتم حفظه؟' : 'What gets saved?'}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{isRTL ? 'الكلمات والفلاتر المستخدمة' : 'Query terms and selected filters'}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <p className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-900/70">
              {isRTL ? 'اسم مخصص يساعدك على تمييز البحث لاحقاً.' : 'A custom name to recognize the search later.'}
            </p>
            <p className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-900/70">
              {isRTL ? 'كلمات البحث والفلاتر مثل العلامة التجارية والسعر والمتجر.' : 'Search text plus filters such as brand, price, and store.'}
            </p>
          </div>
        </div>
      </aside>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('search.savedSearches.saveSearch')}</DialogTitle>
            <DialogDescription>
              {t('search.savedSearches.saveSearchDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="searchName">{t('search.savedSearches.searchName')}</Label>
              <Input
                id="searchName"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder={t('search.savedSearches.searchNamePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              {t('search.savedSearches.cancel')}
            </Button>
            <Button onClick={handleSaveSearch} disabled={!searchName.trim()}>
              {t('search.savedSearches.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
