/**
 * Utility Functions Tests
 * Tests for common utility functions
 */

import { formatPrice, calculateSavings, calculateSavingsPercentage, formatCompactNumber } from '@/lib/utils';

describe('Price Formatting', () => {
  it('should format price in Arabic', () => {
    expect(formatPrice(3299, 'ar')).toBe('3,299 ر.س');
  });

  it('should format price in English', () => {
    expect(formatPrice(3299, 'en')).toBe('SAR 3,299');
  });

  it('should handle large prices', () => {
    expect(formatPrice(123456, 'ar')).toBe('123,456 ر.س');
  });

  it('should handle decimal prices', () => {
    expect(formatPrice(99.99, 'ar')).toBe('99.99 ر.س');
  });
});

describe('Savings Calculations', () => {
  it('should calculate savings correctly', () => {
    expect(calculateSavings(3799, 3299)).toBe(500);
  });

  it('should return 0 for negative savings', () => {
    expect(calculateSavings(3000, 3500)).toBe(0);
  });

  it('should calculate savings percentage', () => {
    expect(calculateSavingsPercentage(3799, 3299)).toBe(13);
  });

  it('should return 0 for zero original price', () => {
    expect(calculateSavingsPercentage(0, 100)).toBe(0);
  });

  it('should round percentage correctly', () => {
    expect(calculateSavingsPercentage(1000, 666)).toBe(33);
  });
});

describe('Number Formatting', () => {
  it('should format thousands with K', () => {
    expect(formatCompactNumber(1500)).toBe('1.5K');
  });

  it('should format millions with M', () => {
    expect(formatCompactNumber(2500000)).toBe('2.5M');
  });

  it('should return number as string for small values', () => {
    expect(formatCompactNumber(500)).toBe('500');
  });

  it('should handle exact thousands', () => {
    expect(formatCompactNumber(1000)).toBe('1.0K');
  });

  it('should handle exact millions', () => {
    expect(formatCompactNumber(1000000)).toBe('1.0M');
  });
});
