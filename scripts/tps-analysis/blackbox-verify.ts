import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { count } = await supabase
    .from('raw_observations')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', 10);
  console.log('raw_observations for store 10:', count);

  const { data: sample } = await supabase
    .from('raw_observations')
    .select('id, store_id, store_name, scraped_at, payload')
    .eq('store_id', 10)
    .limit(8);
  for (const row of sample ?? []) {
    const p = row.payload as Record<string, unknown>;
    console.log('---');
    console.log('id:', row.id, 'store_name:', row.store_name, 'scraped_at:', row.scraped_at);
    console.log('name_ar:', p.name_ar);
    console.log('sku:', p.sku, 'price:', p.current_price, 'original_price:', p.original_price, 'availability:', p.availability);
    console.log('url:', p.product_url);
    console.log('image:', (p.image_urls as string[])?.[0]);
    console.log('specifications:', JSON.stringify(p.specifications));
  }

  // Price-integrity spot check: any observation at or below the 5 SAR floor for this store?
  const { data: allPrices } = await supabase
    .from('raw_observations')
    .select('payload')
    .eq('store_id', 10)
    .limit(500);
  const prices = (allPrices ?? []).map((r) => (r.payload as Record<string, unknown>).current_price as number);
  const belowFloor = prices.filter((p) => p <= 5);
  console.log('=== PRICE INTEGRITY ===');
  console.log('total priced observations checked:', prices.length);
  console.log('min price:', Math.min(...prices), 'max price:', Math.max(...prices));
  console.log('observations at or below 5 SAR floor (must be 0):', belowFloor.length);

  // Confirm no wrong-domain leftovers
  const urls = (allPrices ?? []).map((r) => (r.payload as Record<string, unknown>).product_url as string);
  const wrongDomain = urls.filter((u) => u && u.includes('blackboxksa.com'));
  console.log('observations pointing at the WRONG domain blackboxksa.com (must be 0):', wrongDomain.length);
  console.log('all product_url on correct domain blackbox.com.sa:', urls.every((u) => u?.includes('blackbox.com.sa')));
}
main().catch(console.error);
