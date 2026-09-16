import { readFileSync, writeFileSync } from 'fs';
import * as cheerio from 'cheerio';
import { isSamsungKsaProductUrl, KNOWN_CONSUMER_CATEGORY_PATH, HIGH_VALUE_ACCESSORY_SLUG } from '../../src/lib/scraping/stores/samsung-ksa-scraper';

function productEvidence(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(productEvidence);
  if (!node || typeof node !== 'object') return [];
  if (node['@type'] === 'Product' || (Array.isArray(node['@type']) && node['@type'].includes('Product'))) {
    const { name, sku, mpn, brand, offers, image } = node;
    return [{ '@type': node['@type'], name, sku, mpn, brand, offers, image }];
  }
  return productEvidence(node['@graph']);
}

async function main() {
  const result: any = { measured_at: new Date().toISOString(), sitemaps: [], pages: [] };
  for (const name of ['im', 'da', 'vd', 'assorted']) {
    const url = `https://www.samsung.com/sa_en/${name}-sitemap.xml`;
    const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
    const xml = await r.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
    const byPath: Record<string, number> = {};
    for (const u of urls) { const p = new URL(u).pathname.split('/')[2]; byPath[p] = (byPath[p] || 0) + 1; }
    const admitted = urls.filter(u => isSamsungKsaProductUrl(u) && KNOWN_CONSUMER_CATEGORY_PATH.test(u) && (!/\/mobile-accessories\//i.test(u) || HIGH_VALUE_ACCESSORY_SLUG.test(u)));
    result.sitemaps.push({ url, status: r.status, url_count: urls.length, byPath, admitted_count: admitted.length, admitted });
  }
  const sample = JSON.parse(readFileSync('docs/evidence/samsung-coverage-before-2026-09-16.json', 'utf8')).queries.sample.rows;
  for (const row of sample) {
    const r = await fetch(row.url, { signal: AbortSignal.timeout(45000) });
    const html = await r.text(); const $ = cheerio.load(html);
    const jsonLd = $('script[type="application/ld+json"]').map((_, e) => $(e).text()).get().flatMap(s => { try { return productEvidence(JSON.parse(s)); } catch { return []; } });
    result.pages.push({ url: row.url, status: r.status, final_url: r.url, measured_at: new Date().toISOString(), jsonLd, og_image: $('meta[property="og:image"]').attr('content'), digital_price: html.match(/digitalData\.product\.model_price\s*=\s*"([^"]*)"/)?.[1], saleable: [...html.matchAll(/data-saleable="([^"]*)"/g)].map(m => m[1]), price_markup: $('[data-modelprice], [data-model-price], .pdd-price').map((_, e) => $(e).text().trim()).get().slice(0, 5) });
    writeFileSync('docs/evidence/samsung-source-probes-2026-09-16.json', JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify({ sitemaps: result.sitemaps.map((s: any) => ({ name: s.url, count: s.url_count, admitted: s.admitted_count, byPath: s.byPath })), pages: result.pages.length }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
