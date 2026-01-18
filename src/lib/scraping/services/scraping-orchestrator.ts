import type {
  DiscoveryOptions,
  DiscoveryResult,
  PriceUpdateOptions,
  PriceUpdateResult,
  ScrapedProduct,
  ProductCategory,
} from '../base/types';
import { JarirScraper } from '../stores/jarir-scraper';
import { ProductService } from './product-service';
import { DataValidator } from '../validation/data-validator';
import { createServerClient } from '@/lib/database';

/**
 * Orchestrator for running scraping jobs
 */
export class ScrapingOrchestrator {
  private productService = new ProductService();
  private validator = new DataValidator();

  /**
   * Run product discovery job
   */
  async runDiscoveryJob(options: DiscoveryOptions): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const storeSlug = options.store_slug;
    const category = options.category || 'smartphone'; // Default category

    try {
      // Get store ID from slug
      const storeId = await this.getStoreId(storeSlug);
      if (!storeId) {
        throw new Error(`Store not found: ${storeSlug}`);
      }

      // Get scraper for store
      const scraper = this.getScraperForStore(storeSlug);
      if (!scraper) {
        throw new Error(`Scraper not found for store: ${storeSlug}`);
      }

      // Discover products
      const scrapedProducts = await scraper.discoverProducts(
        category as ProductCategory,
        options.max_pages || 10
      );

      let productsCreated = 0;
      let productsLinked = 0;
      let errors = 0;

      // Process each product
      for (const scrapedProduct of scrapedProducts) {
        try {
          // Validate product
          const validation = this.validator.validateProduct(
            scrapedProduct,
            new URL(scraper.config.base_url).hostname
          );

          if (!validation.isValid && !options.dry_run) {
            console.warn(`Product validation failed: ${validation.errors.join(', ')}`);
            errors++;
            continue;
          }

          if (options.dry_run) {
            // Just count, don't save
            productsCreated++;
            continue;
          }

          // Create or update product
          const result = await this.productService.createOrUpdateProduct(
            scrapedProduct,
            storeId
          );

          if (result.created) {
            productsCreated++;
          } else {
            productsLinked++;
          }
        } catch (error) {
          console.error(`Error processing product:`, error);
          errors++;
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        store: storeSlug,
        category,
        products_discovered: scrapedProducts.length,
        products_created: productsCreated,
        products_linked: productsLinked,
        errors,
        duration_ms: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        store: storeSlug,
        category: category || 'unknown',
        products_discovered: 0,
        products_created: 0,
        products_linked: 0,
        errors: 1,
        duration_ms: duration,
      };
    }
  }

  /**
   * Run price update job
   */
  async runPriceUpdateJob(options: PriceUpdateOptions): Promise<PriceUpdateResult> {
    const startTime = Date.now();
    const supabase = createServerClient();

    try {
      // Get products that need price updates
      const olderThanHours = options.older_than_hours || 24;
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      let query = supabase
        .from('product_stores')
        .select('id, product_id, store_id, product_url, current_price, stores!inner(slug)')
        .or(`last_checked_at.is.null,last_checked_at.lt.${cutoffTime.toISOString()}`)
        .limit(options.max_products || 100);

      if (options.store_slug) {
        query = query.eq('stores.slug', options.store_slug);
      }

      const { data: productStores, error } = await query;

      if (error || !productStores) {
        throw new Error(`Failed to fetch products: ${error?.message || 'Unknown error'}`);
      }

      // Group by store
      const byStore: Record<string, typeof productStores> = {};
      for (const ps of productStores) {
        const storeSlug = (ps as any).stores.slug;
        if (!byStore[storeSlug]) {
          byStore[storeSlug] = [];
        }
        byStore[storeSlug].push(ps);
      }

      let storesUpdated = 0;
      let productsUpdated = 0;
      let priceChanges = 0;
      let errors = 0;

      // Update prices for each store
      for (const [storeSlug, products] of Object.entries(byStore)) {
        try {
          const scraper = this.getScraperForStore(storeSlug);
          if (!scraper) {
            console.warn(`Scraper not found for store: ${storeSlug}`);
            continue;
          }

          for (const productStore of products) {
            try {
              const scrapedProduct = await scraper.updateProductPrice(
                (productStore as any).product_url
              );

              if (scrapedProduct) {
                const oldPrice = (productStore as any).current_price;
                const newPrice = scrapedProduct.current_price;

                await this.productService.updateProductPrice(
                  (productStore as any).product_id,
                  (productStore as any).store_id,
                  newPrice,
                  scrapedProduct.availability
                );

                productsUpdated++;

                if (oldPrice !== newPrice) {
                  priceChanges++;
                }
              }
            } catch (error) {
              console.error(`Error updating product price:`, error);
              errors++;
            }
          }

          storesUpdated++;
        } catch (error) {
          console.error(`Error processing store ${storeSlug}:`, error);
          errors++;
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        stores_updated: storesUpdated,
        products_updated: productsUpdated,
        price_changes: priceChanges,
        errors,
        duration_ms: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        stores_updated: 0,
        products_updated: 0,
        price_changes: 0,
        errors: 1,
        duration_ms: duration,
      };
    }
  }

  /**
   * Get scraper instance for store
   */
  getScraperForStore(storeSlug: string) {
    switch (storeSlug) {
      case 'jarir':
        return new JarirScraper();
      // TODO: Add other scrapers
      // case 'extra':
      //   return new ExtraScraper();
      // case 'noon':
      //   return new NoonScraper();
      // case 'amazon':
      //   return new AmazonScraper();
      // case 'almanea':
      //   return new AlmaneaScraper();
      default:
        return null;
    }
  }

  /**
   * Get store ID from slug
   */
  private async getStoreId(storeSlug: string): Promise<string | null> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('stores')
      .select('id')
      .eq('slug', storeSlug)
      .single();

    if (error || !data) return null;
    return data.id;
  }
}

