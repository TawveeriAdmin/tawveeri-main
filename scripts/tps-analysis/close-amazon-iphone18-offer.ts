/** One verified ASIN only. Dry by default; existing parsers and realization gates.
 * No discovery cursor, matching rule, ranking or other product is changed. */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { load } from 'cheerio';
import { writeFileSync } from 'fs';
import { AmazonScraper } from '../../src/lib/scraping/stores/amazon-scraper';
import type { ScrapedProduct } from '../../src/lib/scraping/base/types';
import { CATEGORY_DEFS } from '../tps-core/category-registry';
import { corroboratePass } from '../tps-core/progressive-engine';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
import { deriveProjection } from '../build-tps-projection';
import { PICK_FRESHNESS_MAX_HOURS } from '../../src/lib/intelligence/evidence-engine';
const ASIN = 'B0HJ9V43LX';
const URL = `https://www.amazon.sa/dp/${ASIN}`;
const KEY = 'apple|iPhone|18|Pro|256';

export function verifyTargetOffer(html: string, product: ScrapedProduct | null) {
  const $ = load(html); $('script,style').remove();
  const text = (selector: string) => $(selector).text().replace(/\s+/g, ' ').trim();
  const merchant = text('#merchantInfoFeature_feature_div');
  const size = text('#inline-twister-row-size_name') || text('#variation_size_name');
  if (!product || product.sku !== ASIN || $('input[name="ASIN"]').attr('value') !== ASIN
    || !/^Apple iPhone 18 Pro 256\s*GB\b/i.test(product.name_en || '') || /Pro Max/i.test(product.name_en || '')
    || !/^Size:\s*256\s*GB\b/i.test(size)) throw new Error('Exact 256GB commercial variant not proven');
  if (!/^Shipper\s*\/\s*Seller\s+Amazon\.sa\b/i.test(merchant)) throw new Error('Amazon direct seller/fulfilment not proven');
  if (!/^In Stock\b/i.test(text('#availability')) || product.availability !== 'in_stock'
    || !$('#add-to-cart-button').length || $('#add-to-cart-button').attr('disabled') !== undefined) throw new Error('Purchase availability not proven');
  if (product.current_price !== 5699) throw new Error('Price changed from the verified 5699 SAR; revalidate instead of forcing a price');
  const def = CATEGORY_DEFS.mobile;
  const norm = def.normalize(product.name_ar, product.name_en || '', product.brand || '', product as any);
  const identity = def.plugin.buildIdentityKey(product.brand || '', norm.payload, { model_number: norm.model_number });
  if (identity.status !== 'valid' || identity.key !== KEY) throw new Error(`Existing identity rules did not qualify: ${JSON.stringify(identity)}`);
  return { merchant, size, availability: text('#availability'), norm, identity };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const scraper = new AmazonScraper();
  const html = await scraper.fetchPage(URL);
  // The unchanged production parser consumes the same freshly captured document.
  scraper.fetchPage = async () => html;
  const product = await scraper.updateProductPrice(URL);
  const proof = verifyTargetOffer(html, product);
  const p = product!;
  const observedAt = new Date().toISOString();
  const evidence: any = { observedAt, apply, asin: ASIN, identity: KEY, source: {
    url: URL, title: p.name_en, currentPrice: p.current_price, originalPrice: p.original_price,
    merchant: proof.merchant, selectedSize: proof.size, availability: p.availability,
    tradeInApplied: false, method: 'Unmodified Amazon PDP price parser; base buybox price only' }, proof };
  const output = `scratchpad/amazon-iphone18-${apply ? 'apply' : 'dry'}.json`;
  const save = () => writeFileSync(output, JSON.stringify(evidence, null, 2));
  save();
  const { Client } = await import('pg');
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await pg.connect();
  try {
    if (apply && !(await pg.query('select pg_try_advisory_lock($1) ok', [8148148])).rows[0].ok) throw new Error('Normalizer writer lane busy');
    const canonical = (await pg.query('select * from canonical_products where tps_identity_key=$1', [KEY])).rows[0];
    if (!canonical?.is_active) throw new Error('Existing active canonical required');
    const current = (await pg.query('select * from tps_current_offers where category=$1 and identity_key=$2', ['mobile', KEY])).rows;
    if (!current.some(r => r.store_id === 5 && r.status === 'valid') || current.some(r => ![2,5].includes(r.store_id))) throw new Error('Unexpected target comparison scope');
    evidence.before = { canonical, current, projection: (await pg.query('select * from tps_product_projection where canonical_id=$1', [canonical.id])).rows,
      normalized: (await pg.query('select * from normalized_product_observations where canonical_product_id=$1', [canonical.id])).rows };
    evidence.sourceAsinObservationsBefore = (await pg.query("select id,scraped_at,raw_name from raw_observations where store_id=2 and payload->>'sku'=$1 order by id desc limit 5", [ASIN])).rows;
    save();
    if (!apply) { console.log(JSON.stringify({ apply, source: evidence.source, identity: proof.identity, currentStores: current.map(r=>r.store_id), existingRaw: evidence.sourceAsinObservationsBefore.length })); return; }
    if (current.some(r => r.store_id === 2)) throw new Error('Amazon offer already exists; inspect instead of replaying');
    const { IngestionService } = await import('../../src/lib/scraping/services/ingestion-service');
    if (await new IngestionService().ingestBatch('amazon', [p], 2, null) !== 1) throw new Error('Single raw ingestion failed');
    const raw = (await pg.query("select * from raw_observations where store_id=2 and payload->>'sku'=$1 and scraped_at >= $2 order by id desc limit 1", [ASIN, observedAt])).rows[0];
    if (!raw) throw new Error('Written raw observation missing');
    evidence.rawId = raw.id; save();
    const def = CATEGORY_DEFS.mobile;
    const confidence = def.plugin.scoreConfidence(p.brand || '', proof.norm.payload, proof.norm.model_number, proof.norm.ambiguity_flags);
    const staged = { category: 'mobile', raw_obs_id: Number(raw.id), store_id: 2, identity_key: proof.identity.key,
      status: proof.identity.status, price: p.current_price, url: p.product_url, name: p.name_en || p.name_ar,
      confidence: confidence.confidence, detected: true, payload: { ...proof.norm.payload, _availability: p.availability,
        ...(p.image_urls?.[0] ? { _image: p.image_urls[0] } : {}), ...(p.original_price != null ? { _original_price: p.original_price } : {}) }, observed_at: raw.scraped_at };
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const stagedResult = await sb.from('tps_identity_staging').upsert(staged, { onConflict: 'category,raw_obs_id' });
    if (stagedResult.error) throw stagedResult.error;
    evidence.realization = await corroboratePass(sb, def, [KEY], { sweepRows: [staged] }); save();
    const after = (await pg.query('select * from canonical_products where tps_identity_key=$1', [KEY])).rows[0];
    if (after.id !== canonical.id) throw new Error('Canonical identity changed unexpectedly');
    // This target has only two current-state offers. Refuse any evidence conflict;
    // use the normal pure projection derivation, never a handcrafted display price.
    const offers = (await pg.query(`select o.*,case o.store_id when 2 then 'أمازون' when 5 then 'المنيع' end store_name
      from tps_current_offers o where o.category='mobile' and o.identity_key=$1`, [KEY])).rows;
    const signals = (await pg.query(`select store_display_name from tps_offer_delist_signals where canonical_product_id=$1
      union all select store_display_name from tps_price_implausibility_signals where canonical_product_id=$1`, [canonical.id])).rows;
    if (signals.length || offers.length !== 2 || offers.some(r => ![2,5].includes(r.store_id) || r.status !== 'valid' || !(Number(r.price)>0)
      || !['in_stock','limited_stock','pre_order'].includes(r.payload?._availability))) throw new Error('Existing offer eligibility signals require review');
    const projection = deriveProjection({ ...after, canonical_id: after.id,
      stores: offers.map(r=>r.store_name), prices: offers.map(r=>String(r.price)),
      fresh: offers.map(r=>Date.now()-Date.parse(r.observed_at)<=PICK_FRESHNESS_MAX_HOURS*3600000),
      last_observed_at: new Date(Math.max(...offers.map(r=>Date.parse(r.observed_at)))).toISOString() });
    const update = await sb.from('tps_product_projection').upsert({ ...projection, updated_at: new Date().toISOString() }, { onConflict: 'tps_identity_key' });
    if (update.error) throw update.error;
    evidence.after = { canonicalId: after.id, offers, projection };
    evidence.completedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ output, rawId: raw.id, metrics: evidence.realization, projection }));
  } catch(error) { evidence.error = String(error); save(); throw error; }
  finally { await pg.end(); await scraper.cleanup(); }
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/close-amazon-iphone18-offer.ts')) main().catch(e=>{console.error(e);process.exitCode=1;});
