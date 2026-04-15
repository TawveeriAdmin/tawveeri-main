'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterSidebar, type SearchFilters, type SearchSortOption } from '@/components/search/filter-sidebar';
import { useLocale } from '@/lib/simple-intl-provider';
import type { ProductCategory } from '@/lib/database/types';

interface MobileFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SearchFilters;
  onFilterChange: (next: SearchFilters) => void;
  onClearAll: () => void;
  sortBy?: SearchSortOption;
  onSortChange?: (sort: SearchSortOption) => void;
  category?: ProductCategory;
  locale?: string;
  activeCount: number;
}

/** Bottom-sheet wrapper around the existing FilterSidebar for mobile. */
export function MobileFilterSheet({
  open,
  onOpenChange,
  filters,
  onFilterChange,
  onClearAll,
  sortBy,
  onSortChange,
  category,
  locale,
  activeCount,
}: MobileFilterSheetProps) {
  const { isRTL } = useLocale();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-[color:var(--color-outline-variant)]/50 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="flex items-center gap-2">
              {isRTL ? 'الفلاتر' : 'Filters'}
              {activeCount > 0 && (
                <Badge variant="success" className="t-caption">
                  {activeCount}
                </Badge>
              )}
            </SheetTitle>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="t-small font-semibold text-[var(--brand-gold-dark)] hover:text-[var(--brand-green-dark)]"
              >
                {isRTL ? 'امسح الكل' : 'Reset'}
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <FilterSidebar
            filters={filters}
            onFilterChange={onFilterChange}
            sortBy={sortBy}
            onSortChange={onSortChange}
            category={category}
            locale={locale}
          />
        </div>

        <div className="border-t border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-4 sticky bottom-0">
          <Button
            size="lg"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {isRTL ? 'تطبيق الفلاتر' : 'Apply filters'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
