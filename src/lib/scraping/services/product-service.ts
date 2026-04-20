import { createServerClient } from '@/lib/database';
import type { ScrapedProduct } from '../base/types';
import { ProductMatcher } from '../matching/product-matcher';
import { extractSpecsFromTitle } from '../config/spec-configs';
import { classifyFromTitle } from '../utils/category-utils';
import type { Database } from '@/lib/database/types';

type ProductStoreRow = Database['public']['Tables']['product_stores']['Row'];

/**
 * Service for creating and updating products in database
 */
export class ProductService {
  private supabase = createServerClient();
  private productMatcher = new ProductMatcher();

  /**
   * Create or update product, returning product ID
   */
  async createOrUpdateProduct(
    scrapedProduct: ScrapedProduct,
    storeId: string
  ): Promise<{ productId: string; created: boolean }> {
    // Title-based classification — the single source of truth for category
    // on every scrape. When the title confidently maps to a specific category
    // we override the scraper's URL-derived category. This is what fixes
    // stores like Jarir that use one URL for mixed categories (e.g.
    // computers-tablets.html for both laptops AND tablets).
    //
    // `classified` is kept separately so we can drive self-healing below:
    // only confident (non-null) verdicts are written back to the DB for
    // existing products. Ambiguous titles leave the stored category alone.
    const classified = classifyFromTitle(`${scrapedProduct.name_en} ${scrapedProduct.name_ar}`);
    if (classified && classified !== scrapedProduct.category) {
      scrapedProduct = { ...scrapedProduct, category: classified };
    }

    // Try to find existing product
    const existingProductId = await this.productMatcher.findExistingProduct(scrapedProduct);

    let productId: string;
    let created = false;

    if (existingProductId) {
      productId = existingProductId;
      await this.refreshSpecsIfMissing(productId, scrapedProduct);
      if (classified) {
        await this.syncCategoryFromTitle(productId, classified);
      }
    } else {
      productId = await this.createProduct(scrapedProduct);
      created = true;
    }

    await this.linkProductToStore(productId, storeId, scrapedProduct);

    return { productId, created };
  }

  /**
   * Keep the stored category in sync with the title-based classifier.
   *
   * Only called when the classifier was CONFIDENT about the title (i.e. it
   * returned a non-null specific category). Because the classifier is a
   * deterministic function of the title, two scrapes of the same product
   * always agree — there is no flip-flop risk. This is what makes the
   * 4-hour discovery cron self-healing: each re-scrape corrects any
   * categories that drifted before the classifier was wired in.
   *
   * We NEVER reach this path with a null/ambiguous classification, so an
   * unrecognized title cannot blow away a human-corrected category.
   */
  private async syncCategoryFromTitle(productId: string, newCategory: string): Promise<void> {
    const { data } = await this.supabase
      .from('products')
      .select('category')
      .eq('id', productId)
      .single();
    const current = (data as { category?: string } | null)?.category;
    if (current === newCategory) return;
    await this.supabase
      .from('products')
      .update({ category: newCategory } as never)
      .eq('id', productId);
  }

  private mergeSpecsWithTitle(scrapedProduct: ScrapedProduct): Record<string, unknown> {
    const titleSpecs = extractSpecsFromTitle(`${scrapedProduct.name_en} ${scrapedProduct.name_ar}`);
    const existing = (scrapedProduct.specifications || {}) as Record<string, unknown>;
    // Scraper-provided specs win over title-extracted ones.
    return { ...titleSpecs, ...existing };
  }

