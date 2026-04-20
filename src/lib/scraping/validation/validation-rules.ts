import type { ValidationResult, ScrapedProduct } from '../base/types';
import { validatePrice } from '../utils/price-parser';
import { isValidUrl } from '../utils/url-utils';

/**
 * Validate price
 */
export function validatePriceRule(price: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (price <= 0) {
    errors.push('Price must be greater than 0');
  }

  if (price > 1000000) {
    errors.push('Price exceeds maximum allowed value (1,000,000 SAR)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? 100 : 0,
  };
}

/**
 * Validate product name
 */
export function validateNameRule(name: string, language: 'ar' | 'en'): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push(`${language === 'ar' ? 'Arabic' : 'English'} name is required`);
  } else if (name.trim().length < 3) {
    errors.push(`${language === 'ar' ? 'Arabic' : 'English'} name must be at least 3 characters`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? 100 : 0,
  };
}

/**
 * Validate brand
 */
export function validateBrandRule(brand: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!brand || brand.trim().length === 0) {
    errors.push('Brand is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? 100 : 0,
  };
}

/**
 * Validate model
 */
export function validateModelRule(model: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!model || model.trim().length === 0) {
    errors.push('Model is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? 100 : 0,
  };
}

/**
 * Validate URL
 */
export function validateUrlRule(url: string, expectedDomain?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isValidUrl(url)) {
    errors.push(`Invalid URL format: ${url}`);
  }

  if (expectedDomain) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== expectedDomain && !parsedUrl.hostname.endsWith(`.${expectedDomain}`)) {
        warnings.push(`URL domain does not match expected domain: ${expectedDomain}`);
      }
    } catch {
      // URL parsing failed, already caught above
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? (warnings.length === 0 ? 100 : 80) : 0,
  };
}

/**
 * Validate images
 */
export function validateImagesRule(images: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (images.length === 0) {
    warnings.push('No product images found');
  }

  images.forEach((img, index) => {
    if (!isValidUrl(img)) {
      warnings.push(`Invalid image URL at index ${index}: ${img}`);
    }
  });

  return {
    isValid: true, // Images are optional, so no errors
    errors,
    warnings,
    score: images.length > 0 ? 100 : 50,
  };
}

/**
 * Validate specifications
 */
export function validateSpecificationsRule(specs: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!specs || typeof specs !== 'object') {
    errors.push('Specifications must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? 100 : 0,
  };
}

/**
 * Validate category
 */
export function validateCategoryRule(category: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validCategories = [
    'tv',
    'laptop',
    'smartphone',
    'tablet',
    'audio',
    'camera',
    'gaming',
    'accessories',
    'monitor',
    'printer',
    'networking',
    'smart_home',
    'wearable',
    'appliance',
    'kitchen',
    'personal_care',
  ];

  if (!validCategories.includes(category)) {
    errors.push(`Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? 100 : 0,
  };
}

/**
 * Validate availability
 */
export function validateAvailabilityRule(availability: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validStatuses = ['in_stock', 'out_of_stock', 'limited_stock', 'pre_order'];

  if (!validStatuses.includes(availability)) {
    errors.push(`Invalid availability status: ${availability}. Must be one of: ${validStatuses.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? 100 : 0,
  };
}

/**
 * Validate SKU
 */
export function validateSkuRule(sku: string | null): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (sku !== null && (!sku || sku.trim().length === 0)) {
    warnings.push('SKU is provided but empty');
  }

  return {
    isValid: true, // SKU is optional
    errors,
    warnings,
    score: sku && sku.trim().length > 0 ? 100 : 80,
  };
}

/**
 * Validate price consistency (original vs current)
 */
export function validatePriceConsistencyRule(
  current: number,
  original: number | null
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (original !== null) {
    if (original < current) {
      warnings.push('Original price is less than current price (unusual discount)');
    }
    if (original === current) {
      warnings.push('Original price equals current price (no discount shown)');
    }
    const discountPercent = ((original - current) / original) * 100;
    if (discountPercent > 90) {
      warnings.push(`Discount is over 90% (${discountPercent.toFixed(1)}%) - may be an error`);
    }
  }

  return {
    isValid: true, // No errors, only warnings
    errors,
    warnings,
    score: warnings.length === 0 ? 100 : 70,
  };
}

/**
 * Validate historical price change
 */
export function validateHistoricalPriceRule(
  newPrice: number,
  historicalPrices: number[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (historicalPrices.length === 0) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      score: 100,
    };
  }

  const avgPrice = historicalPrices.reduce((sum, p) => sum + p, 0) / historicalPrices.length;
  const priceChange = Math.abs(newPrice - avgPrice);
  const changePercent = (priceChange / avgPrice) * 100;

  if (changePercent > 50) {
    warnings.push(`Price change is over 50% (${changePercent.toFixed(1)}%) from historical average`);
  }

  return {
    isValid: true,
    errors,
    warnings,
    score: changePercent < 50 ? 100 : 60,
  };
}






