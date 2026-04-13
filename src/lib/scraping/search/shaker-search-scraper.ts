import { BaseWooCommerceSearchScraper } from './base-woocommerce-search-scraper';
import { qenc } from './retail-search-url';

export class ShakerSearchScraper extends BaseWooCommerceSearchScraper {
  constructor() {
    super({
      slug: 'shaker',
      displayName: 'Shaker',
      baseUrl: 'https://shakersa.com',
      searchUrlBuilders: [
        (q, p) => `https://shakersa.com/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
      ],
    });
  }
}
