import { BaseWooCommerceSearchScraper } from './base-woocommerce-search-scraper';
import { qenc } from './retail-search-url';

export class AlesayiSearchScraper extends BaseWooCommerceSearchScraper {
  constructor() {
    super({
      slug: 'alesayi',
      displayName: 'Alesayi Electronics',
      baseUrl: 'https://aecksa.com',
      searchUrlBuilders: [
        (q, p) => `https://aecksa.com/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
      ],
    });
  }
}
