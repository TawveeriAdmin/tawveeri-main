import type { ScrapedProduct, ProductCategory } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';

/**
 * Extra store scraper
 * TODO: Implement store-specific logic similar to JarirScraper
 */
export class ExtraScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('extra'));
  }

  async discoverProducts(
    category: ProductCategory,
    maxPages?: number
  ): Promise<ScrapedProduct[]> {
    // TODO: Implement Extra-specific discovery logic
    throw new Error('ExtraScraper.discoverProducts not yet implemented');
  }

  async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null> {
    // TODO: Implement Extra-specific price update logic
    throw new Error('ExtraScraper.updateProductPrice not yet implemented');
  }
}






