/**
 * Purge non-electronics rows for Jarir (books, gift cards, toys, etc.)
 * that got in before the electronics filter was added to the scraper.
 *
 * Strategy: for every Jarir product_stores row, test the linked product's
 * name against `classifyFromTitle` (same gate as the scraper now applies).
 * If the title doesn't classify AND doesn't match a legitimate keyword,
 * the product_stores row is deleted. Products with no remaining
 * product_stores after the delete are dropped too (no other store carries
 * them, so the product itself is orphaned).
 *
 * Dry-run by default — pass `APPLY=true` to actually delete.
 *
 * Usage:
 *   npx tsx scripts/cleanup-jarir-non-electronics.ts          # dry run
 *   APPLY=true npx tsx scripts/cleanup-jarir-non-electronics.ts
 */

import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

async function main(): Promise<void> {
  const APPLY = (process.env.APPLY || 'false').toLowerCase() === 'true';

  const { createServerClient } = await import('../src/lib/database');
  const supabase = createServerClient();

  // Keep in sync with `JARIR_NON_ELECTRONICS_TOKENS` in
  // `src/lib/scraping/stores/jarir-scraper.ts`. Reject a title only when
  // one of these tokens appears; everything else is treated as
  // electronics because Jarir's configured URLs are already curated to
  // electronics sections.
  const BLOCKED_TOKENS = [
    'gift card', 'gift code', 'e-voucher', ' voucher', 'recharge card',
    'playstation store', 'free fire', 'roblox', 'xbox gift', 'pubg uc',
    'garena', 'steam wallet', 'google play gift', 'apple gift',
    ' ebook', ' e-book', 'audio book', 'audio-book', 'audiobook', ' novel',
    'كتاب', 'رواية', 'مذكرات', 'قصة', 'ديوان', 'سيرة ذاتية',
    'school bag', 'stationery', 'pencil set', 'musical instrument',
  ];
  const isElectronics = (title: string): boolean => {
    if (!title) return false;
    const t = title.toLowerCase();
    if (BLOCKED_TOKENS.some((kw) => t.includes(kw))) return false;
    return true;
  };

  const { data: storeRow, error: storeErr } = await supabase
    .from('stores').select('id').eq('slug', 'jarir').single();
  if (storeErr || !storeRow) {
    console.error('Could not resolve jarir store');
    process.exit(1);
  }
  const jarirStoreId = (storeRow as { id: string }).id;

  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — scanning Jarir products…`);

  // Fetch all Jarir product_stores rows + linked product.name_en
  // Paginate because Supabase caps a single select at ~1000 rows.
  const BATCH = 1000;
  let from = 0;
  const bad: Array<{ product_store_id: string; product_id: string; name: string }> = [];
  const good: string[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('product_stores')
      .select('id, product_id, products!inner(id, name_en, name_ar)')
      .eq('store_id', jarirStoreId)
      .range(from, from + BATCH - 1);
    if (error) {
      console.error('fetch error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data as unknown as Array<{
      id: string;
      product_id: string;
      products: { id: string; name_en: string | null; name_ar: string | null };
    }>) {
      const name = row.products.name_en || row.products.name_ar || '';
      if (isElectronics(name)) {
        good.push(row.id);
      } else {
        bad.push({ product_store_id: row.id, product_id: row.product_id, name });
      }
    }
    if (data.length < BATCH) break;
    from += BATCH;
  }

  console.log(`scanned ${good.length + bad.length} Jarir rows`);
  console.log(`  keep: ${good.length} electronics`);
  console.log(`  drop: ${bad.length} non-electronics`);

  if (bad.length === 0) {
    console.log('nothing to delete — DB is clean.');
    return;
  }

  // Show a sample of titles being dropped so we can eyeball them.
  console.log('\nsample of rows to drop:');
  for (const row of bad.slice(0, 20)) {
    console.log(`  ${row.name.slice(0, 80)}`);
  }
  if (bad.length > 20) console.log(`  … and ${bad.length - 20} more`);

  if (!APPLY) {
    console.log('\nDRY-RUN — no changes made. Set APPLY=true to actually delete.');
    return;
  }

  // Delete product_stores rows in batches of 100 (Supabase .in() is safer small).
  console.log('\ndeleting non-electronics product_stores rows…');
  const psIds = bad.map((b) => b.product_store_id);
  for (let i = 0; i < psIds.length; i += 100) {
    const batch = psIds.slice(i, i + 100);
    const { error } = await supabase.from('product_stores').delete().in('id', batch);
    if (error) console.error(`  batch ${i}: ${error.message}`);
  }

  // Find orphaned products — those with NO product_stores rows after the delete.
  const touchedProductIds = [...new Set(bad.map((b) => b.product_id))];
  let orphanDeleted = 0;
  for (let i = 0; i < touchedProductIds.length; i += 100) {
    const batch = touchedProductIds.slice(i, i + 100);
    // Pull which products still have product_stores
    const { data: stillLinked } = await supabase
      .from('product_stores')
      .select('product_id')
      .in('product_id', batch);
    const stillLinkedIds = new Set((stillLinked || []).map((r) => (r as { product_id: string }).product_id));
    const orphans = batch.filter((id) => !stillLinkedIds.has(id));
    if (orphans.length > 0) {
      const { error } = await supabase.from('products').delete().in('id', orphans);
      if (error) console.error(`  orphans batch ${i}: ${error.message}`);
      else orphanDeleted += orphans.length;
    }
  }

  console.log(`✓ deleted ${psIds.length} jarir product_stores rows`);
  console.log(`✓ deleted ${orphanDeleted} orphan products (no other store carried them)`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
