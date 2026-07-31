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
  /**
   * The control that opens this sheet. Radix restores focus on close via its own
   * `Dialog.Trigger`, and this sheet has none — `open` is driven by the parent's state,
   * so Radix's trigger ref is null and focus falls to `<body>`. Measured: after Escape,
   * focus landed on `<body>` in both locales, dumping a keyboard user back to the top of
   * a long results page. Passing the trigger lets focus return where it came from.
   */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
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
  triggerRef,
}: MobileFilterSheetProps) {
  const { isRTL } = useLocale();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onCloseAutoFocus={(event) => {
          if (!triggerRef?.current) return; // let Radix do whatever it can
          event.preventDefault();
          triggerRef.current.focus();
        }}
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[2rem] border-[color:var(--color-border)] bg-[color:var(--color-background)] p-0"
      >
        <SheetHeader className="border-b border-[color:var(--color-border)] bg-[color:var(--color-primary-container)]/70 px-5 py-4 dark:bg-[color:var(--color-card)]">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="flex items-center gap-2">
              {isRTL ? 'الفلاتر' : 'Filters'}
              {activeCount > 0 && (
                <Badge className="rounded-full bg-[color:var(--color-secondary)] text-[color:var(--color-secondary-foreground)]">
                  {activeCount}
                </Badge>
              )}
            </SheetTitle>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-sm font-extrabold text-[color:var(--color-primary)] hover:text-[color:var(--color-foreground)]"
              >
                {isRTL ? 'امسح الكل' : 'Reset'}
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:thin]">
          <FilterSidebar
            filters={filters}
            onFilterChange={onFilterChange}
            sortBy={sortBy}
            onSortChange={onSortChange}
            category={category}
            locale={locale}
          />
        </div>

        <div className="sticky bottom-0 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)]/95 p-4 backdrop-blur">
          <Button
            size="lg"
            className="h-12 w-full rounded-2xl font-extrabold"
            onClick={() => onOpenChange(false)}
          >
            {isRTL ? 'تطبيق الفلاتر' : 'Apply filters'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
