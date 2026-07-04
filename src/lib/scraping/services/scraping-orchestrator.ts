import type {
  DiscoveryOptions,
  DiscoveryResult,
  PriceUpdateOptions,
  PriceUpdateResult,
  RateLimitConfig,
  ScrapedProduct,
} from '../base/types';
import type { ProductCategory } from '@/lib/database/types';
import { JarirScraper } from '../stores/jarir-scraper';
import { AmazonScraper } from '../stores/amazon-scraper';
import { NoonScraper } from '../stores/noon-scraper';
import { ExtraScraper } from '../stores/extra-scraper';
import { AlmaneaScraper } from '../stores/almanea-scraper';
import { SamsungKsaScraper } from '../stores/samsung-ksa-scraper';
import { ShakerScraper } from '../stores/shaker-scraper';
import { SwsgScraper } from '../stores/swsg-scraper';
import { ProductService } from './product-service';
import { IngestionService } from './ingestion-service';
import { DataValidator } from '../validation/data-validator';
import { createServerClient } from '@/lib/database';
import { createNotification, sendBackInStockEmail } from '@/lib/auth/notifications';
import { createAuditLog } from '@/lib/auth/audit';
import { sendPushToUser } from '@/lib/push/expo-push';
import { sendWebPushToUser } from '@/lib/push/web-push';

async function retryAsync<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; baseDelayMs: number }
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === options.maxAttempts) break;
      const delay = options.baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

