import { BaseWooCommerceSearchScraper } from './base-woocommerce-search-scraper';
import { qenc } from './retail-search-url';

export class BukhamsenSearchScraper extends BaseWooCommerceSearchScraper {
  constructor() {
    super({
      slug: 'bukhamsen',
      displayName: 'Bukhamsen',
      baseUrl: 'https://bukhamsen.com',
      searchUrlBuilders: [
        (q, p) => `https://bukhamsen.com/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
      ],
    });
  }
}
