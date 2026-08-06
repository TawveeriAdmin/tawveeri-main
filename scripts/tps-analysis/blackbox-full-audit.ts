import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: rows, count } = await supabase
    .from('raw_observations')
    .select('id, payload, scraped_at', { count: 'exact' })
    .eq('store_id', 10)
    .order('id');
  console.log('TOTAL raw_observations for store 10:', count);

  const payloads = (rows ?? []).map((r) => r.payload as Record<string, unknown>);
  const withGifts = payloads.filter((p) => {
    const specs = p.specifications as Record<string, unknown> | undefined;
    return specs?.free_gifts && (specs.free_gifts as unknown[]).length > 0;
  });
  console.log('observations WITH free_gifts:', withGifts.length);
  for (const p of withGifts) {
    console.log('---');
    console.log('sku:', p.sku, 'name:', p.name_ar, 'price:', p.current_price, 'url:', p.product_url);
    console.log('free_gifts:', JSON.stringify(p.specifications));
  }

  const prices = payloads.map((p) => p.current_price as number);
  const availIn = payloads.filter((p) => p.availability === 'in_stock').length;
  const availOut = payloads.filter((p) => p.availability === 'out_of_stock').length;
  console.log('=== SUMMARY ===');
  console.log('in_stock:', availIn, 'out_of_stock:', availOut);
  console.log('price min/max:', Math.min(...prices), Math.max(...prices));
  console.log('below/at 5 SAR floor:', prices.filter((p) => p <= 5).length);

  // Category breakdown by URL keyword (rough)
  const cats = { refrigerator: 0, 'washing-machine': 0, dishwasher: 0, 'air-conditioner': 0, split: 0, television: 0, laptop: 0, mobile: 0, other: 0 };
  for (const p of payloads) {
    const url = String(p.product_url || '').toLowerCase();
    let matched = false;
    for (const k of Object.keys(cats)) {
      if (k !== 'other' && url.includes(k)) { (cats as Record<string, number>)[k]++; matched = true; break; }
    }
    if (!matched) cats.other++;
  }
  console.log('category breakdown (by URL keyword):', JSON.stringify(cats, null, 2));

  // Check existing product_stores / canonical linkage for store 10
  const { count: psCount } = await supabase
    .from('product_stores')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', 10);
  console.log('product_stores rows for store 10:', psCount);

  const { count: normCount } = await supabase
    .from('normalized_product_observations')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', '10');
  console.log('normalized_product_observations (store_id text "10"):', normCount);

  const { data: cursor } = await supabase
    .from('tps_progress_cursors')
    .select('*')
    .eq('store_id', 10)
    .maybeSingle();
  console.log('tps_progress_cursors for store 10:', JSON.stringify(cursor));
}
main().catch(console.error);
