import type { ScrapedProduct, ValidationResult } from '../base/types';
import {
  validatePriceRule,
  validateNameRule,
  validateBrandRule,
  validateModelRule,
  validateUrlRule,
  validateImagesRule,
  validateSpecificationsRule,
  validateCategoryRule,
  validateAvailabilityRule,
  validateSkuRule,
  validatePriceConsistencyRule,
} from './validation-rules';

/**
 * Data validator for scraped products
 */
export class DataValidator {
  /**
   * Validate all product fields
   */
  validateProduct(product: ScrapedProduct, expectedDomain?: string): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let totalScore = 0;
    let ruleCount = 0;

    // Validate price
    const priceResult = validatePriceRule(product.current_price);
    allErrors.push(...priceResult.errors);
    allWarnings.push(...priceResult.warnings);
    totalScore += priceResult.score;
    ruleCount++;

    // Validate names
    const nameEnResult = validateNameRule(product.name_en, 'en');
    allErrors.push(...nameEnResult.errors);
    allWarnings.push(...nameEnResult.warnings);
    totalScore += nameEnResult.score;
    ruleCount++;

    if (product.name_ar) {
      const nameArResult = validateNameRule(product.name_ar, 'ar');
      allErrors.push(...nameArResult.errors);
      allWarnings.push(...nameArResult.warnings);
      totalScore += nameArResult.score;
      ruleCount++;
    }

    // Validate brand
    const brandResult = validateBrandRule(product.brand);
    allErrors.push(...brandResult.errors);
    allWarnings.push(...brandResult.warnings);
    totalScore += brandResult.score;
    ruleCount++;

    // Validate model
    const modelResult = validateModelRule(product.model);
    allErrors.push(...modelResult.errors);
    allWarnings.push(...modelResult.warnings);
    totalScore += modelResult.score;
    ruleCount++;

    // Validate URL
    const urlResult = validateUrlRule(product.product_url, expectedDomain);
    allErrors.push(...urlResult.errors);
    allWarnings.push(...urlResult.warnings);
    totalScore += urlResult.score;
    ruleCount++;

    // Validate images
    const imagesResult = validateImagesRule(product.image_urls);
    allWarnings.push(...imagesResult.warnings);
    totalScore += imagesResult.score;
    ruleCount++;

    // Validate specifications
    const specsResult = validateSpecificationsRule(product.specifications);
    allErrors.push(...specsResult.errors);
    allWarnings.push(...specsResult.warnings);
    totalScore += specsResult.score;
    ruleCount++;

    // Validate category
    const categoryResult = validateCategoryRule(product.category);
    allErrors.push(...categoryResult.errors);
    allWarnings.push(...categoryResult.warnings);
    totalScore += categoryResult.score;
    ruleCount++;

    // Validate availability
    const availabilityResult = validateAvailabilityRule(product.availability);
    allErrors.push(...availabilityResult.errors);
    allWarnings.push(...availabilityResult.warnings);
    totalScore += availabilityResult.score;
    ruleCount++;

    // Validate SKU
    const skuResult = validateSkuRule(product.sku);
    allWarnings.push(...skuResult.warnings);
    totalScore += skuResult.score;
    ruleCount++;

    // Validate price consistency
    const priceConsistencyResult = validatePriceConsistencyRule(
      product.current_price,
      product.original_price
    );
    allWarnings.push(...priceConsistencyResult.warnings);
    totalScore += priceConsistencyResult.score;
    ruleCount++;

    const avgScore = ruleCount > 0 ? Math.round(totalScore / ruleCount) : 0;

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      score: avgScore,
    };
  }

  /**
   * Validate price change
   */
  validatePriceChange(oldPrice: number, newPrice: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const change = Math.abs(newPrice - oldPrice);
    const changePercent = (change / oldPrice) * 100;

    if (changePercent > 100) {
      warnings.push(`Price change is over 100% (${changePercent.toFixed(1)}%)`);
    } else if (changePercent > 50) {
      warnings.push(`Price change is over 50% (${changePercent.toFixed(1)}%)`);
    }

    return {
      isValid: true,
      errors,
      warnings,
      score: changePercent < 50 ? 100 : changePercent < 100 ? 70 : 40,
    };
  }

  /**
   * Determine if product should be flagged for manual review
   */
  shouldFlagForReview(product: ScrapedProduct, validationResult: ValidationResult): boolean {
    // Flag if validation errors
    if (!validationResult.isValid) return true;

    // Flag if quality score is low
    if (validationResult.score < 70) return true;

    // Flag if too many warnings
    if (validationResult.warnings.length > 3) return true;

    // Flag if price is suspicious
    if (product.current_price <= 0 || product.current_price > 1000000) return true;

    // Flag if price consistency issues
    if (
      product.original_price !== null &&
      product.original_price < product.current_price
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get validation score (0-100)
   */
  getValidationScore(result: ValidationResult): number {
    return result.score;
  }
}

