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
