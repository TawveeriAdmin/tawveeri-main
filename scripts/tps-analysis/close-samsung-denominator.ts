// scripts/tps-analysis/close-samsung-denominator.ts
// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY, bounded, Samsung-only. Classifies every currently-missing official
// Samsung Saudi URL (no raw_observations row at all) and computes its TRUE
// manufacturer commercial identity using the SAME category plugins the live
// pipeline uses — so the denominator is built at commercial-identity level, not
// URL count, and cross-referenced against what's already canonicalized.
//
// No DB writes. No raw_observations insert. Pure classification + a read query
// against canonical_products to check whether the computed identity_key already
// exists (i.e. this URL is "just another color" of something already tracked).
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { CATEGORY_DEFS } from '../tps-core/category-registry';

const FAMILY_PAGE_TERMINALS = /^(connectivity|design|highlights|qled-technology|features|specs|specifications|gallery|reviews|accessories|technology)$/i;

interface Classified {
  url: string;
  bucket: string;
  title: string | null;
  modelCode: string | null;
  computedIdentityKey: string | null;
  computedCategory: string | null;
  identityStatus: string | null;
}

async function classifyOne(url: string): Promise<Classified> {
  const base: Classified = { url, bucket: 'UNKNOWN', title: null, modelCode: null, computedIdentityKey: null, computedCategory: null, identityStatus: null };
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) return { ...base, bucket: `HTTP_${res.status}` };
    const html = await res.text();
    const $ = cheerio.load(html);
    let hasProductLd = false, hasPrice = false, ldTitle: string | null = null;
    $('script[type="application/ld+json"]').each((_i, el) => {
      try {
        const j = JSON.parse($(el).html() || '{}');
        const nodes = Array.isArray(j['@graph']) ? j['@graph'] : [j];
        for (const n of nodes) {
          const isProduct = n['@type'] === 'Product' || (Array.isArray(n['@type']) && n['@type'].includes('Product'));
          if (isProduct) {
            hasProductLd = true;
            ldTitle = n.name ?? ldTitle;
            const price = n.offers?.price;
            if (price && Number(price) > 0) hasPrice = true;
          }
        }
      } catch { /* skip malformed block */ }
    });
    const modelCodeMatch = html.match(/id="modelCode"[^>]*value="([^"]+)"/i) ?? html.match(/data-model-code="([^"]+)"/i);
    const modelCode = modelCodeMatch ? modelCodeMatch[1] : null;
    const title = ldTitle ?? $('title').first().text().trim() ?? null;

    // Compute the TRUE commercial identity using the SAME plugins the live pipeline uses —
    // this is the whole point: a color-variant URL should collapse to the same identity_key
    // an already-canonicalized sibling color already has.
    let computedIdentityKey: string | null = null, computedCategory: string | null = null, identityStatus: string | null = null;
    if (title) {
      for (const def of Object.values(CATEGORY_DEFS)) {
        if (!def.plugin.detect('', title)) continue;
        const norm = def.normalize('', title, 'Samsung', {});
        const identity = def.plugin.buildIdentityKey('Samsung', norm.payload, { model_number: norm.model_number });
        if (identity.key) { computedIdentityKey = identity.key; computedCategory = def.category; identityStatus = identity.status; break; }
      }
    }

    let bucket: string;
    if (hasProductLd && hasPrice) bucket = 'HAS_PRODUCT_LD_HAS_PRICE_UNEXPECTED';
    else if (hasProductLd) bucket = 'HAS_PRODUCT_LD_NO_PRICE';
    else if (modelCode) bucket = 'NO_PRODUCT_LD_NEWER_TEMPLATE';
    else {
      const terminal = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
      bucket = FAMILY_PAGE_TERMINALS.test(terminal) ? 'NO_PRODUCT_LD_FAMILY_PAGE' : 'NO_PRODUCT_LD_UNKNOWN';
    }
    return { url, bucket, title, modelCode, computedIdentityKey, computedCategory, identityStatus };
  } catch (e) {
    return { ...base, bucket: `FETCH_ERROR: ${e instanceof Error ? e.message : String(e)}` };
  }
}

(async () => {
  const inputFile = process.argv[2];
  if (!inputFile) { console.error('Usage: close-samsung-denominator.ts <urls.json array file>'); process.exit(1); }
  const urls: string[] = JSON.parse(readFileSync(inputFile, 'utf8'));
  console.log(`Classifying ${urls.length} URLs (read-only, no DB writes, ~1.2s/URL pacing)...`);

  const results: Classified[] = [];
  for (let i = 0; i < urls.length; i++) {
    const r = await classifyOne(urls[i]);
    results.push(r);
    if ((i + 1) % 25 === 0 || i === urls.length - 1) console.log(`[${i + 1}/${urls.length}] latest: ${r.bucket} — ${r.url.slice(-60)}`);
    await new Promise((res) => setTimeout(res, 1200));
  }

  // Cross-reference computed identity keys against canonical_products (read-only).
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const keys = [...new Set(results.map((r) => r.computedIdentityKey).filter(Boolean))] as string[];
  const existingKeys = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await sb.from('canonical_products').select('tps_identity_key').in('tps_identity_key', keys.slice(i, i + 200));
    for (const row of data ?? []) existingKeys.add((row as { tps_identity_key: string }).tps_identity_key);
  }

  const bucketCounts: Record<string, number> = {};
  for (const r of results) bucketCounts[r.bucket] = (bucketCounts[r.bucket] || 0) + 1;
  console.log('\n=== BUCKET SUMMARY ===');
  console.table(bucketCounts);

  const distinctIdentities = new Set(results.map((r) => r.computedIdentityKey).filter(Boolean));
  const alreadyLinked = [...distinctIdentities].filter((k) => existingKeys.has(k as string));
  const genuinelyNew = [...distinctIdentities].filter((k) => !existingKeys.has(k as string));
  const noIdentityComputed = results.filter((r) => !r.computedIdentityKey);

  console.log('\n=== IDENTITY-LEVEL SUMMARY ===');
  console.log('Total URLs classified:                          ', results.length);
  console.log('Distinct TRUE commercial identities computed:   ', distinctIdentities.size);
  console.log('  ...already linked to an existing canonical:   ', alreadyLinked.length, '(just a color/variant of something already tracked)');
  console.log('  ...genuinely NEW, no canonical exists yet:    ', genuinelyNew.length);
  console.log('URLs where no identity could be computed at all:', noIdentityComputed.length, '(family pages, unsupported categories, or unparseable titles)');

  writeFileSync(inputFile.replace(/\.json$/, '-classified.json'), JSON.stringify({ results, alreadyLinked, genuinelyNew, bucketCounts }, null, 2));
  console.log('\nSaved full detail to', inputFile.replace(/\.json$/, '-classified.json'));
})();
