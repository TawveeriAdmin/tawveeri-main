'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getSavedSearches, deleteSavedSearch, saveSearch } from '@/lib/search/saved-searches';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Search, Plus, X } from 'lucide-react';
import type { SearchFilters } from './filter-sidebar';

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

      toast({
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? 'تم حفظ البحث بنجاح' : 'Search saved successfully',
      });

      setSaveDialogOpen(false);
      setSearchName('');
      loadSavedSearches();
    } catch (error) {
      console.error('Error saving search:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل حفظ البحث' : 'Failed to save search',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (searchId: string) => {
    if (!user) return;

    if (!confirm(isRTL ? 'هل أنت متأكد من حذف هذا البحث؟' : 'Are you sure you want to delete this search?')) {
      return;
    }

    try {
      const result = await deleteSavedSearch(searchId, user.id);
      if (result.error) throw result.error;

      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? 'تم حذف البحث بنجاح' : 'Search deleted successfully',
      });

      loadSavedSearches();
    } catch (error) {
      console.error('Error deleting search:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل حذف البحث' : 'Failed to delete search',
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
              {isRTL ? 'البحوث المحفوظة' : 'Saved Searches'}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              disabled={!currentQuery && !currentFilters}
            >
              <Plus className="w-4 h-4 mr-1" />
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {isRTL ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : savedSearches.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {isRTL ? 'لا توجد بحوث محفوظة' : 'No saved searches'}
            </div>
          ) : (
            <div className="space-y-2">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group"
                  onClick={() => handleSearchClick(search)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {search.name}
                    </p>
                    {search.search_query && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
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
            <DialogTitle>{isRTL ? 'حفظ البحث' : 'Save Search'}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? 'أدخل اسماً لهذا البحث لحفظه للاستخدام لاحقاً'
                : 'Enter a name for this search to save it for later use'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="searchName">{isRTL ? 'اسم البحث' : 'Search Name'}</Label>
              <Input
                id="searchName"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder={isRTL ? 'مثال: هواتف Apple' : 'e.g., Apple phones'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveSearch} disabled={!searchName.trim()}>
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

