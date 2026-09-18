import { AmazonScraper } from '../../src/lib/scraping/stores/amazon-scraper';
import { verifyTargetOffer } from '../../scripts/tps-analysis/close-amazon-iphone18-offer';
import { CATEGORY_DEFS } from '../../scripts/tps-core/category-registry';

const html = `<span id="productTitle">Apple iPhone 18 Pro 256 GB: – Silver</span>
<input name="ASIN" value="B0HJ9V43LX">
<div id="trade-in-price"><span class="a-offscreen">SAR2,000.00</span></div>
<div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">SAR5,699.00</span></span></div>
<div id="inline-twister-row-size_name">Size: 256GB Make a Size selection 1TB SAR8,699.00 256GB 512GB</div>
<div id="merchantInfoFeature_feature_div">Shipper / Seller Amazon.sa</div>
<div id="availability"><span>In Stock</span></div><input id="add-to-cart-button">`;
async function parse(source = html) {
  const scraper = new AmazonScraper();
  scraper.fetchPage = async () => source;
  return scraper.updateProductPrice('https://www.amazon.sa/dp/B0HJ9V43LX');
}
describe('single-ASIN iPhone 18 Pro closure', () => {
  it('uses the 256GB buybox price without subtracting trade-in or reading the 1TB choice price', async () => {
    const product = await parse();
    expect(product?.current_price).toBe(5699);
    expect(verifyTargetOffer(html, product).identity.key).toBe('apple|iPhone|18|Pro|256');
  });
  it('refuses a 1TB selection even if the title is stale', async () => {
    expect(() => verifyTargetOffer(html.replace('Size: 256GB', 'Size: 1TB'), null)).toThrow();
    const product = await parse();
    expect(() => verifyTargetOffer(html.replace('Size: 256GB', 'Size: 1TB'), product)).toThrow('variant');
    const def = CATEGORY_DEFS.mobile;
    const norm = def.normalize('', 'Apple iPhone 18 Pro 1TB Silver', 'Apple', {});
    expect(def.plugin.buildIdentityKey('Apple', norm.payload, { model_number: norm.model_number }).key).toBe('apple|iPhone|18|Pro|1024');
  });
  it('refuses another ASIN or Pro Max', async () => {
    const product = await parse();
    expect(() => verifyTargetOffer(html, { ...product!, sku: 'B0OTHERASIN' })).toThrow('variant');
    expect(() => verifyTargetOffer(html, { ...product!, name_en: 'Apple iPhone 18 Pro Max 256 GB' })).toThrow('variant');
  });
  it('refuses unproven third-party seller/fulfilment', async () => {
    expect(() => verifyTargetOffer(html.replace('Shipper / Seller Amazon.sa', 'Sold by Marketplace Vendor'), null)).toThrow();
    const product = await parse();
    expect(() => verifyTargetOffer(html.replace('Shipper / Seller Amazon.sa', 'Sold by Marketplace Vendor'), product)).toThrow('seller');
  });
  it('refuses unavailable or disabled purchase state', async () => {
    const product = await parse();
    expect(() => verifyTargetOffer(html.replace('In Stock', 'Currently unavailable'), product)).toThrow('availability');
    expect(() => verifyTargetOffer(html.replace('id="add-to-cart-button"', 'id="add-to-cart-button" disabled'), product)).toThrow('availability');
  });
  it('refuses changed prices instead of forcing the founder reference price', async () => {
    const product = await parse();
    expect(() => verifyTargetOffer(html, { ...product!, current_price: 8699 })).toThrow('Price changed');
  });
});
