import { createServerClient } from '@/lib/database';
import type { ScrapedProduct } from '../base/types';
import { calculateSimilarity, normalizeProductName, matchProducts } from './fuzzy-matcher';

/**
 * Product matcher to find existing products in database
 */
export class ProductMatcher {
  private supabase = createServerClient();

  /**
   * Find existing product by various matching strategies
   */
  async findExistingProduct(scrapedProduct: ScrapedProduct): Promise<string | null> {
    // Strategy 1: Exact SKU match (highest confidence)
    if (scrapedProduct.sku) {
      const skuMatch = await this.matchBySku(scrapedProduct.sku);
      if (skuMatch) return skuMatch;
    }

    // Strategy 2: Brand + Model match
    const brandModelMatch = await this.matchByBrandModel(
      scrapedProduct.brand,
      scrapedProduct.model
    );
    if (brandModelMatch) return brandModelMatch;

    // Strategy 3: Fuzzy matching (lower confidence)
    const fuzzyMatch = await this.fuzzyMatch(scrapedProduct);
    if (fuzzyMatch && fuzzyMatch.confidence > 0.85) {
      return fuzzyMatch.productId;
    }

    return null;
  }

  /**
   * Match product by exact SKU
   */
  async matchBySku(sku: string): Promise<string | null> {
    if (!sku || sku.trim().length === 0) return null;

    const { data, error } = await this.supabase
      .from('products')
      .select('id')
      .eq('sku', sku.trim())
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    return data.id;
  }

  /**
   * Match product by normalized brand + model
   */
  async matchByBrandModel(brand: string, model: string): Promise<string | null> {
    if (!brand || !model) return null;

    const normalizedBrand = this.normalizeForMatching(brand);
    const normalizedModel = this.normalizeForMatching(model);

    // Try exact match first
    const { data, error } = await this.supabase
      .from('products')
      .select('id, brand, model')
      .ilike('brand', normalizedBrand)
      .ilike('model', normalizedModel)
      .eq('is_active', true)
      .limit(10);

    if (error || !data || data.length === 0) return null;

    // If exact match found, return first result
    const exactMatch = data.find(
      p => 
        this.normalizeForMatching(p.brand) === normalizedBrand &&
        this.normalizeForMatching(p.model) === normalizedModel
    );

    if (exactMatch) return exactMatch.id;

    // If multiple results, return first (may need manual review)
    return data[0].id;
  }

  /**
   * Fuzzy match product by name similarity
   */
  async fuzzyMatch(
    scrapedProduct: ScrapedProduct
  ): Promise<{ productId: string; confidence: number } | null> {
    const normalizedName = normalizeProductName(scrapedProduct.name_en);
    const normalizedBrand = this.normalizeForMatching(scrapedProduct.brand);
    const normalizedModel = this.normalizeForMatching(scrapedProduct.model);

    // Get products with similar brand
    const { data, error } = await this.supabase
      .from('products')
      .select('id, name_en, brand, model')
      .ilike('brand', `%${normalizedBrand}%`)
      .eq('is_active', true)
      .eq('category', scrapedProduct.category)
      .limit(50);

    if (error || !data || data.length === 0) return null;

    let bestMatch: { productId: string; confidence: number } | null = null;
    let bestScore = 0;

    for (const product of data) {
      const similarity = matchProducts(
        scrapedProduct.name_en,
        scrapedProduct.brand,
        scrapedProduct.model,
        product.name_en,
        product.brand,
        product.model
      );

      if (similarity > bestScore && similarity > 0.7) {
        bestScore = similarity;
        bestMatch = {
          productId: product.id,
          confidence: similarity,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Normalize text for matching (lowercase, remove special chars)
   */
  normalizeForMatching(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }
}





