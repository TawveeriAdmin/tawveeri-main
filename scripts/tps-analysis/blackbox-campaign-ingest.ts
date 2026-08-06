import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CAMPAIGN_URLS = [
  "https://www.blackbox.com.sa/product/ariston-built-in-electric-oven-90-cm-89-l-digital-display-steel-ms-644-ix-p-1318210817452011",
  "https://www.blackbox.com.sa/product/lg-washing-machine-front-load-15-kg-inverter-smart-control-steam-white-wfn-1510-p-1313211325841002",
  "https://www.blackbox.com.sa/product/lg-dryer-dual-condenser-10-kg-inverter-sensor-dry-silver-rh-10-v9-pv-2-p-1314111325540001",
  "https://www.blackbox.com.sa/product/lg-washing-machine-front-load-18-kg-10-kg-dryer-inverter-matte-black-wsn-1810-p-1313211326024001",
  "https://www.blackbox.com.sa/product/lg-front-load-washing-machine-21-kg-6-motion-dd-motor-75-dryer-black-wf-p-1313211326154001",
  "https://www.blackbox.com.sa/product/ariston-washing-machine-front-load-10-kg-inverter-15-programs-titanium-arwd-p-131321081554801",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-4-door-inverter-19.6-ft-557-l-water-dispenser-p-13111113182860001",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-4-door-insta-view-inverter-18.6-ft-527-l-white-p-1311111332760001",
  "https://www.blackbox.com.sa/product/lg-dishwasher-14-place-inverter-quad-wash-easy-rack-plus-turbo-cycle-korea-black-p-1315111320004002",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-door-in-door-inverter-instaview-27.3-ft-775-l-p-13111113183634001",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-express-freeze-inverter-27.2-ft-771-l-silver-lm-334-p-1311111333620001",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-2-door-multi-air-flow-inverter-23.2-ft-658-l-p-1311111333223002",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-2-door-inverter-compressor-22.1-ft-625-l-silver-ls-p-1311111333113002",
  "https://www.blackbox.com.sa/product/midea-refrigerator-top-freezer-2-door-inverter-electronic-control-18.3-ft-steel-p-1311111122732001",
  "https://www.blackbox.com.sa/product/midea-refrigerator-2-door-23-ft-inverter-electronic-control-steel-mdrt-866-fgf46-p-1311111123192001",
  "https://www.blackbox.com.sa/product/midea-upright-freezer-convertible-to-refrigerator-21-ft-steel-mdru-793-fgf-46-l-p-1312211133002002",
  "https://www.blackbox.com.sa/product/midea-upright-freezer-convertible-to-refrigerator-21-ft-steel-mdru-793-fgf-46-r-p-1312211133002003",
  "https://www.blackbox.com.sa/product/midea-front-loading-washing-machine-12-kg-100-dry-8-kg-inverter-titanium-mf-200-p-1313211115660001",
  "https://www.blackbox.com.sa/product/midea-front-loading-washing-machine-10-kg-14-program-inverter-white-mf-200-w100-p-1313211125541003",
  "https://www.blackbox.com.sa/product/midea-front-loading-washing-machine-12-kg-14-program-inverter-titanium-mf-200-p-1313211125660002",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-17.9-ft-509-l-inverter-silver-ls-19-gbbdi-p-1311111332690001",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-insta-view-door-in-door-inverter-21.7-ft-617-l-p-1311111333070002",
  "https://www.blackbox.com.sa/product/lg-wash-tower-front-load-25-kg-dryer-20-kg-inverter-central-control-korean-black-p-131321131300403",
  "https://www.blackbox.com.sa/product/lg-wash-tower-front-load-25-kg-dryer-20-kg-inverter-central-control-korean-beige-p-1313211313007001",
  "https://www.blackbox.com.sa/product/hisense-washing-machine-front-load-13-kg-partial-dryer-inverter-black-wf-3-s1343-p-1313280125724001",
  "https://www.blackbox.com.sa/product/ariston-built-in-gas-oven-90-cm-auto-ignition-grill-steel-mhg-521-ix-p-1318110817452007",
  "https://www.blackbox.com.sa/product/lg-upright-freezer-1-door-11.4-ft-smart-ice-maker-silver-lf-131-bbsit-p-1312211332040001",
  "https://www.blackbox.com.sa/product/lg-refrigerators-single-door-13.6-ft-386-l-inverter-silver-ld-141-bbsit-p-1311211312263001",
  "https://www.blackbox.com.sa/product/ariston-dishwasher-15-place-10-program-inverter-steel-lfo-3-p31-wlx-60-hz-p-1315110820002007",
  "https://www.blackbox.com.sa/product/lg-refrigerator-side-by-side-22.8-ft-647-l-inverter-silver-ls-25-cbbsiv-p-1311111333180001",
];

const UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) TawveeriBot/1.0";

async function main() {
  const dry = process.argv.includes('--dry');
  const { mapNextjsSsrProduct } = await import('../../src/lib/providers/sourcing/nextjs-ssr-adapter');

  const products = [];
  for (const url of CAMPAIGN_URLS) {
    const html = await fetch(url, { headers: { 'user-agent': UA } }).then((r) => (r.ok ? r.text() : null));
    if (!html) { console.log('FETCH FAILED', url); continue; }
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) { console.log('NO NEXT_DATA', url); continue; }
    const json = JSON.parse(m[1]);
    const props = json?.props?.pageProps?.displayedProductsRatings;
    if (!props) { console.log('NO PRODUCT DATA', url); continue; }
    const mapped = mapNextjsSsrProduct(props, url);
    if (!mapped) { console.log('MAPPING DROPPED', url); continue; }
    products.push(mapped);
  }

  console.log(`mapped ${products.length}/${CAMPAIGN_URLS.length} campaign products`);
  const withEligibility = products.filter((p: any) => p.specifications?.campaign_eligibility);
  console.log(`${withEligibility.length}/${products.length} carry campaign_eligibility evidence`);
  const withGifts = products.filter((p: any) => p.specifications?.free_gifts?.length);
  console.log(`${withGifts.length}/${products.length} carry free_gifts evidence`);

  if (dry) {
    console.log('--dry: nothing written.');
    return;
  }

  const { IngestionService } = await import('../../src/lib/scraping/services/ingestion-service');
  const result = await new IngestionService().ingestBatch('blackbox', products, 10, null);
  console.log('ingest result: saved', result, 'of', products.length);
}
main().catch(console.error);
