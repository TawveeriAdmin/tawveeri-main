'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Truck, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { StoreLogo } from '@/components/ui/store-logo';
import { useLocale } from '@/lib/simple-intl-provider';
import { savings as savingsCopy, bestPrice as bestPriceCopy } from '@/lib/copy';
import type { AvailabilityStatus } from '@/lib/database/types';

interface StoreSummary {
  id: string;
  slug?: string | null;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  average_rating?: number | null;
  total_reviews?: number | null;
}

interface ProductStore {
  id: string;
  current_price: number;
  original_price: number | null;
  currency?: string | null;
  availability: AvailabilityStatus;
  stock_quantity?: number | null;
  product_url?: string | null;
  affiliate_url?: string | null;
  delivery_time_days?: number | null;
  delivery_cost?: number | null;
  is_free_delivery?: boolean | null;
  stores: StoreSummary;
}

interface ComparisonTableProps {
  productStores: ProductStore[];
  /** Called with the chosen store ID + url before navigation (for affiliate tracking). */
  onStoreClick?: (productStoreId: string, url: string) => void;
}

type SortKey = 'price' | 'delivery';
type SortDir = 'asc' | 'desc';

/**
 * Full store comparison table — replaces the cramped slide-in panel on the
 * product detail page. Sortable by price (default) or delivery time. Best-price
 * row gets a green-tinted background + gold "أفضل" pill.
 */
