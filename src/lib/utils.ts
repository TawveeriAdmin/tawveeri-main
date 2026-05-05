import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price number for display (without currency symbol)
 * Use the <Price> component from @/components/ui/price for display with the SAR symbol
 * @param price - The price value
 * @returns Formatted price string (number only)
 */
export function formatPrice(price: number, locale: 'ar' | 'en' = 'ar'): string {
  return Math.round(price).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US');
}

/**
 * @deprecated Use <Price> component from @/components/ui/price instead
 * This function is kept for backwards compatibility only
 */
export function formatPriceWithCurrency(price: number, locale: 'ar' | 'en' = 'ar'): string {
  const formatted = price.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
  return locale === 'ar' ? `${formatted} ر.س` : `SAR ${formatted}`;
}

/**
 * Calculate savings amount
 * @param original - Original price
 * @param current - Current price
 * @returns Savings amount
 */
export function calculateSavings(original: number, current: number): number {
  return Math.max(0, original - current);
}

/**
 * Calculate savings percentage
 * @param original - Original price
 * @param current - Current price
 * @returns Savings percentage
 */
export function calculateSavingsPercentage(
  original: number,
  current: number
): number {
  if (original <= 0) return 0;
  return Math.round(((original - current) / original) * 100);
}

/**
 * Format large numbers with K, M suffixes
 * @param num - The number to format
 * @returns Formatted string
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
