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
  private refreshTrackingSupported: Promise<boolean> | null = null;

  private async supportsRefreshTracking(): Promise<boolean> {
    if (!this.refreshTrackingSupported) {
      this.refreshTrackingSupported = this.supabase
        .from('product_stores')
        .select('external_id,last_scraped_at,last_seen_at,consecutive_misses,scrape_status')
        .limit(1)
        .then(({ error }) => !error);
    }
    return this.refreshTrackingSupported;
  }

  /**
   * Create or update product, returning product ID
   */
  async createOrUpdateProduct(
    scrapedProduct: ScrapedProduct,
    storeId: string
  ): Promise<{ productId: string; productStoreId: string | null; created: boolean }> {
    const classified = classifyFromTitle(`${scrapedProduct.name_en} ${scrapedProduct.name_ar}`);
    if (classified && classified !== scrapedProduct.category) {
      scrapedProduct = { ...scrapedProduct, category: classified };
    }

    const externalId = this.getStoreExternalId(scrapedProduct);

    const existingProductId = await this.findExistingProductByStoreIdentity(
      scrapedProduct,
      storeId,
      externalId
    ) ?? await this.productMatcher.findExistingProduct(scrapedProduct);

    let productId: string;
    let created = false;

    if (existingProductId) {
      productId = existingProductId;
      await this.refreshSpecsIfMissing(productId, scrapedProduct);

      if (classified) {
        await this.syncCategoryFromTitle(productId, classified);
      }

      if (this.hasEnrichmentPayload(scrapedProduct)) {
        await this.updateEnrichedFields(productId, scrapedProduct);
      }
    } else {
      productId = await this.createProduct(scrapedProduct);
      created = true;
    }

    const productStoreId = await this.linkProductToStore(productId, storeId, scrapedProduct, externalId);

    return { productId, productStoreId, created };
  }

  private async findExistingProductByStoreIdentity(
    scrapedProduct: ScrapedProduct,
    storeId: string,
    externalId: string | null
  ): Promise<string | null> {
    if (externalId && await this.supportsRefreshTracking()) {
      const { data } = await this.supabase
        .from('product_stores')
        .select('product_id')
        .eq('store_id', storeId)
        .eq('external_id', externalId)
        .maybeSingle();

      if (data?.product_id) return data.product_id;
    }

    const normalizedUrl = this.normalizeProductUrl(scrapedProduct.product_url);
    if (!normalizedUrl) return null;

    const { data } = await this.supabase
      .from('product_stores')
      .select('product_id, product_url')
      .eq('store_id', storeId)
      .limit(50);

    const matched = data?.find((row) => this.normalizeProductUrl(row.product_url) === normalizedUrl);
    return matched?.product_id ?? null;
  }

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
    return { ...titleSpecs, ...existing };
  }

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

  async createProduct(scrapedProduct: ScrapedProduct): Promise<string> {
    const mergedSpecs = this.mergeSpecsWithTitle(scrapedProduct);
    const baseSlug = this.generateSlug(scrapedProduct.name_en);

    const candidates = [
      baseSlug,
      scrapedProduct.sku ? `${baseSlug}-${this.slugSuffixFromSku(scrapedProduct.sku)}` : null,
      `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`,
    ].filter((s): s is string => !!s);

    const trunc = (s: string | null | undefined, max: number) =>
      s == null ? s : (s.length > max ? s.slice(0, max) : s);

    const brand = trunc(scrapedProduct.brand, 100) || 'Unknown';
    const model = trunc(scrapedProduct.model, 200) || scrapedProduct.name_en.slice(0, 200);
    const nameAr = trunc(scrapedProduct.name_ar, 500) || '';
    const nameEn = trunc(scrapedProduct.name_en, 500) || '';

    const enrichedAt = this.hasEnrichmentPayload(scrapedProduct)
      ? new Date().toISOString()
      : null;

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
          merchant_rating: scrapedProduct.merchant_rating ?? null,
          merchant_review_count: scrapedProduct.merchant_review_count ?? 0,
          enriched_at: enrichedAt,
          is_active: true,
        })
        .select('id')
        .single();

      if (!error && data) return data.id;

      lastError = error?.message || 'unknown';

      if (!/products_slug_key|duplicate key/i.test(lastError)) {
        throw new Error(`Failed to create product: ${lastError}`);
      }
    }

    throw new Error(`Failed to create product after slug retries: ${lastError}`);
  }

  private slugSuffixFromSku(sku: string): string {
    return sku.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  }

  async linkProductToStore(
    productId: string,
    storeId: string,
    scrapedProduct: ScrapedProduct,
    externalId = this.getStoreExternalId(scrapedProduct)
  ): Promise<string | null> {
    const skipHistory = process.env.SCRAPING_SKIP_PRICE_HISTORY === 'true';
    const now = new Date().toISOString();
    const supportsRefreshTracking = await this.supportsRefreshTracking();

    const baseData: Record<string, unknown> = {
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
      last_checked_at: now,
      currency: 'SAR',
    };

    if (supportsRefreshTracking) {
      baseData.last_scraped_at = now;
      baseData.last_seen_at = now;
      baseData.consecutive_misses = 0;
      baseData.scrape_status = 'active';
      baseData.external_id = externalId;
    }

    if (skipHistory) {
      const { data, error } = await this.supabase
        .from('product_stores')
        .upsert(baseData as never, { onConflict: 'product_id,store_id' })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to upsert product_store: ${error.message}`);
      }

      return data?.id ?? null;
    }

    const { data: existing } = await this.supabase
      .from('product_stores')
      .select('id, current_price')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .maybeSingle();

    const updateData = baseData as Partial<ProductStoreRow>;

    if (existing) {
      if (existing.current_price !== scrapedProduct.current_price) {
        updateData.last_price_change_at = new Date().toISOString();

        await this.recordPriceHistory(existing.id, scrapedProduct.current_price, {
          originalPrice: scrapedProduct.original_price,
          availability: scrapedProduct.availability,
        });
      }

      const { error: updateError } = await this.supabase
        .from('product_stores')
        .update(updateData)
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`Failed to update product_store: ${updateError.message}`);
      }

      return existing.id;
    }

    const { data, error: insertError } = await this.supabase
      .from('product_stores')
      .insert({
        ...updateData,
        product_id: productId,
        store_id: storeId,
      } as never)
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create product_store: ${insertError.message}`);
    }

    return data?.id ?? null;
  }

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
      availability: availability as ProductStoreRow['availability'],
      last_checked_at: new Date().toISOString(),
    };

    if (await this.supportsRefreshTracking()) {
      updateData.last_scraped_at = new Date().toISOString();
    }

    if (existing.current_price !== price) {
      updateData.last_price_change_at = new Date().toISOString();

      await this.recordPriceHistory(existing.id, price, {
        availability,
      });
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
   * Record price in price_history table.
   *
   * Note:
   * product_stores.product_id currently references products.id, not canonical_products.id.
   * Therefore canonical_product_id is intentionally stored as null until
   * products and canonical_products are unified in a future migration.
   */
  async recordPriceHistory(
    productStoreId: string,
    price: number,
    options?: {
      originalPrice?: number | null;
      availability?: string;
      scrapingRunId?: number | null;
    }
  ): Promise<void> {
    try {
      const { data: productStore } = await this.supabase
        .from('product_stores')
        .select('store_id')
        .eq('id', productStoreId)
        .maybeSingle();

      const storeId =
        (productStore as { store_id?: number | string | null } | null)?.store_id ?? null;

      let storeName: string | null = null;

      if (storeId !== null) {
        const { data: store } = await this.supabase
          .from('stores')
          .select('slug')
          .eq('id', storeId)
          .maybeSingle();

        storeName = (store as { slug?: string | null } | null)?.slug ?? null;
      }

      const { error } = await this.supabase
        .from('price_history')
        .insert({
          product_store_id: productStoreId,
          canonical_product_id: null,
          // Canonical store identity, taken from the product_store this price
          // belongs to (its store_id is the authoritative value written upstream
          // when the offer was linked). Written at insert time so price_history
          // is joinable on store_id without backfill.
          store_id: storeId,
          store_name: storeName,
          price,
          original_price: options?.originalPrice ?? null,
          availability: options?.availability ?? 'in_stock',
          scraping_run_id: options?.scrapingRunId ?? null,
          observed_at: new Date().toISOString(),
        });

      if (error) {
        console.error(`Failed to record price history: ${error.message}`);
      }
    } catch (err) {
      console.error('recordPriceHistory threw:', err);
    }
  }

  async markMissingStoreOffers(options: {
    storeId: string;
    seenProductStoreIds: string[];
    categories?: string[];
    staleAfterMisses?: number;
    outOfStockAfterMisses?: number;
  }): Promise<{ markedMissing: number; markedOutOfStock: number }> {
    const seen = new Set(options.seenProductStoreIds.filter(Boolean));

    if (seen.size === 0) return { markedMissing: 0, markedOutOfStock: 0 };
    if (!await this.supportsRefreshTracking()) return { markedMissing: 0, markedOutOfStock: 0 };

    const { data, error } = await this.supabase
      .from('product_stores')
      .select('id, consecutive_misses, products!inner(category)')
      .eq('store_id', options.storeId);

    if (error || !data) {
      throw new Error(`Failed to fetch store offers for stale marking: ${error?.message || 'unknown'}`);
    }

    const categories = options.categories && options.categories.length > 0
      ? new Set(options.categories)
      : null;

    const staleAfterMisses = options.staleAfterMisses ?? 3;
    const outOfStockAfterMisses = options.outOfStockAfterMisses ?? 5;
    const now = new Date().toISOString();

    let markedMissing = 0;
    let markedOutOfStock = 0;

    for (const row of data as Array<{ id: string; consecutive_misses?: number | null; products?: { category?: string } | { category?: string }[] }>) {
      if (seen.has(row.id)) continue;

      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      if (categories && !categories.has(product?.category || '')) continue;

      const nextMisses = (row.consecutive_misses || 0) + 1;

      const update: Partial<ProductStoreRow> = {
        consecutive_misses: nextMisses,
        last_scraped_at: now,
        scrape_status: nextMisses >= staleAfterMisses ? 'stale' : 'missed',
      };

      if (nextMisses >= outOfStockAfterMisses) {
        update.availability = 'out_of_stock';
        markedOutOfStock++;
      }

      const { error: updateError } = await this.supabase
        .from('product_stores')
        .update(update)
        .eq('id', row.id);

      if (updateError) {
        throw new Error(`Failed to mark product_store missing: ${updateError.message}`);
      }

      markedMissing++;
    }

    return { markedMissing, markedOutOfStock };
  }

  getStoreExternalId(scrapedProduct: ScrapedProduct): string | null {
    const sku = scrapedProduct.sku?.trim();
    if (sku) return sku.slice(0, 500);

    const normalizedUrl = this.normalizeProductUrl(scrapedProduct.product_url);
    if (!normalizedUrl) return null;

    return normalizedUrl.slice(0, 500);
  }

  private normalizeProductUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    try {
      const parsed = new URL(url);
      parsed.hash = '';
      parsed.search = '';
      parsed.hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
      return parsed.toString();
    } catch {
      return url.trim().split('#')[0].split('?')[0].replace(/\/+$/, '') || null;
    }
  }

  private hasEnrichmentPayload(scrapedProduct: ScrapedProduct): boolean {
    if (scrapedProduct.description_en && scrapedProduct.description_en.trim().length > 0) return true;
    if (scrapedProduct.description_ar && scrapedProduct.description_ar.trim().length > 0) return true;
    if (Array.isArray(scrapedProduct.image_urls) && scrapedProduct.image_urls.length > 1) return true;
    if (scrapedProduct.merchant_rating != null) return true;
    if ((scrapedProduct.merchant_review_count ?? 0) > 0) return true;
    if (scrapedProduct.specifications && Object.keys(scrapedProduct.specifications).length >= 3) return true;

    return false;
  }

  async updateEnrichedFields(productId: string, scrapedProduct: ScrapedProduct): Promise<void> {
    const { data: current } = await this.supabase
      .from('products')
      .select('description_ar, description_en, image_urls, specifications')
      .eq('id', productId)
      .single();

    const update: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
    };

    const incomingDescAr = (scrapedProduct.description_ar || '').trim();
    if (incomingDescAr && !((current?.description_ar || '') as string).trim()) {
      update.description_ar = incomingDescAr;
    }

    const incomingDescEn = (scrapedProduct.description_en || '').trim();
    if (incomingDescEn && !((current?.description_en || '') as string).trim()) {
      update.description_en = incomingDescEn;
    }

    const incomingImages = Array.isArray(scrapedProduct.image_urls)
      ? scrapedProduct.image_urls
      : [];

    const currentImages = Array.isArray(current?.image_urls)
      ? (current?.image_urls as string[])
      : [];

    if (incomingImages.length > currentImages.length) {
      update.image_urls = incomingImages;
    }

    if (scrapedProduct.specifications && Object.keys(scrapedProduct.specifications).length > 0) {
      const currentSpecs = ((current?.specifications as Record<string, unknown> | null) || {});
      update.specifications = { ...currentSpecs, ...scrapedProduct.specifications };
    }

    if (scrapedProduct.merchant_rating != null) {
      update.merchant_rating = scrapedProduct.merchant_rating;
    }

    if (scrapedProduct.merchant_review_count != null) {
      update.merchant_review_count = scrapedProduct.merchant_review_count;
    }

    const { error } = await this.supabase
      .from('products')
      .update(update)
      .eq('id', productId);

    if (error) {
      throw new Error(`Failed to update enriched fields: ${error.message}`);
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
