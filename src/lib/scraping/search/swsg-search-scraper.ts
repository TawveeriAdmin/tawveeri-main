import { BaseWooCommerceSearchScraper } from './base-woocommerce-search-scraper';
import { qenc } from './retail-search-url';

export class SwsgSearchScraper extends BaseWooCommerceSearchScraper {
  constructor() {
    super({
      slug: 'swsg',
      displayName: 'SWSG',
      baseUrl: 'https://swsg.co',
      searchUrlBuilders: [
        (q, p) => `https://swsg.co/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
        (q, p) => `https://swsg.co/ar/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
      ],
    });
  }
}
