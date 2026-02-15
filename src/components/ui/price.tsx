import { cn } from '@/lib/utils';

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
    : amount.toLocaleString('en-US');

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span className="tabular-nums">{formattedAmount}</span>
      <svg
        viewBox="0 0 1124.14 1256.39"
        className={cn('inline-block fill-primary-600 dark:fill-primary-400 ms-1', symbolClassName)}
        aria-label="SAR"
      >
        <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/>
        <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/>
      </svg>
    </span>
  );
}

interface PriceDisplayProps {
  currentPrice: number;
  originalPrice?: number;
  currentClassName?: string;
  originalClassName?: string;
  symbolClassName?: string;
}

/**
 * PriceDisplay component for showing current price with optional original price
 * Shows both prices with the Saudi Riyal SVG symbol
 */
export function PriceDisplay({
  currentPrice,
  originalPrice,
  currentClassName,
  originalClassName,
  symbolClassName,
}: PriceDisplayProps) {
  return (
    <div className="flex items-baseline gap-3">
      <Price
        amount={currentPrice}
        className={cn('text-5xl font-extrabold', currentClassName)}
        symbolClassName={cn('w-10 h-10', symbolClassName)}
      />
      {originalPrice && (
        <Price
          amount={originalPrice}
          className={cn('text-lg text-gray-400 dark:text-gray-500 line-through', originalClassName)}
          symbolClassName={cn('w-5 h-5', symbolClassName)}
        />
      )}
    </div>
  );
}
