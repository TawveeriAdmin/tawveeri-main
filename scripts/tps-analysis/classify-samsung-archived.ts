// Samsung KSA official-catalog closure mission (2026-09-12) — READ-ONLY classification pass.
// Runs independently of scripts/seed-samsung-ksa-sitemap.ts (no DB writes, no shared state) so
// it can run concurrently without touching the live recovery per the founder's explicit
// "do not interrupt" instruction.
//
// Distinguishes, for every URL the recovery logged as "archive (no price)" or "failed", which
// of these it actually is:
//   NO_PRODUCT_LD_FAMILY_PAGE   — no Product JSON-LD AND the terminal segment looks like a
//                                  navigational/feature sub-page (matches a family-page slug
//                                  pattern) — contamination, not a real candidate.
//   NO_PRODUCT_LD_NEWER_TEMPLATE — no Product JSON-LD but has a `#modelCode` input (Samsung's
//                                  newer client-rendered template — vacuum-cleaners/movable-
//                                  screens class) — a real product, price unavailable without JS.
//   HAS_PRODUCT_LD_NO_PRICE     — Product JSON-LD present, offers.price missing/zero — a real,
//                                  currently-unpriced/unavailable listing.
//   NO_PRODUCT_LD_UNKNOWN       — no Product JSON-LD, no modelCode, no family-page signal —
//                                  genuinely ambiguous, reported as UNKNOWN, not guessed at.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';

const FAMILY_PAGE_TERMINALS = /^(connectivity|design|highlights|qled-technology|features|specs|specifications|gallery|reviews|accessories|technology)$/i;

async function classifyOne(url: string): Promise<{ url: string; bucket: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) return { url, bucket: `HTTP_${res.status}` };
    const html = await res.text();
    const $ = cheerio.load(html);
    let hasProductLd = false;
    let hasPrice = false;
    $('script[type="application/ld+json"]').each((_i, el) => {
      try {
        const j = JSON.parse($(el).html() || '{}');
        const nodes = Array.isArray(j['@graph']) ? j['@graph'] : [j];
        for (const n of nodes) {
          const isProduct = n['@type'] === 'Product' || (Array.isArray(n['@type']) && n['@type'].includes('Product'));
          if (isProduct) {
            hasProductLd = true;
            const price = n.offers?.price;
            if (price && Number(price) > 0) hasPrice = true;
          }
        }
      } catch { /* skip malformed block */ }
    });
    if (hasProductLd && hasPrice) return { url, bucket: 'HAS_PRODUCT_LD_HAS_PRICE_UNEXPECTED' };
    if (hasProductLd) return { url, bucket: 'HAS_PRODUCT_LD_NO_PRICE' };
    const hasModelCodeInput = /id="modelCode"/i.test(html);
    if (hasModelCodeInput) return { url, bucket: 'NO_PRODUCT_LD_NEWER_TEMPLATE' };
    const terminal = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    if (FAMILY_PAGE_TERMINALS.test(terminal)) return { url, bucket: 'NO_PRODUCT_LD_FAMILY_PAGE' };
    return { url, bucket: 'NO_PRODUCT_LD_UNKNOWN' };
  } catch (e) {
    return { url, bucket: `FETCH_ERROR: ${e instanceof Error ? e.message : String(e)}` };
  }
}

(async () => {
  const inputFile = process.argv[2];
  if (!inputFile) { console.error('Usage: classify-samsung-archived.ts <urls-file, one per line>'); process.exit(1); }
  const urls = readFileSync(inputFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`Classifying ${urls.length} URLs (read-only, no DB writes)...`);
  const results: { url: string; bucket: string }[] = [];
  for (let i = 0; i < urls.length; i++) {
    const r = await classifyOne(urls[i]);
    results.push(r);
    console.log(`[${i + 1}/${urls.length}] ${r.bucket} — ${r.url.slice(-70)}`);
    await new Promise((res) => setTimeout(res, 1200)); // polite, independent rate limit
  }
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.bucket] = (counts[r.bucket] || 0) + 1;
  console.log('\n=== CLASSIFICATION SUMMARY ===');
  console.table(counts);
  writeFileSync(inputFile.replace(/\.txt$/, '-classified.json'), JSON.stringify(results, null, 2));
})();
