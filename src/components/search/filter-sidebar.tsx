'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';
import { Price } from '@/components/ui/price';
import { cn } from '@/lib/utils';
import { SEARCH_STORE_DISPLAY_NAMES, getSearchStoreLogoPath } from '@/lib/scraping/product-adapter';
import { SUPPORTED_SEARCH_STORES } from '@/lib/scraping/search/store-registry';
import { isDisplayableRetailer } from '@/lib/retailers/approved-retailers';
import {
  Tag,
  DollarSign,
  Store,
  Star,
  ArrowUpDown,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  TrendingUp,
  ChevronDown,
  RotateCcw,
  Percent,
  Check,
  Cpu,
} from 'lucide-react';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { CATEGORY_SPEC_FILTERS, type SpecFilterDefinition } from '@/lib/scraping/config/spec-configs';

export interface SearchFilters {
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  stores: string[];
  availability: AvailabilityStatus[];
  dealsOnly: boolean;
  freeDeliveryOnly?: boolean;
  minRating?: number;
  specs?: Record<string, string[]>;
  discount?: number;
  condition?: string[];
  shipping?: string[];
}

export type SearchSortOption = 'popularity' | 'price_low' | 'price_high' | 'rating';

interface FilterSidebarProps {
  filters: SearchFilters;
  onFilterChange: (filters: SearchFilters) => void;
  sortBy?: SearchSortOption;
  onSortChange?: (sort: SearchSortOption) => void;
  category?: ProductCategory;
  locale?: string;
}

