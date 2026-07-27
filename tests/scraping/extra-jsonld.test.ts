import { ExtraScraper } from '@/lib/scraping/stores/extra-scraper';

// Regression for the CONFIRMED Extra failure: Extra removed __NEXT_DATA__ and now blocks plain HTTP
// (anti-bot), so the per-product parser found nothing and ~290/300 updates failed (data froze at
// June 28). The fix reads the JS-rendered schema.org Product JSON-LD. This test feeds that JSON-LD
// through the real parse path (no network) and asserts the fields are extracted.
const PAD = 'x'.repeat(600); // exceed the >500-char guard that would trigger the plain-fetch fallback
const FIXTURE = `<!doctype html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","brand":{"@type":"Brand","name":"HAIER"},"sku":"100350560","mpn":"HRF-355NS","url":"https://www.extra.com/en-sa/large-appliances-/refrigerators/x/p/100350560","name":"Haier Refrigerator 8.7Cu.ft, Freezer 3Cu.ft, Twin Inverter, Silver","image":"https://media.extra.com/x.jpg","offers":{"@type":"Offer","priceCurrency":"SAR","price":"1749","itemCondition":"https://schema.org/NewCondition","availability":"https://schema.org/InStock"}}</script>
</head><body><!-- ${PAD} --></body></html>`;

describe('Extra scraper — JSON-LD product extraction (post __NEXT_DATA__ removal + anti-bot)', () => {
  it('extracts price/name/brand/sku/availability from schema.org Product JSON-LD', async () => {
    const s = new ExtraScraper();
    // Extra blocks plain fetch → the parser must read the JS-rendered page.
    (s as unknown as { fetchPageWithJS: () => Promise<string> }).fetchPageWithJS = async () => FIXTURE;
    (s as unknown as { fetchPage: () => Promise<string> }).fetchPage = async () => FIXTURE;

    const p = await (s as unknown as { updateProductPrice: (u: string) => Promise<Record<string, unknown> | null> })
      .updateProductPrice('https://www.extra.com/en-sa/p/100350560');

    expect(p).not.toBeNull();
    expect(p!.current_price).toBe(1749);
    expect(String(p!.name_ar)).toContain('Haier');
    expect(p!.brand).toBe('HAIER');
    expect(p!.availability).toBe('in_stock');
    expect(p!.sku).toBe('100350560');
  });

  it('returns null (does not fabricate) when JSON-LD carries no valid price', async () => {
    const noPrice = FIXTURE.replace('"price":"1749",', '');
    const s = new ExtraScraper();
    (s as unknown as { fetchPageWithJS: () => Promise<string> }).fetchPageWithJS = async () => noPrice;
    (s as unknown as { fetchPage: () => Promise<string> }).fetchPage = async () => noPrice;
    const p = await (s as unknown as { updateProductPrice: (u: string) => Promise<unknown> }).updateProductPrice('https://www.extra.com/en-sa/p/1');
    expect(p).toBeNull();
  });
});
