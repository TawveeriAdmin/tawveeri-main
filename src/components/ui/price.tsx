import Image from 'next/image';
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
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="tabular-nums">{formattedAmount}</span>
      <Image
        src="/Saudi_Riyal_Symbol.svg"
        alt="SAR"
        width={16}
        height={16}
        className={cn('inline-block', symbolClassName)}
      />
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
        symbolClassName={cn('w-6 h-6', symbolClassName)}
      />
      {originalPrice && (
        <Price
          amount={originalPrice}
          className={cn('text-lg text-gray-400 line-through', originalClassName)}
          symbolClassName={cn('w-3 h-3', symbolClassName)}
        />
      )}
    </div>
  );
}
