/**
 * ADR-204 — Amazon product-page price extraction is buybox-scoped only.
 *
 * Measured on a live PDP variant (B0FQCLJXPN): with no buybox present, the old global
 * `.a-price .a-offscreen` selector's first match sat inside `sims-simsContainer` — the
 * "similar items" carousel — recording a 1,609-SAR split AC at another product's 59.99
 * and overflowing the projection chain (ADR-200). These fixtures pin the three behaviours:
 * carousel prices never win, the buybox does, and no-buybox yields an honest null.
 */
import { AmazonScraper } from '../../src/lib/scraping/stores/amazon-scraper';

const scraper = new AmazonScraper() as unknown as {
  scrapeProductPage(url: string): Promise<{ current_price: number; original_price: number | null } | null>;
  fetchPage(url: string): Promise<string>;
};

const URL = 'https://www.amazon.sa/dp/B0TESTTEST';

const SIMS_ONLY_PAGE = `
<html><body id="a-page"><div id="dp"><div id="dp-container">
  <span id="productTitle"> MIDEA Cold Only Wall Split Air Conditioner 12000 Units </span>
  <div id="sims-simsContainer_feature_div_0">
    <div class="a-price"><span class="a-offscreen">SAR59.99</span></div>
    <div class="a-price"><span class="a-offscreen">SAR219.00</span></div>
  </div>
</div></div></body></html>`;

const BUYBOX_PAGE = `
<html><body id="a-page"><div id="dp"><div id="dp-container">
  <span id="productTitle"> MIDEA Cold Only Wall Split Air Conditioner 12000 Units </span>
  <div id="sims-simsContainer_feature_div_0">
    <div class="a-price"><span class="a-offscreen">SAR59.99</span></div>
  </div>
  <div id="centerCol">
    <div id="corePrice_feature_div"><span class="a-offscreen">SAR1,609.00</span></div>
    <div class="a-price a-text-price"><span class="a-offscreen">SAR1,999.00</span></div>
  </div>
</div></div></body></html>`;

function withPage(html: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scraper as any).fetchPage = async () => html;
}

describe('ADR-204: buybox-scoped price extraction', () => {
  it('also refuses an ASIN switch on the mobile unqualified-offer fallback', async () => {
    let requests = 0;
    scraper.fetchPage = async () => ++requests === 1
      ? '<span id="productTitle">Apple iPhone 18 Pro 256GB</span><input name="ASIN" value="B0HJ9ZYZQR">'
      : '<input name="ASIN" value="B0HJB3HBM8"><div id="unqualifiedBuyBox"><span class="a-price"><span class="a-offscreen">SAR8,699.00</span></span></div>';
    expect(await scraper.scrapeProductPage('https://www.amazon.sa/dp/B0HJ9ZYZQR')).toBeNull();
    expect(requests).toBe(2);
  });
  it('does not write a redirected phone capacity under the requested ASIN', async () => {
    withPage('<span id="productTitle">Apple iPhone 18 Pro 1 TB</span><input name="ASIN" value="B0HJB3HBM8"><div id="corePrice_feature_div"><span class="a-offscreen">SAR8,699.00</span></div>');
    expect(await scraper.scrapeProductPage('https://www.amazon.sa/dp/B0HJ9ZYZQR')).toBeNull();
    expect((await scraper.scrapeProductPage('https://www.amazon.sa/dp/B0HJB3HBM8'))?.current_price).toBe(8699);
  });

  it('does not mark the requested phone unavailable when another ASIN is selected', async () => {
    withPage('<span id="productTitle">Apple iPhone 18 Pro 1 TB</span><input name="ASIN" value="B0HJB3HBM8"><div id="outOfStock">Currently unavailable</div>');
    expect(await scraper.scrapeProductPage('https://www.amazon.sa/dp/B0HJ9ZYZQR')).toBeNull();
  });
  it('a page whose only prices are in the sims carousel yields NULL, never a price', async () => {
    withPage(SIMS_ONLY_PAGE);
    const p = await scraper.scrapeProductPage(URL);
    expect(p).toBeNull();
  });

  it('the buybox price wins even when a carousel decoy appears earlier in the DOM', async () => {
    withPage(BUYBOX_PAGE);
    const p = await scraper.scrapeProductPage(URL);
    expect(p).not.toBeNull();
    expect(p!.current_price).toBe(1609);
    expect(p!.original_price).toBe(1999);
  });
});

describe('ADR-408: the ASIN guard covers every category, not only phones', () => {
  const page = (title: string, selected: string, tail = '<div id="corePrice_feature_div"><span class="a-offscreen">SAR17,485.67</span></div>') =>
    `<span id="productTitle">${title}</span><input name="ASIN" value="${selected}">${tail}`;
  it.each([
    ['laptop', 'Apple 2024 MacBook Pro (16-inch, Apple M4 Max chip with 16-core CPU and 40-core GPU) 48GB 1TB'],
    ['tv', 'Samsung 75 Inch Crystal UHD TV, U8000F, 4K'],
    ['tablet', 'Apple iPad Air 11-inch (M2) 1TB Wi-Fi + Cellular'],
    ['refrigerator', 'Haier Side by Side Refrigerator 11.1Cu.ft'],
  ])('%s: a page that selected another ASIN yields null, never that variant\'s price under the requested ASIN', async (_c, title) => {
    withPage(page(title, 'B0DLHG1PK8'));
    expect(await scraper.scrapeProductPage('https://www.amazon.sa/dp/B0DLJF6B54')).toBeNull();
  });
  it('the same page read under its own ASIN is returned with its price (the guard only rejects a mismatch)', async () => {
    withPage(page('Apple 2024 MacBook Pro (16-inch, Apple M4 Max chip with 16-core CPU and 40-core GPU) 48GB 1TB', 'B0DLHG1PK8'));
    expect((await scraper.scrapeProductPage('https://www.amazon.sa/dp/B0DLHG1PK8'))?.current_price).toBe(17485.67);
  });
  it('a page that selected another ASIN is not reported «unavailable» for the requested one either', async () => {
    withPage(page('Canon EOS 2000D Reflex 24.1 MP', 'B07B9R7K3G', '<div id="outOfStock">Currently unavailable</div>'));
    expect(await scraper.scrapeProductPage('https://www.amazon.sa/dp/B07B39M2MJ')).toBeNull();
  });
  it('a page with no selected-ASIN input is not treated as a conflict', async () => {
    withPage('<span id="productTitle">Samsung 65 Inch Neo QLED TV, QN1EF, 4K</span><div id="corePrice_feature_div"><span class="a-offscreen">SAR2,749.00</span></div>');
    expect((await scraper.scrapeProductPage('https://www.amazon.sa/dp/B0F8VXRFYT'))?.current_price).toBe(2749);
  });
});
