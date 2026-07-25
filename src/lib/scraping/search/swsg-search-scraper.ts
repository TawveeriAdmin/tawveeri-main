import { BaseWooCommerceSearchScraper } from './base-woocommerce-search-scraper';
import { qenc } from './retail-search-url';

export class SwsgSearchScraper extends BaseWooCommerceSearchScraper {
  constructor() {
    super({
      slug: 'swsg',
      displayName: 'SWSG',
      baseUrl: 'https://swsg.co',
      // swsg.co runs MAGENTO, not WordPress/WooCommerce. The old WordPress `?s=`
      // builders silently returned the HOMEPAGE for every query (Magento ignores `?s=`),
      // so a search for "iphone" yielded the same 68 featured appliances — polluting
      // every customer search with irrelevant results. Magento search lives at
      // /catalogsearch/result/?q=… with `&p=` pagination (verified: `?q=iphone` returns
      // real iphone results, the WordPress form did not).
      searchUrlBuilders: [
        (q, p) => `https://swsg.co/catalogsearch/result/?q=${qenc(q)}${p > 1 ? `&p=${p}` : ''}`,
        (q, p) => `https://swsg.co/ar/catalogsearch/result/?q=${qenc(q)}${p > 1 ? `&p=${p}` : ''}`,
      ],
    });
  }
}
