import { BaseWooCommerceSearchScraper } from './base-woocommerce-search-scraper';
import { qenc } from './retail-search-url';

export class AlkhunaizanSearchScraper extends BaseWooCommerceSearchScraper {
  constructor() {
    super({
      slug: 'alkhunaizan',
      displayName: 'Alkhunaizan',
      baseUrl: 'https://www.alkhunaizan.sa',
      searchUrlBuilders: [
        (q, p) => `https://www.alkhunaizan.sa/?s=${qenc(q)}${p > 1 ? `&paged=${p}` : ''}`,
      ],
    });
  }
}
