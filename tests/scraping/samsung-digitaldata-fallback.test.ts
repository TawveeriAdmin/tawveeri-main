// Samsung KSA official-catalog closure mission (2026-09-12), founder requirement 19B: before
// classifying a Samsung PDP with no Product JSON-LD as "no price available", research the page
// architecture more deeply. Found: Samsung's server-rendered `digitalData` analytics layer
// reliably carries model_code/model_price for exactly these pages. Fragments below are the
// real, minified structure captured live from 3 different categories (field order/spacing
// preserved) — not synthetic.
import { extractDigitalDataFallback } from '../../src/lib/scraping/stores/samsung-ksa-scraper';

const VACUUM_URL = 'https://www.samsung.com/sa_en/vacuum-cleaners/stick/bespoke-jet-ai-stick-vc-with-powerfull-performance-white-vs25c9754qg-yl/';
const vacuumHtml = `
<script type="text/javascript">
digitalData.page.pageInfo.pageTrack = "product detail";
digitalData.product.model_code = "VS25C9754QG\\/YL".replace(/&/g, ' and ');
digitalData.product.displayName = "Bespoke Jet AI Stick VC with Powerfull Performance, 250W".replace(/(<([^>]+)>)/gi, "");
digitalData.product.model_name = "VS25C9754QG".replace(/&/g, ' and ');
digitalData.product.model_price = "3899";
digitalData.product.list_price = "";
</script>
<input type="hidden" id="anchorNavigationPriceBar" data-model-code="VS25C9754QG/YL" data-saleable="false"/>
`;

const MONITOR_URL = 'https://www.samsung.com/sa_en/monitors/gaming/odyssey-oled-g6-g60sd-27-inch-360hz-oled-qhd-ls27dg602smxue/';
const monitorHtml = `
<script type="text/javascript">
digitalData.product.model_code = "LS27DG602SMXUE".replace(/&/g, ' and ');
digitalData.product.displayName = "Odyssey OLED G6 Monitor".replace(/(<([^>]+)>)/gi, "");
digitalData.product.model_price = "3499";
</script>
<input type="hidden" data-saleable="false"/>
`;

const NO_PRICE_URL = 'https://www.samsung.com/sa_en/air-conditioners/wall-mount/ar5000hm-energy-saving-ar18trhqhwk-mg/';
const genuinelyNoPriceHtml = `
<script type="text/javascript">
digitalData.product.model_code = "AR18TRHQHWK\\/MG".replace(/&/g, ' and ');
digitalData.product.displayName = "Wall Mounted  AC Cooling Only 18K".replace(/(<([^>]+)>)/gi, "");
digitalData.product.model_price = "";
digitalData.product.list_price = "";
</script>
`;

describe('extractDigitalDataFallback — reads Samsung\'s own server-rendered analytics layer', () => {
  it('extracts a real price + model code + out_of_stock when data-saleable=false (vacuum)', () => {
    const p = extractDigitalDataFallback(vacuumHtml, VACUUM_URL);
    expect(p).not.toBeNull();
    expect(p!.current_price).toBe(3899);
    expect(p!.model).toBe('VS25C9754QG/YL'); // \/ unescaped correctly
    expect(p!.sku).toBe('VS25C9754QG/YL');
    expect(p!.availability).toBe('out_of_stock');
    expect(p!.brand).toBe('Samsung');
    expect(p!.name_en).toContain('Bespoke Jet AI Stick VC');
  });

  it('extracts a real price on a completely different category (monitor)', () => {
    const p = extractDigitalDataFallback(monitorHtml, MONITOR_URL);
    expect(p).not.toBeNull();
    expect(p!.current_price).toBe(3499);
    expect(p!.model).toBe('LS27DG602SMXUE');
  });

  it('NEVER fabricates a price: digitalData explicitly stating an empty price returns null, not a guess', () => {
    const p = extractDigitalDataFallback(genuinelyNoPriceHtml, NO_PRICE_URL);
    expect(p).toBeNull();
  });

  it('returns null (not a crash) when digitalData is entirely absent', () => {
    expect(extractDigitalDataFallback('<html><body>no analytics layer here</body></html>', VACUUM_URL)).toBeNull();
  });

  it('defaults to in_stock only when data-saleable is absent (never assumes false = safer default)', () => {
    const html = `<script>digitalData.product.model_code = "X1"; digitalData.product.displayName = "Test Product"; digitalData.product.model_price = "500";</script>`;
    const p = extractDigitalDataFallback(html, VACUUM_URL);
    expect(p!.availability).toBe('in_stock');
  });

  it('never returns a zero or negative price', () => {
    const html = `<script>digitalData.product.model_code = "X1"; digitalData.product.displayName = "Test"; digitalData.product.model_price = "0";</script>`;
    expect(extractDigitalDataFallback(html, VACUUM_URL)).toBeNull();
  });
});
