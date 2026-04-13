import { BaseWooCommerceSearchScraper } from './base-woocommerce-search-scraper';
import { qenc } from './retail-search-url';

export class ZagzoogSearchScraper extends BaseWooCommerceSearchScraper {
  constructor() {
    super({
      slug: 'zagzoog',
      displayName: 'Zagzoog',
      baseUrl: 'https://zagzoog.com',
      searchUrlBuilders: [
        (q, p) => `https://zagzoog.com/arabic/products?s=${qenc(q)}${p > 1 ? `&page=${p}` : ''}`,
        (q, p) =>
          `https://zagzoog.com/arabic/products?s=all&search=${qenc(q)}${p > 1 ? `&p=${p}` : ''}`,
      ],
    });
  }
}
