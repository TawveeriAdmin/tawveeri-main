'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '@/lib/simple-intl-provider';
import type { SearchFilters } from '@/components/search/filter-sidebar';
import { SARSymbol } from '@/components/ui/price';

interface ActiveFilterChipsProps {
  filters: SearchFilters;
  onRemove: (next: SearchFilters) => void;
  onClearAll: () => void;
  /** Optional human-readable resolver for store / brand slugs. */
  storeNameResolver?: (slug: string) => string;
}

interface Chip {
  key: string;
  /** Accessible plain-text label (used for aria-label and fallback). */
  label: string;
  /** Optional rich label — when set, rendered instead of the plain text so chips can include inline SVG (e.g. the SAR glyph). */
  labelNode?: ReactNode;
  remove: () => SearchFilters;
}

export function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
  storeNameResolver,
}: ActiveFilterChipsProps) {
  const { isRTL } = useLocale();
  const chips = collectChips(filters, isRTL, storeNameResolver);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onRemove(c.remove())}
          className="group inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-green)]/40 bg-[var(--brand-bg-green)] px-3 py-1 t-small font-medium text-[var(--brand-green-dark)] transition-colors hover:bg-[var(--brand-green)]/15"
          aria-label={isRTL ? `إزالة ${c.label}` : `Remove ${c.label}`}
        >
          <span className="truncate max-w-[180px]">{c.labelNode ?? c.label}</span>
          <X className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="t-small font-semibold text-[var(--brand-gold-dark)] hover:text-[var(--brand-green-dark)] transition-colors px-2 py-1"
      >
        {isRTL ? 'امسح الكل' : 'Clear all'}
      </button>
    </div>
  );
}

function collectChips(
  filters: SearchFilters,
  isRTL: boolean,
  storeNameResolver?: (slug: string) => string,
): Chip[] {
  const chips: Chip[] = [];
  const labelFor = (slug: string) => storeNameResolver?.(slug) ?? slug;

  for (const brand of filters.brands) {
    chips.push({
      key: `brand:${brand}`,
      label: `${isRTL ? 'العلامة' : 'Brand'}: ${brand}`,
      remove: () => ({ ...filters, brands: filters.brands.filter((b) => b !== brand) }),
    });
  }
  for (const store of filters.stores) {
    chips.push({
      key: `store:${store}`,
      label: `${isRTL ? 'المتجر' : 'Store'}: ${labelFor(store)}`,
      remove: () => ({ ...filters, stores: filters.stores.filter((s) => s !== store) }),
    });
  }
  for (const av of filters.availability) {
    chips.push({
      key: `availability:${av}`,
      label: availabilityLabel(av, isRTL),
      remove: () => ({ ...filters, availability: filters.availability.filter((a) => a !== av) }),
    });
  }
  if (filters.minPrice !== undefined) {
    const plainLabel = `${isRTL ? 'الحد الأدنى' : 'Min'}: ${filters.minPrice} ${isRTL ? 'ر.س' : 'SAR'}`;
    chips.push({
      key: 'priceMin',
      label: plainLabel,
      labelNode: (
        <span className="inline-flex items-center gap-1">
          <span>{isRTL ? 'الحد الأدنى' : 'Min'}:</span>
          <span className="tabular-nums">{filters.minPrice}</span>
          <SARSymbol className="w-3 h-3" />
        </span>
      ),
      remove: () => {
        const { ...rest } = filters;
        delete rest.minPrice;
        return rest;
      },
    });
  }
  if (filters.maxPrice !== undefined) {
    const plainLabel = `${isRTL ? 'الحد الأقصى' : 'Max'}: ${filters.maxPrice} ${isRTL ? 'ر.س' : 'SAR'}`;
    chips.push({
      key: 'priceMax',
      label: plainLabel,
      labelNode: (
        <span className="inline-flex items-center gap-1">
          <span>{isRTL ? 'الحد الأقصى' : 'Max'}:</span>
          <span className="tabular-nums">{filters.maxPrice}</span>
          <SARSymbol className="w-3 h-3" />
        </span>
      ),
      remove: () => {
        const { ...rest } = filters;
        delete rest.maxPrice;
        return rest;
      },
    });
  }
  if (filters.dealsOnly) {
    chips.push({
      key: 'dealsOnly',
      label: isRTL ? 'العروض فقط' : 'Deals only',
      remove: () => ({ ...filters, dealsOnly: false }),
    });
  }
  if (filters.freeDeliveryOnly) {
    chips.push({
      key: 'freeDelivery',
      label: isRTL ? 'توصيل مجاني' : 'Free delivery',
      remove: () => ({ ...filters, freeDeliveryOnly: false }),
    });
  }
  if (filters.minRating && filters.minRating > 0) {
    chips.push({
      key: 'minRating',
      label: `${isRTL ? 'التقييم' : 'Rating'}: ${filters.minRating}+`,
      remove: () => {
        const { ...rest } = filters;
        delete rest.minRating;
        return rest;
      },
    });
  }
  if (filters.discount !== undefined) {
    chips.push({
      key: 'discount',
      label: `${isRTL ? 'الخصم' : 'Discount'}: ${filters.discount}%+`,
      remove: () => {
        const { ...rest } = filters;
        delete rest.discount;
        return rest;
      },
    });
  }
  if (filters.condition?.length) {
    for (const c of filters.condition) {
      chips.push({
        key: `condition:${c}`,
        label: `${isRTL ? 'الحالة' : 'Condition'}: ${c}`,
        remove: () => ({ ...filters, condition: filters.condition!.filter((x) => x !== c) }),
      });
    }
  }
  if (filters.shipping?.length) {
    for (const s of filters.shipping) {
      chips.push({
        key: `shipping:${s}`,
        label: `${isRTL ? 'الشحن' : 'Shipping'}: ${s}`,
        remove: () => ({ ...filters, shipping: filters.shipping!.filter((x) => x !== s) }),
      });
    }
  }
  if (filters.specs) {
    for (const [specKey, values] of Object.entries(filters.specs)) {
      for (const v of values) {
        chips.push({
          key: `spec:${specKey}:${v}`,
          label: `${specKey}: ${v}`,
          remove: () => {
            const nextSpecs = { ...filters.specs };
            nextSpecs[specKey] = nextSpecs[specKey].filter((x) => x !== v);
            if (nextSpecs[specKey].length === 0) delete nextSpecs[specKey];
            return { ...filters, specs: nextSpecs };
          },
        });
      }
    }
  }
  return chips;
}

function availabilityLabel(av: string, isRTL: boolean): string {
  switch (av) {
    case 'in_stock':
      return isRTL ? 'متوفر' : 'In stock';
    case 'out_of_stock':
      return isRTL ? 'غير متوفر' : 'Out of stock';
    case 'limited_stock':
      return isRTL ? 'كمية محدودة' : 'Limited stock';
    case 'pre_order':
      return isRTL ? 'طلب مسبق' : 'Pre-order';
    default:
      return av;
  }
}
