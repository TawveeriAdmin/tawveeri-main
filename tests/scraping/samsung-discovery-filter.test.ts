// tests/scraping/samsung-discovery-filter.test.ts
// Samsung KSA Phase 0 hardening (2026-09-13, ADR-356). PROVEN LIVE DEFECT: the discovery
// filter (`isSamsungKsaProductUrl`) only ever checked the TERMINAL path segment against its
// non-product slug list. Samsung's real buying-guide/editorial content is shaped
// `/sa_en/<real-category>/<buying-guide-marker>/<article-slug>/` — e.g.
// `/sa_en/home-appliances/buying-guide/dishwashers/` — where the TERMINAL segment
// ("dishwashers") looks exactly like a real product word, but an earlier segment names the
// page as editorial. Confirmed live: 34 such URLs in the current Samsung KSA sitemap, all
// admitted before this fix (both by the shape check and by `KNOWN_CONSUMER_CATEGORY_PATH`,
// since the path also legitimately contains "/dishwashers/"). Also excludes `commercial-tvs`
// (hotel/hospitality B2B, out of the consumer mission) from the discovery allowlist entirely,
// rather than relying on a later classification pass to catch it every time.
import { isSamsungKsaProductUrl, KNOWN_CONSUMER_CATEGORY_PATH } from '../../src/lib/scraping/stores/samsung-ksa-scraper';

const admitted = (url: string) => isSamsungKsaProductUrl(url) && KNOWN_CONSUMER_CATEGORY_PATH.test(url);

describe('Samsung KSA discovery filter — path-segment-aware, not terminal-only', () => {
  it.each([
    ['https://www.samsung.com/sa_en/home-appliances/buying-guide/dishwashers/', 'terminal segment looks like a real category word'],
    ['https://www.samsung.com/sa_en/home-appliances/buying-guide/refrigerator-buying-guide/', 'nested buying-guide'],
    ['https://www.samsung.com/sa_en/monitors/monitor-buying-guide/best-monitor-size/', 'category-suffixed buying-guide marker'],
    ['https://www.samsung.com/sa_en/tvs/tv-buying-guide/what-is-oled-tv/', 'tv-buying-guide, terminal mentions a real TV term'],
    ['https://www.samsung.com/sa_en/home-appliances/learn/refrigerators/', 'learn/ editorial marker, terminal is a real category word'],
  ])('rejects buying-guide/editorial URL: %s (%s)', (url) => {
    expect(admitted(url)).toBe(false);
  });

  it.each([
    ['https://www.samsung.com/sa_en/commercial-tvs/hotel-tv/hau8000-uhd-4k-43-inch-hg43au800auxue/', 'hospitality/hotel TV, B2B'],
  ])('rejects B2B/commercial URL: %s (%s)', (url) => {
    expect(admitted(url)).toBe(false);
  });

  it.each([
    'https://www.samsung.com/sa_en/smartphones/galaxy-s/galaxy-s25-ultra-256gb-sm-s938bzkgmea/',
    'https://www.samsung.com/sa_en/monitors/gaming/odyssey-oled-g6-g60sd-27-inch-360hz-oled-qhd-ls27dg602smxue/',
    'https://www.samsung.com/sa_en/washers-and-dryers/washing-machines/wt4200jm-12kg-white-wt12j4230mb-yl/',
    'https://www.samsung.com/sa_en/tvs/qled-tv/q7f-65-inch-qled-4k-smart-tv-qa65q7faauxsa/',
    'https://www.samsung.com/sa_en/dishwashers/freestanding/dw60a8050fs-14-place-settings-phantom-black-dw60a8050fs-yl/',
  ])('still admits a genuine product PDP: %s', (url) => {
    expect(admitted(url)).toBe(true);
  });
});

// New-Model Delta Watch final verification (2026-09-14). PROVEN LIVE: assorted-sitemap.xml
// (482 URLs, previously never fetched by the delta watch) contains exactly ONE real
// consumer product — Samsung's "Moving Style" movable-screen line — that exists in NO
// other sitemap. Excluding assorted entirely was a genuine, provable future-product blind
// spot (this exact product was the historical example that first surfaced it). The other
// 481 URLs (care-pack service subscriptions, news articles, shop-faq, sustainability pages)
// must continue to be rejected — this is not a broad ingestion source.
describe('Samsung KSA discovery filter — assorted-sitemap.xml candidates (movable-screens)', () => {
  it('admits the one real product line found in assorted-sitemap.xml', () => {
    expect(admitted('https://www.samsung.com/sa_en/movable-screens/the-movingstyle/lsm7f-27-inch-ua27lsm7faxxsa/')).toBe(true);
  });
  it.each([
    ['https://www.samsung.com/sa_en/care-pack/smartphones-care-pack/galaxy-s24-screen-repair-p-gt-lcxos1hw/', 'care-pack service subscription, not a product'],
    ['https://www.samsung.com/sa_en/news/local/samsung-galaxy-z-fold7-raising-the-bar-for-smartphones/', 'news article'],
    ['https://www.samsung.com/sa_en/shop-faq/payment-and-financing/can-i-pay-in-installments/', 'shop FAQ'],
  ])('still rejects assorted-sitemap non-product noise: %s (%s)', (url) => {
    expect(admitted(url)).toBe(false);
  });

  // Two of the 482 assorted-sitemap URLs pass the path filter today independent of this
  // fix ('/offer/tvs/pre-order/' contains a real "/tvs/" segment; the sustainability page
  // sits under '/home-appliances/') — a small, pre-existing, disclosed imprecision, not
  // something this fix introduces or is required to close. Both are genuinely non-product
  // landing pages with no Product JSON-LD, so the delta watch's own real-PDP validation
  // step (never trusting the path filter alone) correctly resolves them to INVALID/UNKNOWN
  // on first sight, at which point the baseline remembers them and they are never
  // re-validated again — the one-time cost stays bounded, nothing is silently fabricated.
});
