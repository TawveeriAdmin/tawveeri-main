'use client';

import { useEffect, useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';
import { Price } from '@/components/ui/price';
import { cn } from '@/lib/utils';
import { isSupportedSearchStore } from '@/lib/scraping/search/store-registry';
import {
  Tag,
  DollarSign,
  Store,
  PackageCheck,
  Flame,
  Truck,
  Star,
  ArrowUpDown,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  TrendingUp,
  ChevronDown,
  RotateCcw,
  Percent,
  ShieldCheck,
  Zap,
  Check,
} from 'lucide-react';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { CATEGORY_SPEC_FILTERS, type SpecFilterDefinition } from '@/lib/scraping/config/spec-configs';
import { Cpu } from 'lucide-react';

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
  topContent?: React.ReactNode;
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
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 py-3 px-1 text-start group"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
          <Icon className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-primary-500 transition-colors" />
        </div>
        <span className="flex-1 text-sm font-medium text-on-surface">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 tabular-nums">
            {badge}
          </span>
        )}
        <ChevronDown className={cn(
          'w-4 h-4 text-on-surface-variant transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>
      <div className={cn(
        'overflow-hidden transition-all duration-200',
        open ? 'max-h-[500px] opacity-100 pb-3' : 'max-h-0 opacity-0'
      )}>
        <div className="px-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// Toggle pill for quick filters (deals, free delivery)
function TogglePill({
  icon: Icon,
  label,
  active,
  onChange,
  color = 'primary',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onChange: (active: boolean) => void;
  color?: 'primary' | 'amber' | 'green';
}) {
  const colorMap = {
    primary: {
      active: 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300',
      inactive: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-on-surface-variant hover:border-gray-300 dark:hover:border-gray-600',
      icon: active ? 'text-primary-500' : 'text-on-surface-variant',
    },
    amber: {
      active: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
      inactive: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-on-surface-variant hover:border-gray-300 dark:hover:border-gray-600',
      icon: active ? 'text-amber-500' : 'text-on-surface-variant',
    },
    green: {
      active: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
      inactive: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-on-surface-variant hover:border-gray-300 dark:hover:border-gray-600',
      icon: active ? 'text-emerald-500' : 'text-on-surface-variant',
    },
  };

  const colors = colorMap[color];

  return (
    <button
      onClick={() => onChange(!active)}
      className={cn(
        'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200',
        active ? colors.active : colors.inactive
      )}
    >
      <Icon className={cn('w-4 h-4 transition-colors', colors.icon)} />
      {label}
    </button>
  );
}

// Star rating selector
function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(value === star ? 0 : star)}
          className="group p-0.5"
        >
          <Star
            className={cn(
              'w-5 h-5 transition-all duration-150',
              star <= value
                ? 'fill-amber-400 text-amber-400 scale-110'
                : 'text-gray-300 dark:text-gray-600 group-hover:text-amber-300 group-hover:scale-105'
            )}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs text-on-surface-variant ms-1 tabular-nums">{value}+</span>
      )}
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
  topContent,
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
  const [availableStores, setAvailableStores] = useState<Array<{ id: string; slug: string; name_ar: string; name_en: string }>>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);

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

  // Fetch available stores
  useEffect(() => {
    async function fetchStores() {
      if (!supabase) return;
      try {
        const { data } = await supabase
          .from('stores')
          .select('id, slug, name_ar, name_en')
          .eq('status', 'active')
          .returns<Array<{ id: string; slug: string; name_ar: string; name_en: string }>>();

        if (data) {
          const supportedStores = data
            .map((store) => ({ ...store, slug: store.slug.trim().toLowerCase() }))
            .filter((store) => isSupportedSearchStore(store.slug));
          setAvailableStores(supportedStores);
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
      }
    }
    fetchStores();
  }, [supabase]);

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

  const handleAvailabilityToggle = (availability: AvailabilityStatus) => {
    const newAvailability = filters.availability.includes(availability)
      ? filters.availability.filter((a) => a !== availability)
      : [...filters.availability, availability];
    onFilterChange({ ...filters, availability: newAvailability });
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

  const handleConditionToggle = (value: string) => {
    const current = filters.condition || [];
    const newCondition = current.includes(value)
      ? current.filter(c => c !== value)
      : [...current, value];
    onFilterChange({ ...filters, condition: newCondition.length > 0 ? newCondition : undefined });
  };

  const handleShippingToggle = (value: string) => {
    const current = filters.shipping || [];
    const newShipping = current.includes(value)
      ? current.filter(s => s !== value)
      : [...current, value];
    onFilterChange({ ...filters, shipping: newShipping.length > 0 ? newShipping : undefined });
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
    {
      value: 'rating' as SearchSortOption,
      label: t('search.sortRating'),
      icon: Star,
    },
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
    <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Top content (results count + sort) */}
      {topContent && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          {topContent}
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/40">
              <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
                <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
                <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
                <line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" />
                <line x1="18" x2="22" y1="16" y2="16" />
              </svg>
            </div>
            <span className="text-sm font-bold text-on-surface">{t('search.filtersTitle')}</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary-500 text-white tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {t('search.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Quick toggles */}
      <div className="px-3 py-3 flex flex-col gap-2 border-b border-gray-100 dark:border-gray-800">
        <TogglePill
          icon={Flame}
          label={t('search.filters.showDealsOnly')}
          active={filters.dealsOnly}
          onChange={(active) => onFilterChange({ ...filters, dealsOnly: active })}
          color="amber"
        />
        <TogglePill
          icon={Truck}
          label={t('search.filters.freeDeliveryOnly')}
          active={filters.freeDeliveryOnly || false}
          onChange={(active) => onFilterChange({ ...filters, freeDeliveryOnly: active })}
          color="green"
        />
      </div>

      {/* Filter sections */}
      <div className="flex-1 overflow-y-auto px-3" style={{ scrollbarWidth: 'none' }}>
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
                      'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg border text-start transition-colors',
                      isActive
                        ? 'border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-transparent text-on-surface hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    )}
                  >
                    <Icon className={cn(
                      'w-4 h-4',
                      isActive ? 'text-primary-500' : 'text-on-surface-variant'
                    )} />
                    <span className="flex-1 text-sm font-medium">{option.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-primary-500" />}
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
                        'py-1.5 rounded-lg border text-xs font-medium transition-colors',
                        isActive
                          ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-gray-700 text-on-surface-variant hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:hover:border-primary-700'
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 rounded-lg bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 text-center">
                <Price amount={filters.minPrice ?? priceRange[0]} className="text-xs font-semibold tabular-nums" />
              </div>
              <span className="text-xs text-on-surface-variant">—</span>
              <div className="flex-1 rounded-lg bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 text-center">
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
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {availableStores.map((store) => {
                const storeName = locale === 'ar' ? store.name_ar : store.name_en;
                const isChecked = filters.stores.includes(store.slug);
                return (
                  <label
                    key={store.id}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                      isChecked
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    )}
                  >
                    <Checkbox
                      id={`store-${store.slug}`}
                      checked={isChecked}
                      onCheckedChange={() => handleStoreToggle(store.slug)}
                    />
                    <span className="text-sm text-on-surface">{storeName}</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>
        )}

        {/* Brands */}
        {availableBrands.length > 0 && (
          <FilterSection
            icon={Tag}
            title={t('search.filters.brands')}
            badge={filters.brands.length}
            defaultOpen
          >
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {availableBrands.map((brand) => {
                const isChecked = filters.brands.includes(brand);
                return (
                  <label
                    key={brand}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                      isChecked
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    )}
                  >
                    <Checkbox
                      id={`brand-${brand}`}
                      checked={isChecked}
                      onCheckedChange={() => handleBrandToggle(brand)}
                    />
                    <span className="text-sm text-on-surface">{brand}</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>
        )}

        {/* Availability */}
        <FilterSection
          icon={PackageCheck}
          title={t('search.filters.availability')}
          badge={filters.availability.length}
        >
          <div className="space-y-1">
            {([
              { value: 'in_stock' as AvailabilityStatus, label: 'product.inStock', dot: 'bg-emerald-500' },
              { value: 'limited_stock' as AvailabilityStatus, label: 'product.limitedStock', dot: 'bg-amber-500' },
              { value: 'out_of_stock' as AvailabilityStatus, label: 'product.outOfStock', dot: 'bg-red-500' },
            ]).map((item) => {
              const isChecked = filters.availability.includes(item.value);
              return (
                <label
                  key={item.value}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                    isChecked
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  )}
                >
                  <Checkbox
                    id={`availability-${item.value}`}
                    checked={isChecked}
                    onCheckedChange={() => handleAvailabilityToggle(item.value)}
                  />
                  <span className={cn('w-2 h-2 rounded-full', item.dot)} />
                  <span className="text-sm text-on-surface">{t(item.label)}</span>
                </label>
              );
            })}
          </div>
        </FilterSection>

        {/* Rating */}
        <FilterSection
          icon={Star}
          title={t('search.filters.rating')}
          badge={filters.minRating && filters.minRating > 0 ? 1 : undefined}
        >
          <div className="py-1">
            <StarRating
              value={filters.minRating || 0}
              onChange={(rating) => onFilterChange({ ...filters, minRating: rating })}
            />
          </div>
        </FilterSection>

        {/* Dynamic Spec Filters (based on category) */}
        {specFilters.map((spec) => {
          const specValues = filters.specs?.[spec.key] || [];
          return (
            <FilterSection
              key={spec.key}
              icon={Cpu}
              title={locale === 'ar' ? spec.label_ar : spec.label_en}
              badge={specValues.length || undefined}
            >
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {spec.options.map((option) => {
                  const isChecked = specValues.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                        isChecked
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      )}
                    >
                      <Checkbox
                        id={`spec-${spec.key}-${option.value}`}
                        checked={isChecked}
                        onCheckedChange={() => handleSpecToggle(spec.key, option.value)}
                      />
                      <span className="text-sm text-on-surface">
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
                    'py-2 rounded-lg border text-sm font-medium transition-all',
                    isActive
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-on-surface-variant hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:hover:border-primary-700'
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Condition */}
        <FilterSection
          icon={ShieldCheck}
          title={locale === 'ar' ? 'الحالة' : 'Condition'}
          badge={filters.condition?.length || undefined}
        >
          <div className="space-y-1">
            {([
              { value: 'new', label: locale === 'ar' ? 'جديد' : 'New', dot: 'bg-emerald-500' },
              { value: 'renewed', label: locale === 'ar' ? 'مجدد' : 'Renewed', dot: 'bg-blue-500' },
              { value: 'used', label: locale === 'ar' ? 'مستعمل' : 'Used', dot: 'bg-gray-400' },
            ]).map((item) => {
              const isChecked = filters.condition?.includes(item.value) || false;
              return (
                <label
                  key={item.value}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                    isChecked
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  )}
                >
                  <Checkbox
                    id={`condition-${item.value}`}
                    checked={isChecked}
                    onCheckedChange={() => handleConditionToggle(item.value)}
                  />
                  <span className={cn('w-2 h-2 rounded-full', item.dot)} />
                  <span className="text-sm text-on-surface">{item.label}</span>
                </label>
              );
            })}
          </div>
        </FilterSection>

        {/* Shipping Speed */}
        <FilterSection
          icon={Zap}
          title={locale === 'ar' ? 'سرعة الشحن' : 'Shipping Speed'}
          badge={filters.shipping?.length || undefined}
        >
          <div className="space-y-1">
            {([
              { value: 'same_day', label: locale === 'ar' ? 'توصيل في نفس اليوم' : 'Same Day Delivery' },
              { value: 'express', label: locale === 'ar' ? 'توصيل سريع (1-2 يوم)' : 'Express (1-2 days)' },
              { value: 'standard', label: locale === 'ar' ? 'توصيل عادي (3-7 أيام)' : 'Standard (3-7 days)' },
            ]).map((item) => {
              const isChecked = filters.shipping?.includes(item.value) || false;
              return (
                <label
                  key={item.value}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                    isChecked
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  )}
                >
                  <Checkbox
                    id={`shipping-${item.value}`}
                    checked={isChecked}
                    onCheckedChange={() => handleShippingToggle(item.value)}
                  />
                  <span className="text-sm text-on-surface">{item.label}</span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      </div>

      {/* Footer — clear all */}
      {activeFilterCount > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleClearFilters}
            className="w-full py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-on-surface-variant hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('search.clearFilters')}
          </button>
        </div>
      )}
    </div>
  );
}