const ALL_PRODUCT_CATEGORIES: ProductCategory[] = [
  'smartphone',
  'laptop',
  'tv',
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

type PriceUpdateStoreRow = {
  id: string;
  product_id: string;
  store_id: string;
  product_url: string;
  current_price: number;
  availability: string | null;
  consecutive_failures: number | null;
  stores: {
    slug: string;
    name_ar: string;
    name_en: string;
  };
};

type BackInStockAlertRow = {
  user_id: string;
  users:
    | {
        id: string;
        email: string | null;
        full_name: string | null;
        locale: string | null;
      }
    | Array<{
        id: string;
        email: string | null;
        full_name: string | null;
        locale: string | null;
      }>
    | null;
};

function getScraperBaseHostname(scraper: unknown): string {
  const baseUrl = (scraper as { config?: { base_url?: string } }).config?.base_url;
  return new URL(baseUrl || 'https://example.com').hostname;
}

function describeReason(reason: unknown): string {
  if (reason instanceof Error) {
    return `${reason.message} | STACK: ${reason.stack ?? 'no stack'}`;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

export class ScrapingOrchestrator {
  private productService = new ProductService();
  private ingestion = new IngestionService();
  private validator = new DataValidator();
  

  async runDiscoveryJob(options: DiscoveryOptions): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const storeSlug = options.store_slug;

    const categories: ProductCategory[] = options.categories && options.categories.length > 0
      ? options.categories
      : options.category
        ? [options.category]
        : ALL_PRODUCT_CATEGORIES;

    try {
      const storeId = await this.getStoreId(storeSlug);
      if (!storeId) {
        throw new Error(`Store not found: ${storeSlug}`);
      }
      const scraper = this.getScraperForStore(storeSlug);
      if (!scraper) {
        throw new Error(`Scraper not found for store: ${storeSlug}`);
      }

      let productsDiscovered = 0;
      let productsCreated = 0;
      let productsLinked = 0;
      let productsMarkedMissing = 0;
      let productsMarkedOutOfStock = 0;
      let errors = 0;
      const seenProductStoreIds = new Set<string>();

      const CATEGORY_CONCURRENCY = Math.max(
        1,
        parseInt(process.env.DISCOVERY_CATEGORY_CONCURRENCY ?? '4', 10) || 4
      );

      const scrapeCategory = async (category: ProductCategory) => {
        try {
          const scrapedProducts = await scraper.discoverProducts(
            category,
            options.max_pages || 10
          );
          if (!options.dry_run) {
  await this.ingestion.ingestBatch(storeSlug, scrapedProducts);
}
          if (scrapedProducts.length > 0) {
            console.log(`    [${storeSlug}/${category}] scraped ${scrapedProducts.length} products — writing to DB…`);
          }

          const hostname = getScraperBaseHostname(scraper);
          const BATCH = 12;
          const dbStart = Date.now();
          let localCreated = 0;
          let localLinked = 0;
          let localErrors = 0;
          for (let i = 0; i < scrapedProducts.length; i += BATCH) {
            const slice = scrapedProducts.slice(i, i + BATCH);
            const results = await Promise.allSettled(
              slice.map(async (scrapedProduct) => {
                const validation = this.validator.validateProduct(scrapedProduct, hostname);
                if (!validation.isValid && !options.dry_run) {
                  return { kind: 'invalid' as const, errors: validation.errors };
                }
                if (options.dry_run) return { kind: 'dry' as const };
                const r = await this.productService.createOrUpdateProduct(scrapedProduct, storeId);
                if (r.productStoreId) seenProductStoreIds.add(r.productStoreId);
                return { kind: 'saved' as const, created: r.created };
              })
            );
            for (const res of results) {
              if (res.status === 'rejected') {
                console.error(`[${storeSlug}/${category}] PRODUCT ERROR FULL: ${describeReason(res.reason)}`);
                localErrors++;
                continue;
              }
              const v = res.value;
              if (v.kind === 'invalid') {
                console.warn(`[${storeSlug}/${category}] validation failed: ${v.errors.join(', ')}`);
                localErrors++;
              } else if (v.kind === 'dry' || v.kind === 'saved') {
                if (v.kind === 'saved' && v.created) { localCreated++; }
                else if (v.kind === 'saved') { localLinked++; }
                else localCreated++;
              }
            }
          }
          if (scrapedProducts.length > 0) {
            const dbMs = Date.now() - dbStart;
            console.log(
              `    [${storeSlug}/${category}] DB write done in ${(dbMs / 1000).toFixed(1)}s — created=${localCreated} linked=${localLinked} errors=${localErrors}`
            );
          }
          return {
            discovered: scrapedProducts.length,
            created: localCreated,
            linked: localLinked,
            errors: localErrors,
          };
        } catch (error) {
          console.error(`[${storeSlug}/${category}] discovery failed:`, error);
          return { discovered: 0, created: 0, linked: 0, errors: 1 };
        }
      };

      if (!options.only_supplemental) {
        console.log(
          `[${storeSlug}] discovery: ${categories.length} categories, concurrency=${CATEGORY_CONCURRENCY}`
        );
        for (let i = 0; i < categories.length; i += CATEGORY_CONCURRENCY) {
          const chunk = categories.slice(i, i + CATEGORY_CONCURRENCY);
          const chunkResults = await Promise.all(chunk.map(scrapeCategory));
          for (const r of chunkResults) {
            productsDiscovered += r.discovered;
            productsCreated += r.created;
            productsLinked += r.linked;
            errors += r.errors;
          }
        }
      }

      const scraperWithSup = scraper as unknown as {
        discoverSupplementalProducts?: (maxPages: number) => Promise<ScrapedProduct[]>;
      };
      if (!options.skip_supplemental && typeof scraperWithSup.discoverSupplementalProducts === 'function') {
        try {
          console.log(`[${storeSlug}] running supplemental discovery…`);
          const supProducts = await scraperWithSup.discoverSupplementalProducts!(options.max_pages || 100);
          if (!options.dry_run) {
  await this.ingestion.ingestBatch(storeSlug, supProducts);
`
          if (supProducts.length > 0) {
            console.log(`    [${storeSlug}/supplemental] scraped ${supProducts.length} products — writing to DB…`);
            const hostname = getScraperBaseHostname(scraper);
            const BATCH = 12;
            const dbStart = Date.now();
            let supCreated = 0;
            let supLinked = 0;
            let supErrors = 0;
            for (let i = 0; i < supProducts.length; i += BATCH) {
              const slice = supProducts.slice(i, i + BATCH);
              const results = await Promise.allSettled(
                slice.map(async (sp) => {
                  const validation = this.validator.validateProduct(sp, hostname);
                  if (!validation.isValid && !options.dry_run) {
                    return { kind: 'invalid' as const, errors: validation.errors };
                  }
                  if (options.dry_run) return { kind: 'dry' as const };
                  const r = await this.productService.createOrUpdateProduct(sp, storeId);
                  if (r.productStoreId) seenProductStoreIds.add(r.productStoreId);
                  return { kind: 'saved' as const, created: r.created };
                }),
              );
              for (const res of results) {
                if (res.status === 'rejected') {
                  console.error(`[${storeSlug}/supplemental] PRODUCT ERROR FULL: ${describeReason(res.reason)}`);
                  supErrors++;
                  continue;
                }
                const v = res.value;
                if (v.kind === 'invalid') supErrors++;
                else if (v.kind === 'saved') {
                  if (v.created) supCreated++;
                  else supLinked++;
                }
              }
            }
            productsDiscovered += supProducts.length;
            productsCreated += supCreated;
            productsLinked += supLinked;
            errors += supErrors;
            const dbMs = Date.now() - dbStart;
            console.log(
              `    [${storeSlug}/supplemental] DB write done in ${(dbMs / 1000).toFixed(1)}s — created=${supCreated} linked=${supLinked} errors=${supErrors}`,
            );
          } else {
            console.log(`[${storeSlug}] supplemental: no new products`);
          }
        } catch (err) {
          console.error(`[${storeSlug}] supplemental discovery failed:`, err);
          errors++;
        }
      }

      const shouldMarkMissing = !options.dry_run
        && !options.only_supplemental
        && seenProductStoreIds.size > 0
        && (options.mark_missing || process.env.DISCOVERY_MARK_MISSING === 'true');

      if (shouldMarkMissing) {
        const missingResult = await this.productService.markMissingStoreOffers({
          storeId,
          seenProductStoreIds: Array.from(seenProductStoreIds),
          categories,
          staleAfterMisses: options.stale_after_misses,
          outOfStockAfterMisses: options.out_of_stock_after_misses,
        });
        productsMarkedMissing = missingResult.markedMissing;
        productsMarkedOutOfStock = missingResult.markedOutOfStock;
        console.log(
          `[${storeSlug}] discovery stale-marking: missing=${productsMarkedMissing} out_of_stock=${productsMarkedOutOfStock}`
        );
      }

      return {
        success: true,
        store: storeSlug,
        category: categories.join(','),
        products_discovered: productsDiscovered,
        products_created: productsCreated,
        products_linked: productsLinked,
        products_marked_missing: productsMarkedMissing,
        products_marked_out_of_stock: productsMarkedOutOfStock,
        errors,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`[${storeSlug}] discovery failed:`, error);
      return {
        success: false,
        store: storeSlug,
        category: categories.join(','),
        products_discovered: 0,
        products_created: 0,
        products_linked: 0,
        products_marked_missing: 0,
        products_marked_out_of_stock: 0,
        errors: 1,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  async runPriceUpdateJob(options: PriceUpdateOptions): Promise<PriceUpdateResult> {
    const startTime = Date.now();
    const supabase = createServerClient();

    try {
      const olderThanHours = options.older_than_hours || 24;
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      let query = supabase
        .from('product_stores')
        .select('id, product_id, store_id, product_url, current_price, availability, consecutive_failures, stores!inner(slug, name_ar, name_en)')
        .or(`last_checked_at.is.null,last_checked_at.lt.${cutoffTime.toISOString()}`)
        .lt('consecutive_failures', 5)
        .order('consecutive_failures', { ascending: true })
        .order('last_checked_at', { ascending: true, nullsFirst: true })
        .limit(options.max_products || 500);

      if (options.store_slug) {
        query = query.eq('stores.slug', options.store_slug);
      }

      const { data: productStores, error } = await query;

      if (error || !productStores) {
        throw new Error(`Failed to fetch products: ${error?.message || 'Unknown error'}`);
      }

      const rows = productStores as unknown as PriceUpdateStoreRow[];
      const byStore: Record<string, PriceUpdateStoreRow[]> = {};
      for (const ps of rows) {
        const storeSlug = ps.stores.slug;
        (byStore[storeSlug] ||= []).push(ps);
      }

      let storesUpdated = 0;
      let productsUpdated = 0;
      let priceChanges = 0;
      let errors = 0;

      for (const [storeSlug, products] of Object.entries(byStore)) {
        const scraper = this.getScraperForStore(storeSlug);
        if (!scraper) {
          console.warn(`Scraper not found for store: ${storeSlug}`);
          continue;
        }

        const rateLimit = (scraper as unknown as { config?: { rate_limit?: RateLimitConfig } }).config?.rate_limit;
        const minDelayMs: number = rateLimit?.min_delay_ms ?? 1000;
        const maxDelayMs: number = rateLimit?.max_delay_ms ?? minDelayMs;

        for (const productStore of products) {
          const productStoreId = productStore.id;
          const productId = productStore.product_id;
          const storeId = productStore.store_id;
          const productUrl = productStore.product_url;

          try {
            const scrapedProduct = await retryAsync(
              () => scraper.updateProductPrice(productUrl),
              { maxAttempts: 3, baseDelayMs: 500 }
            );

            if (scrapedProduct) {
              const oldPrice = productStore.current_price;
              const newPrice = scrapedProduct.current_price;

              await this.productService.updateProductPrice(
                productId,
                storeId,
                newPrice,
                scrapedProduct.availability
              );

              if ((productStore.consecutive_failures ?? 0) > 0) {
                await supabase
                  .from('product_stores')
                  .update({ consecutive_failures: 0, last_error: null } as never)
                  .eq('id', productStoreId);
              }

              productsUpdated++;
              if (oldPrice !== newPrice) priceChanges++;

              const oldAvailability = productStore.availability;
              const newAvailability = scrapedProduct.availability;
              if (oldAvailability && oldAvailability !== 'in_stock' && newAvailability === 'in_stock') {
                const store = productStore.stores;
                this.notifyBackInStock(
                  supabase, productId, storeId, newPrice,
                  { name_ar: store.name_ar, name_en: store.name_en }
                ).catch((err) => console.error('Back-in-stock notification error:', err));
              }
            } else {
              await this.recordFailure(productStoreId, 'scraper returned null');
              errors++;
            }
          } catch (err) {
            console.error(`[${storeSlug}] price update failed for ${productUrl}:`, err);
            await this.recordFailure(
              productStoreId,
              err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500)
            );
            errors++;
          }

          const delay = minDelayMs + Math.floor(Math.random() * Math.max(0, maxDelayMs - minDelayMs));
          if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        storesUpdated++;
      }

      return {
        success: true,
        stores_updated: storesUpdated,
        products_updated: productsUpdated,
        price_changes: priceChanges,
        errors,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('runPriceUpdateJob failed:', error);
      return {
        success: false,
        stores_updated: 0,
        products_updated: 0,
        price_changes: 0,
        errors: 1,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private async recordFailure(productStoreId: string, errorMsg: string): Promise<void> {
    try {
      const supabase = createServerClient();
      const { data } = await supabase
        .from('product_stores')
        .select('consecutive_failures')
        .eq('id', productStoreId)
        .single();
      const current = (data as { consecutive_failures?: number } | null)?.consecutive_failures ?? 0;
      await supabase
        .from('product_stores')
        .update({
          consecutive_failures: current + 1,
          last_failed_at: new Date().toISOString(),
          last_error: errorMsg,
        } as never)
        .eq('id', productStoreId);
    } catch (err) {
      console.error('recordFailure threw:', err);
    }
  }

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
      case 'swsg':
        return new SwsgScraper();
      default:
        return null;
    }
  }

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

    for (const alert of alerts as unknown as BackInStockAlertRow[]) {
      const user = Array.isArray(alert.users) ? alert.users[0] : alert.users;
      const locale = (user?.locale || 'ar') as 'ar' | 'en';
      const numberLocale = locale === 'ar' ? 'ar-SA' : 'en-US';
      const priceText = Math.round(price).toLocaleString(numberLocale);
      const productName = locale === 'ar' ? product.name_ar : product.name_en;
      const storeName = locale === 'ar' ? store.name_ar : store.name_en;
      const productLink = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/products/${product.slug}`;

      createNotification({
        user_id: alert.user_id,
        type: 'back_in_stock',
        title_ar: `عاد للمخزون: ${product.name_ar}`,
        title_en: `Back in Stock: ${product.name_en}`,
        message_ar: `${product.name_ar} أصبح متوفراً الآن في ${store.name_ar} بسعر ${priceText} ر.س`,
        message_en: `${product.name_en} is now available at ${store.name_en} for ${priceText} SAR`,
        product_id: productId,
        store_id: storeId,
      }).catch((err) => console.error('Back-in-stock in-app notification error:', err));

      if (user?.email) {
        sendBackInStockEmail(user.email, {
          product_name: productName,
          price,
          store_name: storeName,
          product_link: productLink,
        }, locale).catch((err) => console.error('Back-in-stock email error:', err));
      }

      const pushTitle = locale === 'ar' ? `عاد للمخزون: ${productName}` : `Back in Stock: ${productName}`;
      const pushBody = locale === 'ar'
        ? `متوفر الآن في ${storeName} بسعر ${priceText} ر.س`
        : `Now available at ${storeName} for ${priceText} SAR`;

      sendPushToUser(alert.user_id, {
        title: pushTitle,
        body: pushBody,
        data: { type: 'back_in_stock', product_id: productId, product_slug: product.slug },
        channelId: 'price-alerts',
      }).catch((err) => console.error('Back-in-stock push error:', err));

      sendWebPushToUser(alert.user_id, {
        title: pushTitle,
        body: pushBody,
        data: { url: `/${locale}/products/${product.slug}`, type: 'back_in_stock', product_id: productId },
        dir: locale === 'ar' ? 'rtl' : 'ltr',
        lang: locale,
        tag: `back-in-stock-${productId}`,
      }).catch((err) => console.error('Back-in-stock web push error:', err));
    }

    createAuditLog({
      action: 'back_in_stock_alert_sent',
      entity_type: 'product',
      entity_id: productId,
      details: { store_id: storeId, price, users_notified: alerts.length },
    }).catch(() => {});
  }

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
