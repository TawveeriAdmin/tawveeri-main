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
