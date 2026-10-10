// tests/scraping/amazon-search-fallback.test.ts — 2026-10-10: five of the last discovery runs found 0 / 0 / 0 / 15 / 0 Amazon tiles because the rotating desktop request is answered
// with HTTP 503 or a result-less challenge page from the datacenter egress. A page that fails or comes back without tiles is retried ONCE as mobile Safari.
import { AmazonSearchScraper } from '@/lib/scraping/search/amazon-search-scraper';

const TILE = (asin: string, title: string, price: string) => `<div data-component-type="s-search-result" data-asin="${asin}"><h2><a class="a-link-normal s-no-outline" href="/dp/${asin}"><span>${title}</span></a></h2><span class="a-price"><span class="a-offscreen">${price}</span></span></div>`;
const PAGE = (...tiles: string[]) => `<html><body>${tiles.join('')}</body></html>`;
const CHALLENGE = '<html><body><form action="/errors/validateCaptcha"><h4>Enter the characters you see below</h4></form></body></html>';

function scraperWith(responses: Array<string | Error>) {
  const sc = new AmazonSearchScraper();
  const calls: Array<Record<string, string> | undefined> = [];
  jest.spyOn(sc as unknown as { fetchHtml: (u: string, h?: Record<string, string>) => Promise<string> }, 'fetchHtml').mockImplementation(async (_u, h) => {
    calls.push(h);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next ?? '';
  });
  return { sc, calls };
}

describe('Amazon search page: second-chance mobile fetch', () => {
  const OLD = process.env.AMAZON_SEARCH_MOBILE_FALLBACK;
  afterEach(() => { if (OLD === undefined) delete process.env.AMAZON_SEARCH_MOBILE_FALLBACK; else process.env.AMAZON_SEARCH_MOBILE_FALLBACK = OLD; jest.restoreAllMocks(); });

  it('an HTTP 503 on the desktop request is recovered by the mobile request: tiles returned, no error', async () => {
    const { sc, calls } = scraperWith([new Error('HTTP 503 fetching https://www.amazon.sa/s?k=laptop'), PAGE(TILE('B0TESTAAA1', 'Lenovo IdeaPad Slim 3 Laptop 15.6 inch 16GB 512GB', 'SAR 1,899.00'))]);
    const r = await sc.search({ query: 'laptop', pages: 1 });
    expect(r.error).toBeUndefined();
    expect(r.count).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.['User-Agent']).toMatch(/iPhone/);
  });

  it('a challenge page (no result tiles) on the desktop request is recovered the same way', async () => {
    const { sc } = scraperWith([CHALLENGE, PAGE(TILE('B0TESTAAA2', 'Midea Split Air Conditioner 18000 BTU Cold Heat', 'SAR 1,599.00'))]);
    const r = await sc.search({ query: 'مكيف', pages: 1 });
    expect(r.error).toBeUndefined();
    expect(r.count).toBe(1);
  });

  it('when the mobile request fails too, the ORIGINAL failure is reported exactly as before', async () => {
    const { sc } = scraperWith([new Error('HTTP 503 fetching https://www.amazon.sa/s?k=x'), new Error('HTTP 503 fetching again')]);
    const r = await sc.search({ query: 'x', pages: 1 });
    expect(r.count).toBe(0);
    expect(r.error).toMatch(/503/);
  });

  it('a challenge page that stays a challenge page is still reported as unverified (never as «no results»)', async () => {
    const { sc } = scraperWith([CHALLENGE, CHALLENGE]);
    const r = await sc.search({ query: 'x', pages: 1 });
    expect(r.error).toMatch(/no result tiles; response could not be verified/);
  });

  it('a healthy desktop page is never retried', async () => {
    const { sc, calls } = scraperWith([PAGE(TILE('B0TESTAAA3', 'Samsung Galaxy Tab A9 Plus 11 inch 64GB', 'SAR 899.00'))]);
    const r = await sc.search({ query: 'tablet', pages: 1 });
    expect(r.count).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('AMAZON_SEARCH_MOBILE_FALLBACK=0 restores the single-attempt behaviour', async () => {
    process.env.AMAZON_SEARCH_MOBILE_FALLBACK = '0';
    const { sc, calls } = scraperWith([new Error('HTTP 503 fetching x'), PAGE(TILE('B0TESTAAA4', 'Anything', 'SAR 1.00'))]);
    const r = await sc.search({ query: 'x', pages: 1 });
    expect(calls).toHaveLength(1);
    expect(r.error).toMatch(/503/);
  });
});
