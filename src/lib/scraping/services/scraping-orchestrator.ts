import type {
  DiscoveryOptions,
  DiscoveryResult,
  PriceUpdateOptions,
  PriceUpdateResult,
  ScrapedProduct,
  ProductCategory,
} from '../base/types';
import { JarirScraper } from '../stores/jarir-scraper';
import { AmazonScraper } from '../stores/amazon-scraper';
import { NoonScraper } from '../stores/noon-scraper';
import { ExtraScraper } from '../stores/extra-scraper';
import { AlmaneaScraper } from '../stores/almanea-scraper';
import { SamsungKsaScraper } from '../stores/samsung-ksa-scraper';
import { ShakerScraper } from '../stores/shaker-scraper';
import { ZagzoogScraper } from '../stores/zagzoog-scraper';
import { AlesayiScraper } from '../stores/alesayi-scraper';
import { SwsgScraper } from '../stores/swsg-scraper';
import { AlkhunaizanScraper } from '../stores/alkhunaizan-scraper';
import { BukhamsenScraper } from '../stores/bukhamsen-scraper';
import { AlghanimScraper } from '../stores/alghanim-scraper';
import { AlsaifGalleryScraper } from '../stores/alsaif-gallery-scraper';
import { LuluGccScraper } from '../stores/lulu-gcc-scraper';
import { ProductService } from './product-service';
import { DataValidator } from '../validation/data-validator';
import { createServerClient } from '@/lib/database';
import { createNotification, sendBackInStockEmail } from '@/lib/auth/notifications';
import { createAuditLog } from '@/lib/auth/audit';
import { sendPushToUser } from '@/lib/push/expo-push';
import { sendWebPushToUser } from '@/lib/push/web-push';

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
        .select('id, product_id, store_id, product_url, current_price, availability, stores!inner(slug, name_ar, name_en)')
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

                // Detect back-in-stock transition
                const oldAvailability = (productStore as any).availability;
                const newAvailability = scrapedProduct.availability;
                if (oldAvailability && oldAvailability !== 'in_stock' && newAvailability === 'in_stock') {
                  const store = (productStore as any).stores;
                  this.notifyBackInStock(
                    supabase,
                    (productStore as any).product_id,
                    (productStore as any).store_id,
                    newPrice,
                    { name_ar: store.name_ar, name_en: store.name_en }
                  ).catch((err) => console.error('Back-in-stock notification error:', err));
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
      case 'amazon':
        return new AmazonScraper();
      case 'noon':
        return new NoonScraper();
      case 'extra':
        return new ExtraScraper();
      case 'almanea':
        return new AlmaneaScraper();
      case 'samsung_ksa':
        return new SamsungKsaScraper();
      case 'shaker':
        return new ShakerScraper();
      case 'zagzoog':
        return new ZagzoogScraper();
      case 'alesayi':
        return new AlesayiScraper();
      case 'swsg':
        return new SwsgScraper();
      case 'alkhunaizan':
        return new AlkhunaizanScraper();
      case 'bukhamsen':
        return new BukhamsenScraper();
      case 'alghanim':
        return new AlghanimScraper();
      case 'alsaif_gallery':
        return new AlsaifGalleryScraper();
      case 'lulu_gcc':
        return new LuluGccScraper();
      default:
        return null;
    }
  }

  /**
   * Notify users with active price alerts when a product comes back in stock
   */
  private async notifyBackInStock(
    supabase: ReturnType<typeof createServerClient>,
    productId: string,
    storeId: string,
    price: number,
    store: { name_ar: string; name_en: string }
  ) {
    const [productResult, alertsResult] = await Promise.all([
      supabase.from('products').select('name_ar, name_en, slug').eq('id', productId).single(),
      supabase
        .from('price_alerts')
        .select('user_id, users(id, email, full_name, locale)')
        .eq('product_id', productId)
        .eq('is_active', true),
    ]);

    const product = productResult.data;
    const alerts = alertsResult.data;
    if (!product || !alerts?.length) return;

    for (const alert of alerts) {
      const user = (alert as any).users;
      const locale = (user?.locale || 'ar') as 'ar' | 'en';
      const productName = locale === 'ar' ? product.name_ar : product.name_en;
      const storeName = locale === 'ar' ? store.name_ar : store.name_en;
      const productLink = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/products/${product.slug}`;

      // In-app notification
      createNotification({
        user_id: alert.user_id,
        type: 'back_in_stock',
        title_ar: `عاد للمخزون: ${product.name_ar}`,
        title_en: `Back in Stock: ${product.name_en}`,
        message_ar: `${product.name_ar} أصبح متوفراً الآن في ${store.name_ar} بسعر ${Math.round(price).toLocaleString()} ر.س`,
        message_en: `${product.name_en} is now available at ${store.name_en} for ${Math.round(price).toLocaleString()} SAR`,
        product_id: productId,
        store_id: storeId,
      }).catch((err) => console.error('Back-in-stock in-app notification error:', err));

      // Email
      if (user?.email) {
        sendBackInStockEmail(user.email, {
          product_name: productName,
          price,
          store_name: storeName,
          product_link: productLink,
        }, locale).catch((err) => console.error('Back-in-stock email error:', err));
      }

      // Mobile push
      const pushTitle = locale === 'ar' ? `عاد للمخزون: ${productName}` : `Back in Stock: ${productName}`;
      const pushBody = locale === 'ar'
        ? `متوفر الآن في ${storeName} بسعر ${Math.round(price).toLocaleString()} ر.س`
        : `Now available at ${storeName} for ${Math.round(price).toLocaleString()} SAR`;

      sendPushToUser(alert.user_id, {
        title: pushTitle,
        body: pushBody,
        data: { type: 'back_in_stock', product_id: productId, product_slug: product.slug },
        channelId: 'price-alerts',
      }).catch((err) => console.error('Back-in-stock push error:', err));

      // Web push
      sendWebPushToUser(alert.user_id, {
        title: pushTitle,
        body: pushBody,
        data: { url: `/${locale}/products/${product.slug}`, type: 'back_in_stock', product_id: productId },
        dir: locale === 'ar' ? 'rtl' : 'ltr',
        lang: locale,
        tag: `back-in-stock-${productId}`,
      }).catch((err) => console.error('Back-in-stock web push error:', err));
    }

    // Audit log for back-in-stock alert batch
    createAuditLog({
      action: 'back_in_stock_alert_sent',
      entity_type: 'product',
      entity_id: productId,
      details: { store_id: storeId, price, users_notified: alerts.length },
    }).catch(() => {});
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






