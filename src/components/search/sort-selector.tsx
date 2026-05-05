'use client';

import { useLocale } from '@/lib/simple-intl-provider';
import { cn } from '@/lib/utils';
import type { SearchSortOption } from '@/components/search/filter-sidebar';

interface SortSelectorProps {
  value: SearchSortOption;
  onChange: (value: SearchSortOption) => void;
  className?: string;
}

const OPTIONS: { value: SearchSortOption; ar: string; en: string }[] = [
  { value: 'popularity', ar: 'الأكثر صلة', en: 'Relevance' },
  { value: 'price_low', ar: 'الأقل سعرًا', en: 'Price ↑' },
  { value: 'price_high', ar: 'الأعلى سعرًا', en: 'Price ↓' },
  { value: 'rating', ar: 'الأعلى تقييمًا', en: 'Rating' },
];

/**
 * Segmented sort control. Replaces the popover that used to live in search-client.
 */
export function SortSelector({ value, onChange, className }: SortSelectorProps) {
  const { isRTL } = useLocale();
  return (
    <div
      role="tablist"
      aria-label={isRTL ? 'الترتيب' : 'Sort'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-1',
        'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'shrink-0 snap-start rounded-full px-3 py-1.5 t-small font-medium transition-colors',
              active
                ? 'bg-[var(--brand-green)] text-white shadow-[var(--elevation-1)]'
                : 'text-on-surface-variant hover:bg-[var(--brand-bg-green)] hover:text-[var(--brand-green-dark)]',
            )}
          >
            {isRTL ? opt.ar : opt.en}
          </button>
        );
      })}
    </div>
  );
}
