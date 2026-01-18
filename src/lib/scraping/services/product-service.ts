import { createServerClient } from '@/lib/database';
import type { ScrapedProduct } from '../base/types';
import { ProductMatcher } from '../matching/product-matcher';
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
    // Try to find existing product
    const existingProductId = await this.productMatcher.findExistingProduct(scrapedProduct);

    let productId: string;
    let created = false;

    if (existingProductId) {
      productId = existingProductId;
    } else {
      // Create new product
      productId = await this.createProduct(scrapedProduct);
      created = true;
    }

    // Link/update product in store
    await this.linkProductToStore(productId, storeId, scrapedProduct);

    return { productId, created };
  }

  /**
   * Create new product in database
   */
  async createProduct(scrapedProduct: ScrapedProduct): Promise<string> {
    const slug = this.generateSlug(scrapedProduct.name_en);

    const { data, error } = await this.supabase
      .from('products')
      .insert({
        name_ar: scrapedProduct.name_ar,
        name_en: scrapedProduct.name_en,
        slug,
        category: scrapedProduct.category,
        brand: scrapedProduct.brand,
        model: scrapedProduct.model,
        sku: scrapedProduct.sku || null,
        description_ar: scrapedProduct.description_ar || null,
        description_en: scrapedProduct.description_en || null,
        image_urls: scrapedProduct.image_urls,
        specifications: scrapedProduct.specifications,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create product: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create product: No data returned');
    }

    return data.id;
  }

  /**
   * Link product to store or update existing link
   */
  async linkProductToStore(
    productId: string,
    storeId: string,
    scrapedProduct: ScrapedProduct
  ): Promise<void> {
    // Check if product_store entry exists
    const { data: existing, error: fetchError } = await this.supabase
      .from('product_stores')
      .select('id, current_price')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .single();

    const updateData: Partial<ProductStoreRow> = {
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

