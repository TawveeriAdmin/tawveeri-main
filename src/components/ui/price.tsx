import { cn } from '@/lib/utils';
import { bestPrice as bestPriceCopy, type Locale } from '@/lib/copy';

const SAR_SVG_PATH_1 = 'M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z';
const SAR_SVG_PATH_2 = 'M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z';

/**
 * Standalone SAR symbol SVG for use in contexts where the full Price component isn't suitable
 */
export function SARSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1124.14 1256.39"
      className={cn('inline-block w-3.5 h-3.5 fill-primary', className)}
      aria-label="SAR"
    >
      <path d={SAR_SVG_PATH_1} />
      <path d={SAR_SVG_PATH_2} />
    </svg>
  );
}

/**
 * Inline SVG HTML string for use in ECharts HTML tooltips
 */
export function sarSvgHtml(color: string = 'currentColor', size: number = 12): string {
  return `<svg viewBox="0 0 1124.14 1256.39" width="${size}" height="${size}" fill="${color}" style="display:inline-block;vertical-align:middle;margin-inline-start:4px"><path d="${SAR_SVG_PATH_1}"/><path d="${SAR_SVG_PATH_2}"/></svg>`;
}

/**
 * SVG data URI for use in ECharts rich text labels
 */
export function sarSvgDataUri(color: string = '#666'): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1124.14 1256.39" fill="${color}"><path d="${SAR_SVG_PATH_1}"/><path d="${SAR_SVG_PATH_2}"/></svg>`)}`;
}

/**
 * Savings label — renders "وفّر X" / "Save X" followed by the SAR SVG
 * symbol, so the currency is always glyph-rendered rather than plain
 * "ر.س" / "SAR" text. Used inside the savings chip on product cards,
 * comparison table, best-price card, and product detail.
 */
export function SavingsLabel({
  amount,
  locale,
  symbolClassName,
}: {
  amount: number;
  locale: Locale;
  symbolClassName?: string;
}) {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <span>{locale === 'ar' ? 'وفّر' : 'Save'}</span>
      <span>{formatted}</span>
      <SARSymbol className={cn('w-3 h-3', symbolClassName)} />
    </span>
  );
}

interface PriceProps {
  amount: number;
  className?: string;
  symbolClassName?: string;
  showDecimals?: boolean;
}

/**
 * Price component that displays a price with the Saudi Riyal SVG symbol
 * The symbol is always displayed regardless of language
 */
export function Price({
  amount,
  className,
  symbolClassName,
  showDecimals = false,
}: PriceProps) {
  const formattedAmount = showDecimals
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(amount).toLocaleString('en-US');

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span className="tabular-nums">{formattedAmount}</span>
      <svg
        viewBox="0 0 1124.14 1256.39"
        className={cn('inline-block fill-primary ms-1', symbolClassName)}
        aria-label="SAR"
      >
        <path d={SAR_SVG_PATH_1} />
        <path d={SAR_SVG_PATH_2} />
      </svg>
    </span>
  );
}

interface PriceDisplayProps {
  currentPrice: number;
  originalPrice?: number;
  /** When true, renders the gold "🏆 أفضل سعر" chip above the price row. */
  isBest?: boolean;
  /**
   * Savings amount in SAR. When provided (and > 0) renders a gold "وفّر X ر.س" chip
   * under the price row. If omitted but `originalPrice` > `currentPrice`, computed automatically.
   */
  savings?: number;
  locale?: Locale;
  currentClassName?: string;
  originalClassName?: string;
  symbolClassName?: string;
  className?: string;
}

/**
 * PriceDisplay — primary price block used on product cards and product detail.
 * Optionally renders a gold best-price chip and a savings chip to foreground
 * the brand's "trust via numbers" principle.
 */
export function PriceDisplay({
  currentPrice,
  originalPrice,
  isBest = false,
  savings,
  locale = 'ar',
  currentClassName,
  originalClassName,
  symbolClassName,
  className,
}: PriceDisplayProps) {
  const computedSavings =
    typeof savings === 'number'
      ? savings
      : originalPrice && originalPrice > currentPrice
        ? originalPrice - currentPrice
        : 0;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {isBest && (
        <span
          className={cn(
            'inline-flex self-start items-center gap-1 rounded-full px-2.5 py-1',
            'bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)]',
            'border border-[var(--brand-gold)]/40',
            't-caption',
          )}
        >
          {bestPriceCopy(locale)}
        </span>
      )}
      <div className="flex items-baseline gap-3 flex-wrap">
        <Price
          amount={currentPrice}
          className={cn('text-4xl font-extrabold text-on-surface', currentClassName)}
          symbolClassName={cn('w-7 h-7', symbolClassName)}
        />
        {originalPrice && originalPrice > currentPrice && (
          <Price
            amount={originalPrice}
            className={cn('text-base text-on-surface-variant line-through', originalClassName)}
            symbolClassName={cn('w-4 h-4', symbolClassName)}
          />
        )}
      </div>
      {/* Savings chip temporarily hidden — restore when copy is finalized.
      {computedSavings > 0 && (
        <span
          className={cn(
            'inline-flex self-start items-center rounded-full px-2.5 py-1',
            'bg-[var(--brand-gold)]/12 text-[var(--brand-gold-dark)]',
            't-small font-semibold',
          )}
        >
          <SavingsLabel amount={computedSavings} locale={locale} />
        </span>
      )}
      */}
    </div>
  );
}
