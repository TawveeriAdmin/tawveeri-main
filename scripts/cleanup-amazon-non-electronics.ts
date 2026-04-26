/**
 * Purge non-electronics rows for Amazon that leaked in through broad search
 * pages before the electronics gate was wired into the Amazon scraper.
 *
 * Dry-run by default:
 *   npx tsx scripts/cleanup-amazon-non-electronics.ts
 *
 * Apply deletes:
 *   APPLY=true npx tsx scripts/cleanup-amazon-non-electronics.ts
 */

import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

type AmazonProductStoreRow = {
  id: string;
  product_id: string;
  product_url: string | null;
  products: {
    id: string;
    name_en: string | null;
    name_ar: string | null;
    brand: string | null;
    category: string | null;
  };
};

const AMAZON_BLOCKED_TERMS = [
  'fridge magnet',
  'refrigerator magnet',
  'refrigerator sticker',
  'acrylic refrigerator',
  'coaster',
  'coasters',
  'lemon juicer',
  'citrus juicer',
  'manual juicer',
  'toast tongs',
  'toaster tongs',
  'cooking tongs',
  'kitchen tongs',
  'kitchen utensil',
  'bowl clip',
  'plate lifter',
  'rice spoon',
  'rice paddle',
  'napkin holder',
  'tissue holder',
  'food storage',
  'fridge organizer',
  'refrigerator organizer',
  'egg holder',
  'shelf liner',
  'drawer liner',
  'spice rack',
  'lazy susan',
  'fruit and vegetable',
  'vegetable washing',
  'rice washing',
  'dishwasher magnet',
  'flower sticker',
  'animal sticker',
  'cat sticker',
  'kitten',
  'ملصقات ثلاجة',
  'ملصقات للثلاجة',
  'مغناطيس ثلاجة',
  'عصارة ليمون',
  'ملعقة أرز',
  'ملعقة الرز',
  'مناشف',
  'للثلاجة',
] as const;

function isBlockedAmazonNonElectronics(row: AmazonProductStoreRow): boolean {
  const product = row.products;
  const text = `${product.name_en || ''} ${product.name_ar || ''}`.toLowerCase();
  return AMAZON_BLOCKED_TERMS.some((term) => text.includes(term));
}

async function retryQuery<T>(label: string, run: () => Promise<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  let lastMessage = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const { data, error } = await run();
      if (!error) return data;
      lastMessage = error.message;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
    }

    const delayMs = attempt * 1500;
    console.warn(`${label} failed (attempt ${attempt}/4): ${lastMessage}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`${label} failed after retries: ${lastMessage}`);
}

async function main(): Promise<void> {
  const apply = (process.env.APPLY || 'false').toLowerCase() === 'true';
  const databaseModule = await import('../src/lib/database/supabase.ts');
  const database = databaseModule.default || databaseModule['module.exports'] || databaseModule;
  const supabase = database.createServerClient();

  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', 'amazon')
    .single();

  if (storeErr || !storeRow) {
    console.error(`Could not resolve amazon store: ${storeErr?.message || 'not found'}`);
    process.exit(1);
  }

  const amazonStoreId = (storeRow as { id: string }).id;
  const bad: Array<{ product_store_id: string; product_id: string; name: string; category: string | null }> = [];
  let good = 0;
  let scanned = 0;
  let lastSeenId = '';
  const batchSize = 500;

  console.log(`${apply ? 'APPLY' : 'DRY-RUN'} - scanning Amazon products...`);

  while (true) {
    const data = await retryQuery(`fetch rows after ${lastSeenId || 'start'}`, () => {
      let query = supabase
        .from('product_stores')
        .select('id, product_id, product_url, products!inner(id, name_en, name_ar, brand, category)')
        .eq('store_id', amazonStoreId)
        .order('id', { ascending: true })
        .limit(batchSize);

      if (lastSeenId) {
        query = query.gt('id', lastSeenId);
      }

      return query;
    });
    if (!data || data.length === 0) break;

    for (const row of data as unknown as AmazonProductStoreRow[]) {
      scanned++;
      const product = row.products;
      const name = product.name_en || product.name_ar || '';
      const keep = !isBlockedAmazonNonElectronics(row);

      if (keep) {
        good++;
      } else {
        bad.push({
          product_store_id: row.id,
          product_id: row.product_id,
          name,
          category: product.category,
        });
      }
    }

    lastSeenId = (data[data.length - 1] as AmazonProductStoreRow).id;
    if (scanned % 5000 === 0) {
      console.log(`  scanned ${scanned} rows... keep=${good} drop=${bad.length}`);
    }
    if (data.length < batchSize) break;
  }

  console.log(`scanned: ${scanned}`);
  console.log(`keep: ${good}`);
  console.log(`drop: ${bad.length}`);

  if (bad.length > 0) {
    console.log('\nsample rows to drop:');
    for (const row of bad.slice(0, 30)) {
      console.log(`  [${row.category || 'uncategorized'}] ${row.name.slice(0, 110)}`);
    }
    if (bad.length > 30) console.log(`  ... and ${bad.length - 30} more`);
  }

  if (!apply) {
    console.log('\nDRY-RUN - no changes made. Set APPLY=true to delete these rows.');
    return;
  }

  if (bad.length === 0) {
    console.log('nothing to delete - Amazon rows are clean.');
    return;
  }

  console.log('\ndeleting non-electronics Amazon product_stores rows...');
  const psIds = bad.map((row) => row.product_store_id);
  const deletedProductIds: string[] = [];
  let productStoresDeleted = 0;
  for (let i = 0; i < psIds.length; i += 100) {
    const batch = psIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from('product_stores')
      .delete()
      .in('id', batch)
      .select('id, product_id');
    if (error) {
      console.error(`  product_stores batch ${i}: ${error.message}`);
      continue;
    }
    productStoresDeleted += data?.length ?? 0;
    for (const row of data || []) {
      deletedProductIds.push((row as { product_id: string }).product_id);
    }
  }

  console.log('deleting orphaned products...');
  const touchedProductIds = [...new Set(deletedProductIds)];
  let orphanDeleted = 0;
  for (let i = 0; i < touchedProductIds.length; i += 100) {
    const batch = touchedProductIds.slice(i, i + 100);
    const { data: stillLinked } = await supabase
      .from('product_stores')
      .select('product_id')
      .in('product_id', batch);

    const stillLinkedIds = new Set((stillLinked || []).map((row) => (row as { product_id: string }).product_id));
    const orphans = batch.filter((id) => !stillLinkedIds.has(id));
    if (orphans.length === 0) continue;

    const { error } = await supabase.from('products').delete().in('id', orphans);
    if (error) {
      console.error(`  orphan batch ${i}: ${error.message}`);
    } else {
      orphanDeleted += orphans.length;
    }
  }

  console.log(`deleted product_stores rows: ${productStoresDeleted}`);
  console.log(`deleted orphan products: ${orphanDeleted}`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
