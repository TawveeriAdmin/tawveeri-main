import { BaseWooCommerceSearchScraper } from './base-woocommerce-search-scraper';
import { qenc } from './retail-search-url';

export class AlghanimSearchScraper extends BaseWooCommerceSearchScraper {
  constructor() {
    super({
      slug: 'alghanim',
      displayName: 'Alghanim',
      baseUrl: 'https://alghanim-store.com',
      searchUrlBuilders: [
        (q, p) => `https://alghanim-store.com/?s=${qenc(q)}&post_type=product${p > 1 ? `&paged=${p}` : ''}`,
        (q, p) => `https://alghanim-store.com/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
      ],
    });
  }
}
