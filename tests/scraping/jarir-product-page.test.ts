/**
 * ADR-197 — jarir product-page parsing reads schema.org JSON-LD first.
 *
 * The config's `product_price` selector (`.product-tile__price`) is a category-TILE
 * class. On a PRODUCT page it matches nothing — measured 2026-08-03 on two live pages
 * (Galaxy S26 Ultra 684917, Z Flip7 renewed 670028): `updateProductPrice` returned
 * null while the page carried a full Product JSON-LD offer. Worse, when a "related
 * products" strip renders tiles, the selector can match a DIFFERENT product's price.
 * Structured data must win; the selector path stays as fallback.
 */
import { JarirScraper } from '../../src/lib/scraping/stores/jarir-scraper';

// Minimal product page shaped like the live one: JSON-LD Product with an offer,
// NO product-tile price for the product itself, and a related-products tile
// carrying a DIFFERENT product's price as a decoy.
const PRODUCT_PAGE = `
<html><head>
<script type="application/ld+json" id="metatags">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "Jarir Bookstore"
    },
    {
      "@type": "Product",
      "name": "Samsung Galaxy S26 Ultra 5G Smartphone 256GB",
      "sku": "684917",
      "offers": {
        "@type": "Offer",
        "url": "https://www.jarir.com/sa-en/samsung-galaxy-s26-ultra-smartphones-684917.html",
        "priceCurrency": "SAR",
        "price": "6099.00",
        "availability": "https://schema.org/InStock",
        "priceValidUntil": "2026-08-04"
      }
    }
  ]
}
</script>
</head><body>
  <div class="product-view"><h1>Samsung Galaxy S26 Ultra</h1></div>
  <div class="related">
    <div class="product-tile">
      <span class="product-tile__price">SR 219</span>
    </div>
  </div>
</body></html>`;

const NO_LD_PAGE = `
<html><body>
  <div class="product-title__title">Some Product</div>
  <span class="product-tile__price">SR 1,234</span>
</body></html>`;

describe('ADR-197: jarir product page parses JSON-LD first', () => {
  const scraper = new JarirScraper() as unknown as {
    parseProductPage(html: string, url: string): { current_price: number; availability: string; sku: string | null } | null;
  };
  const url = 'https://www.jarir.com/sa-en/samsung-galaxy-s26-ultra-smartphones-684917.html';

  it('reads the offer from JSON-LD — the decoy related-tile price never wins', () => {
    const p = scraper.parseProductPage(PRODUCT_PAGE, url);
    expect(p).not.toBeNull();
    expect(p!.current_price).toBe(6099);
    expect(p!.availability).toBe('in_stock');
    expect(p!.sku).toBe('684917');
  });

  it('falls back to the selector path when no JSON-LD exists', () => {
    const p = scraper.parseProductPage(NO_LD_PAGE, url);
    expect(p).not.toBeNull();
    expect(p!.current_price).toBe(1234);
  });

  it('OutOfStock availability maps honestly', () => {
    const page = PRODUCT_PAGE.replace('schema.org/InStock', 'schema.org/OutOfStock');
    const p = scraper.parseProductPage(page, url);
    expect(p!.availability).toBe('out_of_stock');
  });
});
