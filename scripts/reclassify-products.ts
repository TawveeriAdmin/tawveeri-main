/**
 * One-time re-classification of existing products using the title-based
 * classifier in `src/lib/scraping/utils/category-utils.ts`. Run this after
 * the classifier logic changes or to retroactively fix products whose
 * category was derived from a URL hint that mapped multiple real categories
 * (e.g. Jarir's `computers-tablets.html` for laptops AND tablets).
 *
 * Usage:
 *   npx tsx scripts/reclassify-products.ts
 *   RECLASSIFY_STORE=jarir npx tsx scripts/reclassify-products.ts
 *   RECLASSIFY_DRY_RUN=true npx tsx scripts/reclassify-products.ts
 *
 * Env:
 *   RECLASSIFY_STORE   — only touch products linked to this store slug
 *   RECLASSIFY_DRY_RUN — 'true' to print the plan without writing
 */

import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

// Keep batches small so .in('id', [...]) URLs stay well under 8 KB.
// 200 × 37-char UUIDs ≈ 7.4 KB before encoding.
const FETCH_BATCH = 200;
// Supabase's PostgREST default maxRows cap is 1000; we page below that.
const PAGE_SIZE = 1000;

async function retryAsync<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T | null> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const backoff = 500 * Math.pow(2, i - 1);
      console.warn(`  [retry ${i}/${attempts}] ${label} — ${err instanceof Error ? err.message : String(err)}, waiting ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  console.error(`  Gave up: ${label}`);
  console.error(lastErr);
  return null;
}

async function main() {
  const { createServerClient } = await import('../src/lib/database');
  const { classifyFromTitle } = await import('../src/lib/scraping/utils/category-utils');

  const supabase = createServerClient();
  const dryRun = process.env.RECLASSIFY_DRY_RUN === 'true';
  const storeSlug = process.env.RECLASSIFY_STORE?.trim() || null;

  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Scope: ${storeSlug ? `products linked to store '${storeSlug}'` : 'ALL products'}`);

  // --- Resolve product IDs in scope ---
  let scopedIds: string[] | null = null;
  if (storeSlug) {
    const { data: storeRow, error: storeErr } = await supabase
      .from('stores')
      .select('id')
      .eq('slug', storeSlug)
      .single();
    if (storeErr || !storeRow) {
      console.error(`Store '${storeSlug}' not found:`, storeErr?.message);
      process.exit(1);
    }
    const storeId = (storeRow as { id: string }).id;

    // Page through product_stores — PostgREST caps at 1000 rows per request.
    const idSet = new Set<string>();
    let offset = 0;
    while (true) {
      const page = await retryAsync(
        () =>
          supabase
            .from('product_stores')
            .select('product_id')
            .eq('store_id', storeId)
            .range(offset, offset + PAGE_SIZE - 1),
        `scope page offset=${offset}`,
      );
      if (!page) break;
      const rows = page.data as Array<{ product_id: string }> | null;
      if (!rows || rows.length === 0) break;
      for (const r of rows) idSet.add(r.product_id);
      process.stdout.write(`  resolved scope: ${idSet.size}\r`);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    scopedIds = Array.from(idSet);
    process.stdout.write('\n');
    console.log(`In scope: ${scopedIds.length} unique products`);
    if (scopedIds.length === 0) {
      console.log('Nothing to do.');
      return;
    }
  }

  // --- Scan and (optionally) update ---
  const transitions: Record<string, number> = {};
  let scanned = 0;
  let willChange = 0;

  async function processBatch(
    products: Array<{ id: string; category: string; name_en: string | null; name_ar: string | null }>,
  ) {
    scanned += products.length;
    for (const p of products) {
      const title = `${p.name_en || ''} ${p.name_ar || ''}`.trim();
      const classified = classifyFromTitle(title);
      if (!classified) continue;
      if (classified === p.category) continue;

      const key = `${p.category} → ${classified}`;
      transitions[key] = (transitions[key] || 0) + 1;
      willChange++;

      if (!dryRun) {
        await retryAsync(
          () => supabase.from('products').update({ category: classified } as never).eq('id', p.id),
          `update id=${p.id}`,
        );
      }
    }
  }

  if (scopedIds) {
    for (let i = 0; i < scopedIds.length; i += FETCH_BATCH) {
      const slice = scopedIds.slice(i, i + FETCH_BATCH);
      const page = await retryAsync(
        () => supabase.from('products').select('id, category, name_en, name_ar').in('id', slice),
        `fetch batch offset=${i}`,
      );
      if (!page) continue;
      const rows = (page.data as any[] | null) || [];
      await processBatch(rows);
      process.stdout.write(`  scanned ${scanned}/${scopedIds.length} | ${dryRun ? 'would' : 'did'} change ${willChange}\r`);
    }
  } else {
    let offset = 0;
    while (true) {
      const page = await retryAsync(
        () =>
          supabase
            .from('products')
            .select('id, category, name_en, name_ar')
            .order('id')
            .range(offset, offset + FETCH_BATCH - 1),
        `fetch offset=${offset}`,
      );
      if (!page) break;
      const rows = (page.data as any[] | null) || [];
      if (rows.length === 0) break;
      await processBatch(rows);
      process.stdout.write(`  scanned ${scanned} | ${dryRun ? 'would' : 'did'} change ${willChange}\r`);
      if (rows.length < FETCH_BATCH) break;
      offset += FETCH_BATCH;
    }
  }

  process.stdout.write('\n');
  console.log(`\n─ RECLASSIFICATION SUMMARY ${dryRun ? '(DRY RUN)' : ''} ─`);
  console.log(`  Scanned: ${scanned}`);
  console.log(`  ${dryRun ? 'Would reclassify' : 'Reclassified'}: ${willChange}`);
  const sorted = Object.entries(transitions).sort(([, a], [, b]) => b - a);
  if (sorted.length === 0) {
    console.log('  No transitions — titles agree with current categories.');
  } else {
    console.log('  Transitions:');
    for (const [k, v] of sorted) console.log(`    ${k.padEnd(40)} ${v}`);
  }

  if (dryRun) {
    console.log('\nRe-run without RECLASSIFY_DRY_RUN=true to apply.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