export function ComparisonTable({ productStores, onStoreClick }: ComparisonTableProps) {
  const { isRTL, locale } = useLocale();
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows = useMemo(() => {
    const filtered = productStores.filter((ps) => ps.current_price > 0);
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'delivery') {
        const av = a.delivery_time_days ?? Number.MAX_SAFE_INTEGER;
        const bv = b.delivery_time_days ?? Number.MAX_SAFE_INTEGER;
        return (av - bv) * dir;
      }
      return (a.current_price - b.current_price) * dir;
    });
    return sorted;
  }, [productStores, sortKey, sortDir]);

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-8 text-center">
        <p className="t-body text-on-surface-variant">
          {isRTL ? 'لا توجد أسعار متاحة حاليًا' : 'No prices available right now'}
        </p>
      </div>
    );
  }

  const bestPriceValue = Math.min(...rows.map((r) => r.current_price));
  const showDeliveryColumn = rows.some(
    (r) => r.delivery_time_days != null || r.delivery_cost != null || r.is_free_delivery,
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleStoreLink = (e: React.MouseEvent, ps: ProductStore) => {
    const url = ps.affiliate_url || ps.product_url;
    if (!url) return;
    // When the parent wires up tracking, it's responsible for opening the
    // tagged URL. Cancel the default anchor navigation so we don't race-open
    // the raw URL in a second tab (stripping affiliate params + click_id).
    if (onStoreClick) {
      e.preventDefault();
      onStoreClick(ps.id, url);
    }
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] shadow-[var(--elevation-1)]">
      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[color:var(--color-surface-container-low)]">
            <tr className="text-start">
              <Th>{isRTL ? 'المتجر' : 'Store'}</Th>
              <Th>
                <button
                  type="button"
                  onClick={() => toggleSort('price')}
                  className="inline-flex items-center gap-1 hover:text-[var(--brand-green-dark)]"
                >
                  {isRTL ? 'السعر' : 'Price'}
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </Th>
              <Th>{isRTL ? 'التوفير' : 'Savings'}</Th>
              {showDeliveryColumn && (
                <Th>
                  <button
                    type="button"
                    onClick={() => toggleSort('delivery')}
                    className="inline-flex items-center gap-1 hover:text-[var(--brand-green-dark)]"
                  >
                    {isRTL ? 'التوصيل' : 'Delivery'}
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </button>
                </Th>
              )}
              <Th>{isRTL ? 'التوفر' : 'Stock'}</Th>
              <Th className="text-end">{isRTL ? 'الإجراء' : 'Action'}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ps) => {
              const isWinner = ps.current_price === bestPriceValue;
              const savings =
                ps.original_price && ps.original_price > ps.current_price
                  ? ps.original_price - ps.current_price
                  : 0;
              const url = ps.affiliate_url || ps.product_url;
              const storeName = isRTL ? ps.stores.name_ar : ps.stores.name_en;
              return (
                <tr
                  key={ps.id}
                  className={cn(
                    'border-t border-[color:var(--color-outline-variant)]/50 transition-colors',
                    isWinner
                      ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/40',
                  )}
                >
                  <Td>
                    <div className="flex items-center gap-3">
                      <StoreLogo slug={ps.stores.slug || ps.stores.id} size="md" alt={storeName} locale={locale as 'ar' | 'en'} />
                      <div className="flex flex-col">
                        <span className="t-body-strong text-on-surface line-clamp-1">
                          {storeName}
                        </span>
                        {isWinner && (
                          <Badge variant="best" className="mt-1 self-start t-caption">
                            {bestPriceCopy(locale as 'ar' | 'en')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <Price
                        amount={ps.current_price}
                        className={cn(
                          't-body-strong',
                          isWinner ? 'text-[var(--brand-green-dark)] font-extrabold text-lg' : 'text-on-surface',
                        )}
                        symbolClassName="w-4 h-4"
                      />
                      {ps.original_price && ps.original_price > ps.current_price && (
                        <Price
                          amount={ps.original_price}
                          className="t-small text-on-surface-variant line-through"
                          symbolClassName="w-3 h-3"
                        />
                      )}
                    </div>
                  </Td>
                  <Td>
                    {savings > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--brand-gold)]/12 text-[var(--brand-gold-dark)] px-2 py-0.5 t-small font-semibold">
                        {savingsCopy(savings, locale as 'ar' | 'en')}
                      </span>
                    ) : (
                      <span className="t-small text-on-surface-variant">—</span>
                    )}
                  </Td>
                  {showDeliveryColumn && (
                    <Td>
                      <DeliveryCell ps={ps} isRTL={isRTL} />
                    </Td>
                  )}
                  <Td>
                    <AvailabilityCell availability={ps.availability} stock={ps.stock_quantity} isRTL={isRTL} />
                  </Td>
                  <Td className="text-end">
                    {url ? (
                      <Button
                        size="sm"
                        variant={isWinner ? 'default' : 'outline'}
                        asChild
                      >
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => handleStoreLink(e, ps)}
                        >
                          {isRTL ? 'اشترِ' : 'Buy'}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        {isRTL ? 'غير متاح' : 'Unavailable'}
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden divide-y divide-[color:var(--color-outline-variant)]/50">
        {rows.map((ps) => {
          const isWinner = ps.current_price === bestPriceValue;
          const savings =
            ps.original_price && ps.original_price > ps.current_price
              ? ps.original_price - ps.current_price
              : 0;
          const url = ps.affiliate_url || ps.product_url;
          const storeName = isRTL ? ps.stores.name_ar : ps.stores.name_en;
          return (
            <div
              key={ps.id}
              className={cn(
                'p-4',
                isWinner && 'bg-emerald-50 dark:bg-emerald-900/20',
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <StoreLogo slug={ps.stores.slug || ps.stores.id} size="md" alt={storeName} locale={locale as 'ar' | 'en'} />
                  <div className="flex flex-col">
                    <span className="t-body-strong text-on-surface">{storeName}</span>
                    {isWinner && (
                      <Badge variant="best" className="mt-1 self-start t-caption">
                        {bestPriceCopy(locale as 'ar' | 'en')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <Price
                    amount={ps.current_price}
                    className={cn(
                      't-body-strong',
                      isWinner ? 'text-[var(--brand-green-dark)] font-extrabold text-lg' : 'text-on-surface',
                    )}
                    symbolClassName="w-4 h-4"
                  />
                  {ps.original_price && ps.original_price > ps.current_price && (
                    <Price
                      amount={ps.original_price}
                      className="t-small text-on-surface-variant line-through"
                      symbolClassName="w-3 h-3"
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                {savings > 0 && (
                  <span className="inline-flex items-center rounded-full bg-[var(--brand-gold)]/12 text-[var(--brand-gold-dark)] px-2 py-0.5 t-small font-semibold">
                    {savingsCopy(savings, locale as 'ar' | 'en')}
                  </span>
                )}
                <AvailabilityCell availability={ps.availability} stock={ps.stock_quantity} isRTL={isRTL} />
                {showDeliveryColumn && (
                  <DeliveryCell ps={ps} isRTL={isRTL} compact />
                )}
              </div>

              {url ? (
                <Button
                  size="sm"
                  variant={isWinner ? 'default' : 'outline'}
                  className="w-full"
                  asChild
                >
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleStoreLink(e, ps)}
                  >
                    {isRTL ? `اشترِ من ${storeName}` : `Buy from ${storeName}`}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="w-full" disabled>
                  {isRTL ? 'غير متاح' : 'Unavailable'}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 t-caption text-on-surface-variant font-semibold text-start',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-4 align-middle', className)}>{children}</td>;
}

function DeliveryCell({
  ps,
  isRTL,
  compact = false,
}: {
  ps: ProductStore;
  isRTL: boolean;
  compact?: boolean;
}) {
  if (ps.is_free_delivery) {
    return (
      <span className="inline-flex items-center gap-1 t-small font-semibold text-[var(--brand-green-dark)]">
        <Truck className="h-3.5 w-3.5" />
        {isRTL ? 'مجاني' : 'Free'}
      </span>
    );
  }
  if (ps.delivery_time_days != null) {
    return (
      <span className="inline-flex items-center gap-1 t-small text-on-surface-variant">
        {!compact && <Truck className="h-3.5 w-3.5" />}
        {isRTL ? `${ps.delivery_time_days} يوم` : `${ps.delivery_time_days}d`}
        {ps.delivery_cost != null && ps.delivery_cost > 0 && ` · ${ps.delivery_cost} ${isRTL ? 'ر.س' : 'SAR'}`}
      </span>
    );
  }
  if (ps.delivery_cost != null && ps.delivery_cost > 0) {
    return (
      <span className="t-small text-on-surface-variant">
        {ps.delivery_cost} {isRTL ? 'ر.س' : 'SAR'}
      </span>
    );
  }
  return <span className="t-small text-on-surface-variant">—</span>;
}

function AvailabilityCell({
  availability,
  stock,
  isRTL,
}: {
  availability: AvailabilityStatus;
  stock?: number | null;
  isRTL: boolean;
}) {
  if (availability === 'out_of_stock') {
    return (
      <Badge variant="outline" className="text-xs text-on-surface-variant">
        {isRTL ? 'غير متوفر' : 'Out of stock'}
      </Badge>
    );
  }
  if (availability === 'limited_stock' || (typeof stock === 'number' && stock > 0 && stock <= 5)) {
    return (
      <span className="inline-flex items-center gap-1 t-small font-semibold text-[var(--brand-gold-dark)]">
        {isRTL ? 'كمية محدودة' : 'Limited'}
        {typeof stock === 'number' && stock > 0 && ` (${stock})`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 t-small text-[var(--brand-green-dark)] font-semibold">
      {isRTL ? 'متوفر' : 'In stock'}
    </span>
  );
}
