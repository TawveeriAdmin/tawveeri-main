'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getSavedSearches, deleteSavedSearch, saveSearch } from '@/lib/search/saved-searches';
import { createNotification } from '@/lib/auth/notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Search, Plus, X } from 'lucide-react';
import type { SearchFilters } from './filter-sidebar';
import { useTranslations } from '@/lib/simple-intl-provider';

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
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    if (user) {
      loadSavedSearches();
    }
  }, [user]);

  const loadSavedSearches = async () => {
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
  };

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

  const handleSearchClick = (search: any) => {
    const query = search.search_query || '';
    const filters = search.filters || {};
    onSearchSelect(query, filters as SearchFilters);
  };

  if (!user) {
    return null; // Don't show saved searches for guests
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              {t('search.savedSearches.title')}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              disabled={!currentQuery && !currentFilters}
            >
              <Plus className="w-4 h-4 me-1" />
              {t('search.savedSearches.save')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-on-surface-variant">
              {t('search.savedSearches.loading')}
            </div>
          ) : savedSearches.length === 0 ? (
            <div className="text-sm text-on-surface-variant text-center py-4">
              {t('search.savedSearches.noSearches')}
            </div>
          ) : (
            <div className="space-y-2">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-on-surface/8 cursor-pointer group"
                  onClick={() => handleSearchClick(search)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-on-surface truncate">
                      {search.name}
                    </p>
                    {search.search_query && (
                      <p className="text-xs text-on-surface-variant truncate">
                        {search.search_query}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(search.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}

