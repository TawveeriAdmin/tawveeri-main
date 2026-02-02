import type { ScrapedProduct, ProductCategory } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';

/**
 * Noon store scraper
 * TODO: Implement store-specific logic similar to JarirScraper
 */
export class NoonScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('noon'));
  }

  async discoverProducts(
    category: ProductCategory,
    maxPages?: number
  ): Promise<ScrapedProduct[]> {
    // TODO: Implement Noon-specific discovery logic
    throw new Error('NoonScraper.discoverProducts not yet implemented');
  }

  async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null> {
    // TODO: Implement Noon-specific price update logic
    throw new Error('NoonScraper.updateProductPrice not yet implemented');
  }
}