// Collapsible filter section
function FilterSection({
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[color:var(--color-border)]/70 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-3 text-start transition hover:bg-[color:var(--color-muted)]/60"
        aria-expanded={open}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-primary)] group-hover:text-white dark:bg-[color:var(--color-muted)]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-extrabold text-[color:var(--color-foreground)]">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-[color:var(--color-secondary)] px-2 py-0.5 font-mono text-[10px] font-black text-[color:var(--color-secondary-foreground)]">
            {badge}
          </span>
        )}
        <ChevronDown className={cn(
          'h-4 w-4 text-[color:var(--color-muted-foreground)] transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>
      {/* No max-height animation — `max-h-0` + `overflow-hidden` clips tall lists (~5 rows visible) in some layouts. */}
      <div className={cn(!open && 'hidden', 'pb-3')}>
        <div className="ms-5 min-h-0 border-s border-[color:var(--color-border)]/70 ps-4 pe-1 pb-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export function FilterSidebar({
  filters,
  onFilterChange,
  sortBy = 'popularity',
  onSortChange,
  category,
  locale: propLocale,
}: FilterSidebarProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = propLocale || (params?.locale as string) || 'ar';

  const getSupabase = () => {
    if (typeof window === 'undefined') return null;
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  };
  const supabase = getSupabase();

  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);

  // Store filter options — gated to the approved-27 scope (Founder Directive 2026-07-27), so
  // non-approved stores (e.g. samsung_ksa, shaker) never appear as a public filter.
  const availableStores = useMemo(() => {
    return [...SUPPORTED_SEARCH_STORES]
      // Display surface → the DISPLAY gate. See stores-listing-client for why.
      .filter((slug) => isDisplayableRetailer(slug))
      .map((slug) => {
        const names = SEARCH_STORE_DISPLAY_NAMES[slug];
        return {
          id: slug,
          slug,
          name_ar: names?.name_ar ?? slug,
          name_en: names?.name_en ?? slug,
        };
      })
      .sort((a, b) => {
        const aLabel = locale === 'ar' ? a.name_ar : a.name_en;
        const bLabel = locale === 'ar' ? b.name_ar : b.name_en;
        return aLabel.localeCompare(bLabel, locale === 'ar' ? 'ar' : 'en');
      });
  }, [locale]);

  // Fetch available brands
  useEffect(() => {
    async function fetchBrands() {
      if (!category || !supabase) return;
      try {
        const { data } = await supabase
          .from('products')
          .select('brand')
          .eq('category', category)
          .eq('is_active', true)
          .returns<Array<{ brand: string | null }>>();

        if (data) {
          const uniqueBrands = Array.from(
            new Set(data.map((p) => p.brand).filter((brand): brand is string => Boolean(brand)))
          ).sort();
          setAvailableBrands(uniqueBrands);
        }
      } catch (error) {
        console.error('Error fetching brands:', error);
      }
    }
    fetchBrands();
  }, [category, supabase]);

  // Fetch price range
  useEffect(() => {
    async function fetchPriceRange() {
      if (!supabase) return;
      try {
        const { data } = await supabase
          .from('product_stores')
          .select('current_price')
          .order('current_price', { ascending: true })
          .limit(1)
          .returns<Array<{ current_price: number | null }>>();

        const minPrice = data?.[0]?.current_price || 0;

        const { data: maxData } = await supabase
          .from('product_stores')
          .select('current_price')
          .order('current_price', { ascending: false })
          .limit(1)
          .returns<Array<{ current_price: number | null }>>();

        const maxPrice = maxData?.[0]?.current_price || 100000;

        setPriceRange([minPrice, maxPrice]);
      } catch (error) {
        console.error('Error fetching price range:', error);
      }
    }
    fetchPriceRange();
  }, [supabase]);

  const handleBrandToggle = (brand: string) => {
    const newBrands = filters.brands.includes(brand)
      ? filters.brands.filter((b) => b !== brand)
      : [...filters.brands, brand];
    onFilterChange({ ...filters, brands: newBrands });
  };

  const handleStoreToggle = (storeSlug: string) => {
    const newStores = filters.stores.includes(storeSlug)
      ? filters.stores.filter((s) => s !== storeSlug)
      : [...filters.stores, storeSlug];
    onFilterChange({ ...filters, stores: newStores });
  };

  const handlePriceChange = (values: number[]) => {
    onFilterChange({
      ...filters,
      minPrice: values[0],
      maxPrice: values[1],
    });
  };

  const handleClearFilters = () => {
    onFilterChange({
      brands: [],
      stores: [],
      availability: [],
      dealsOnly: false,
      freeDeliveryOnly: false,
      minPrice: undefined,
      maxPrice: undefined,
      minRating: undefined,
      specs: undefined,
      discount: undefined,
      condition: undefined,
      shipping: undefined,
    });
  };

  const handleSpecToggle = (specKey: string, value: string) => {
    const currentSpecs = filters.specs || {};
    const currentValues = currentSpecs[specKey] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    const newSpecs = { ...currentSpecs, [specKey]: newValues };
    if (newValues.length === 0) delete newSpecs[specKey];
    onFilterChange({ ...filters, specs: Object.keys(newSpecs).length > 0 ? newSpecs : undefined });
  };

  const handleDiscountToggle = (value: number) => {
    onFilterChange({ ...filters, discount: filters.discount === value ? undefined : value });
  };

  const specFilters: SpecFilterDefinition[] = category ? (CATEGORY_SPEC_FILTERS[category] || []) : [];
  const sortOptions = useMemo(() => [
    {
      value: 'popularity' as SearchSortOption,
      label: t('search.sortPopularity'),
      icon: TrendingUp,
    },
    {
      value: 'price_low' as SearchSortOption,
      label: t('search.sortPriceLow'),
      icon: ArrowDownNarrowWide,
    },
    {
      value: 'price_high' as SearchSortOption,
      label: t('search.sortPriceHigh'),
      icon: ArrowUpNarrowWide,
    },
    // 'rating' REMOVED 2026-07-31 (Principle 3 / F3) — it had no implementation in
    // `compareBySort` and no data (0 of 48 cards carry a rating; 72 of 9,367 products, 0.77%).
    // This list feeds the MOBILE filter sheet, so leaving it here would have kept the dead
    // control alive on phones after removing it from the desktop selector.
  ], [t]);

  const pricePresets = useMemo(() => {
    const [min, max] = priceRange;
    const span = Math.max(0, max - min);
    if (span < 100) return [];

    const round = (value: number) => Math.round(value / 100) * 100;
    const q1 = round(min + span * 0.25);
    const q2 = round(min + span * 0.6);

    return [
      {
        key: 'budget',
        label: locale === 'ar' ? 'اقتصادي' : 'Budget',
        min,
        max: q1,
      },
      {
        key: 'mid',
        label: locale === 'ar' ? 'متوسط' : 'Mid Range',
        min: q1,
        max: q2,
      },
      {
        key: 'premium',
        label: locale === 'ar' ? 'فاخر' : 'Premium',
        min: q2,
        max,
      },
    ];
  }, [priceRange, locale]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.brands.length > 0) count += filters.brands.length;
    if (filters.stores.length > 0) count += filters.stores.length;
    if (filters.availability.length > 0) count += filters.availability.length;
    if (filters.dealsOnly) count++;
    if (filters.freeDeliveryOnly) count++;
    if (filters.minRating && filters.minRating > 0) count++;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.specs) count += Object.values(filters.specs).reduce((sum, arr) => sum + arr.length, 0);
    if (filters.discount) count++;
    if (filters.condition) count += filters.condition.length;
    if (filters.shipping) count += filters.shipping.length;
    return count;
  }, [filters]);

  return (
    <aside
      aria-label={t('search.filtersTitle')}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="flex max-h-full w-full flex-col overflow-hidden rounded-[1.75rem] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/92 shadow-[0_14px_34px_-30px_rgba(26,26,26,0.42)] backdrop-blur-xl dark:bg-[color:var(--color-card)]/72"
    >
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-primary-container)]/70 px-4 py-4 dark:bg-[color:var(--color-muted)]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--color-primary)] text-white">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
                <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
                <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
                <line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" />
                <line x1="18" x2="22" y1="16" y2="16" />
              </svg>
            </div>
            <div>
              <span className="block text-sm font-black text-[color:var(--color-foreground)]">{t('search.filtersTitle')}</span>
              <span className="text-[11px] font-bold text-[color:var(--color-muted-foreground)]">
                {locale === 'ar' ? 'ضيّق النتائج بسرعة' : 'Narrow results fast'}
              </span>
            </div>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-[color:var(--color-secondary)] px-2 py-0.5 font-mono text-[10px] font-black text-[color:var(--color-secondary-foreground)]">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 rounded-full bg-[color:var(--color-background)] px-3 py-1.5 text-xs font-extrabold text-[color:var(--color-primary)] transition hover:text-[color:var(--color-foreground)]"
            >
              <RotateCcw className="h-3 w-3" />
              {t('search.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Filter sections — scroll the whole aside via parent `.sticky.overflow-y-auto` on search page */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5 pt-1 [scrollbar-width:thin]">
        {/* Sort */}
        {onSortChange && (
          <FilterSection icon={ArrowUpDown} title={t('search.sortBy')} defaultOpen>
            <div className="space-y-1">
              {sortOptions.map((option) => {
                const isActive = sortBy === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => onSortChange(option.value)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition',
                      isActive
                        ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]'
                        : 'border-transparent text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]/60'
                    )}
                  >
                    <Icon className={cn(
                      'h-4 w-4',
                      isActive ? 'text-[color:var(--color-primary)]' : 'text-[color:var(--color-muted-foreground)]'
                    )} />
                    <span className="flex-1 text-sm font-bold">{option.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-[color:var(--color-primary)]" />}
                  </button>
                );
              })}
            </div>
          </FilterSection>
        )}

        {/* Price Range */}
        <FilterSection icon={DollarSign} title={t('search.filters.priceRange')} defaultOpen>
          <div className="space-y-4 pt-3">
            <Slider
              value={[filters.minPrice ?? priceRange[0], filters.maxPrice ?? priceRange[1]]}
              onValueChange={handlePriceChange}
              min={priceRange[0]}
              max={priceRange[1]}
              step={100}
              className="w-full"
            />
            {pricePresets.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {pricePresets.map((preset) => {
                  const isActive = (filters.minPrice ?? priceRange[0]) === preset.min &&
                    (filters.maxPrice ?? priceRange[1]) === preset.max;
                  return (
                    <button
                      key={preset.key}
                      onClick={() => onFilterChange({ ...filters, minPrice: preset.min, maxPrice: preset.max })}
                      className={cn(
                        'rounded-xl border py-2 text-xs font-bold transition',
                        isActive
                          ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]'
                          : 'border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-container)]'
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 rounded-xl bg-[color:var(--color-muted)] px-2.5 py-2 text-center">
                <Price amount={filters.minPrice ?? priceRange[0]} className="text-xs font-semibold tabular-nums" />
              </div>
              <span className="text-xs text-[color:var(--color-muted-foreground)]">—</span>
              <div className="flex-1 rounded-xl bg-[color:var(--color-muted)] px-2.5 py-2 text-center">
                <Price amount={filters.maxPrice ?? priceRange[1]} className="text-xs font-semibold tabular-nums" />
              </div>
            </div>
          </div>
        </FilterSection>

        {/* Stores */}
        {availableStores.length > 0 && (
          <FilterSection
            icon={Store}
            title={t('search.filters.stores')}
            badge={filters.stores.length}
          >
            <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pe-1 [scrollbar-width:thin]" data-store-filter-count={availableStores.length}>
              {availableStores.map((store) => {
                const storeName = locale === 'ar' ? store.name_ar : store.name_en;
                const isChecked = filters.stores.includes(store.slug);
                return (
                  <label
                    key={store.id}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2.5 text-start transition',
                      isChecked
                        ? 'bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]'
                        : 'hover:bg-[color:var(--color-muted)]/60'
                    )}
                  >
                    <Checkbox
                      id={`store-${store.slug}`}
                      checked={isChecked}
                      onCheckedChange={() => handleStoreToggle(store.slug)}
                      className="border-[color:var(--color-border)] bg-[color:var(--color-background)] data-[state=checked]:border-[color:var(--color-primary)] data-[state=checked]:bg-[color:var(--color-primary)]"
                    />
                    <Image
                      src={getSearchStoreLogoPath(store.slug)}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded object-contain shrink-0"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = 'hidden';
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-start text-sm font-bold text-[color:var(--color-foreground)]">{storeName}</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>
        )}

        {/* Brands hidden for now. Keep the data path above so it can be restored quickly later. */}
        {false && availableBrands.length > 0 && (
          <FilterSection
            icon={Tag}
            title={t('search.filters.brands')}
            badge={filters.brands.length}
            defaultOpen={filters.brands.length > 0}
          >
            <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pe-1 [scrollbar-width:thin]">
              {availableBrands.map((brand) => {
                const isChecked = filters.brands.includes(brand);
                return (
                  <label
                    key={brand}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2.5 text-start transition',
                      isChecked
                        ? 'bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]'
                        : 'hover:bg-[color:var(--color-muted)]/60'
                    )}
                  >
                    <Checkbox
                      id={`brand-${brand}`}
                      checked={isChecked}
                      onCheckedChange={() => handleBrandToggle(brand)}
                      className="border-[color:var(--color-border)] bg-[color:var(--color-background)] data-[state=checked]:border-[color:var(--color-primary)] data-[state=checked]:bg-[color:var(--color-primary)]"
                    />
                    <span className="min-w-0 flex-1 truncate text-start text-sm font-bold text-[color:var(--color-foreground)]">{brand}</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>
        )}

        {/* Dynamic Spec Filters (based on category) */}
        {specFilters.map((spec) => {
          const specValues = filters.specs?.[spec.key] || [];
          return (
            <FilterSection
              key={spec.key}
              icon={Cpu}
              title={locale === 'ar' ? spec.label_ar : spec.label_en}
              badge={specValues.length || undefined}
              defaultOpen={specValues.length > 0}
            >
              <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pe-1 [scrollbar-width:thin]">
                {spec.options.map((option) => {
                  const isChecked = specValues.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2.5 text-start transition-colors',
                        isChecked
                          ? 'bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]'
                          : 'hover:bg-[color:var(--color-muted)]/60'
                      )}
                    >
                      <Checkbox
                        id={`spec-${spec.key}-${option.value}`}
                        checked={isChecked}
                        onCheckedChange={() => handleSpecToggle(spec.key, option.value)}
                        className="border-[color:var(--color-border)] bg-[color:var(--color-background)] data-[state=checked]:border-[color:var(--color-primary)] data-[state=checked]:bg-[color:var(--color-primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-start text-sm font-bold text-[color:var(--color-foreground)]">
                        {locale === 'ar' ? option.label_ar : option.label_en}
                      </span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>
          );
        })}

        {/* Discount Range */}
        <FilterSection
          icon={Percent}
          title={locale === 'ar' ? 'نسبة الخصم' : 'Discount'}
          badge={filters.discount ? 1 : undefined}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { value: 10, label: '+10%' },
              { value: 25, label: '+25%' },
              { value: 50, label: '+50%' },
              { value: 70, label: '+70%' },
            ].map((option) => {
              const isActive = filters.discount === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleDiscountToggle(option.value)}
                  className={cn(
                    'rounded-xl border py-2 text-sm font-bold transition',
                    isActive
                      ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]'
                      : 'border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-container)]'
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

      </div>

      {/* Footer — clear all */}
      {activeFilterCount > 0 && (
        <div className="border-t border-[color:var(--color-border)] px-4 py-3">
          <button
            onClick={handleClearFilters}
            className="w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] py-2.5 text-sm font-extrabold text-[color:var(--color-muted-foreground)] transition hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
          >
            {t('search.clearFilters')}
          </button>
        </div>
      )}
    </aside>
  );
}