  /**
   * When an existing product is matched again, top up any missing spec keys
   * from the fresh title so DB-backed search can filter by those specs.
   */
  private async refreshSpecsIfMissing(productId: string, scrapedProduct: ScrapedProduct): Promise<void> {
    const titleSpecs = extractSpecsFromTitle(`${scrapedProduct.name_en} ${scrapedProduct.name_ar}`);
    if (Object.keys(titleSpecs).length === 0) return;

    const { data } = await this.supabase
      .from('products')
      .select('specifications')
      .eq('id', productId)
      .single();

    const current = ((data?.specifications as Record<string, unknown> | null) || {});
    let changed = false;
    const merged: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(titleSpecs)) {
      if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
        merged[key] = value;
        changed = true;
      }
    }

    if (!changed) return;

    await this.supabase
      .from('products')
      .update({ specifications: merged })
      .eq('id', productId);
  }

  /**
   * Create new product in database
   */
  async createProduct(scrapedProduct: ScrapedProduct): Promise<string> {
    const mergedSpecs = this.mergeSpecsWithTitle(scrapedProduct);
    const baseSlug = this.generateSlug(scrapedProduct.name_en);

    // Try up to 3 slug variants to avoid races within a parallel batch where
    // two products produce the same base slug (same name + different color,
    // different storage, etc.). First attempt: base slug. Fallback attempts
    // append the SKU (unique) then a random suffix.
    const candidates = [
      baseSlug,
      scrapedProduct.sku ? `${baseSlug}-${this.slugSuffixFromSku(scrapedProduct.sku)}` : null,
      `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`,
    ].filter((s): s is string => !!s);

    // Defensive truncation to the DB column limits. Amazon titles run 250+
    // chars and the scraper's brand-extraction leaves the rest as `model`
    // — which overflows VARCHAR(200). Truncating here keeps the catalog
    // intact even if the DB schema isn't widened. We prefer widening the
    // schema (VARCHAR(500)) for cleanliness, but this guard makes the
    // application robust either way.
    const trunc = (s: string | null | undefined, max: number) =>
      s == null ? s : (s.length > max ? s.slice(0, max) : s);
    const brand = trunc(scrapedProduct.brand, 100) || 'Unknown';
    const model = trunc(scrapedProduct.model, 200) || scrapedProduct.name_en.slice(0, 200);
    const nameAr = trunc(scrapedProduct.name_ar, 500) || '';
    const nameEn = trunc(scrapedProduct.name_en, 500) || '';

    let lastError: string | null = null;
    for (const slug of candidates) {
      const { data, error } = await this.supabase
        .from('products')
        .insert({
          name_ar: nameAr,
          name_en: nameEn,
          slug: trunc(slug, 500) || slug,
          category: scrapedProduct.category,
          brand,
          model,
          sku: scrapedProduct.sku || null,
          description_ar: scrapedProduct.description_ar || null,
          description_en: scrapedProduct.description_en || null,
          image_urls: scrapedProduct.image_urls,
          specifications: mergedSpecs,
          is_active: true,
        })
        .select('id')
        .single();

      if (!error && data) return data.id;

      lastError = error?.message || 'unknown';
      // Retry only on slug conflict — any other error we bail immediately.
      if (!/products_slug_key|duplicate key/i.test(lastError)) {
        throw new Error(`Failed to create product: ${lastError}`);
      }
    }
    throw new Error(`Failed to create product after slug retries: ${lastError}`);
  }

  private slugSuffixFromSku(sku: string): string {
    return sku.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  }

  /**
   * Link product to store or update existing link.
   *
   * Uses a single UPSERT (via Supabase's `onConflict: 'product_id,store_id'`)
   * instead of a SELECT + INSERT/UPDATE round-trip, halving query volume.
   * When SCRAPING_SKIP_PRICE_HISTORY=true (set during bulk seed) we skip the
   * price-history lookup entirely — further saves one query per product.
   */
  async linkProductToStore(
    productId: string,
    storeId: string,
    scrapedProduct: ScrapedProduct
  ): Promise<void> {
    const skipHistory = process.env.SCRAPING_SKIP_PRICE_HISTORY === 'true';

    const baseData = {
      product_id: productId,
      store_id: storeId,
      current_price: scrapedProduct.current_price,
      original_price: scrapedProduct.original_price || null,
      availability: scrapedProduct.availability || 'in_stock',
      stock_quantity: scrapedProduct.stock_quantity || null,
      product_url: scrapedProduct.product_url,
      delivery_time_days: scrapedProduct.delivery_time_days || null,
      delivery_cost: scrapedProduct.delivery_cost || 0,
      is_free_delivery: scrapedProduct.is_free_delivery || false,
      is_deal: scrapedProduct.is_deal || false,
      deal_expires_at: scrapedProduct.deal_expires_at || null,
      coupon_code: scrapedProduct.coupon_code || null,
      last_checked_at: new Date().toISOString(),
      currency: 'SAR',
    };

    if (skipHistory) {
      const { error } = await this.supabase
        .from('product_stores')
        .upsert(baseData as never, { onConflict: 'product_id,store_id' });
      if (error) {
        throw new Error(`Failed to upsert product_store: ${error.message}`);
      }
      return;
    }

    // Full path: preserves price-history tracking via initial select.
    const { data: existing } = await this.supabase
      .from('product_stores')
      .select('id, current_price')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .maybeSingle();

    const updateData: Partial<ProductStoreRow> = baseData;

    if (existing) {
      // Track price change
      if (existing.current_price !== scrapedProduct.current_price) {
        updateData.last_price_change_at = new Date().toISOString();

        // Record in price history
        await this.recordPriceHistory(existing.id, scrapedProduct.current_price);
      }

      // Update existing entry
      const { error: updateError } = await this.supabase
        .from('product_stores')
        .update(updateData)
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`Failed to update product_store: ${updateError.message}`);
      }
    } else {
      // Create new entry
      const { error: insertError } = await this.supabase
        .from('product_stores')
        .insert({
          ...updateData,
          product_id: productId,
          store_id: storeId,
        } as any);

      if (insertError) {
        throw new Error(`Failed to create product_store: ${insertError.message}`);
      }
    }
  }

  /**
   * Update product price
   */
  async updateProductPrice(
    productId: string,
    storeId: string,
    price: number,
    availability: string
  ): Promise<void> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('product_stores')
      .select('id, current_price')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .single();

    if (fetchError || !existing) {
      throw new Error(`Product-store link not found: ${fetchError?.message || 'Not found'}`);
    }

    const updateData: Partial<ProductStoreRow> = {
      current_price: price,
      availability: availability as any,
      last_checked_at: new Date().toISOString(),
    };

    // Track price change
    if (existing.current_price !== price) {
      updateData.last_price_change_at = new Date().toISOString();
      await this.recordPriceHistory(existing.id, price);
    }

    const { error } = await this.supabase
      .from('product_stores')
      .update(updateData)
      .eq('id', existing.id);

    if (error) {
      throw new Error(`Failed to update price: ${error.message}`);
    }
  }

  /**
   * Record price in price_history table
   */
  async recordPriceHistory(productStoreId: string, price: number): Promise<void> {
    const { error } = await this.supabase
      .from('price_history')
      .insert({
        product_store_id: productStoreId,
        price,
      });

    if (error) {
      console.error(`Failed to record price history: ${error.message}`);
      // Don't throw - price history is not critical
    }
  }

  /**
   * Generate URL-safe slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}






