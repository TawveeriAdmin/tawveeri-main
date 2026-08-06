import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: norm, count } = await supabase
    .from('normalized_product_observations')
    .select('*', { count: 'exact' })
    .eq('store_id', '10');
  console.log('normalized_product_observations for store 10:', count);
  console.log(JSON.stringify(norm?.slice(0, 3), null, 2));

  const canonicalIds = [...new Set((norm ?? []).map((r: any) => r.canonical_product_id).filter(Boolean))];
  console.log('distinct canonical_product_ids referenced:', canonicalIds.length);

  if (canonicalIds.length) {
    const { data: canon } = await supabase
      .from('canonical_products')
      .select('id, tps_identity_key, category, brand, model')
      .in('id', canonicalIds);
    console.log('=== canonical products ===');
    for (const c of canon ?? []) console.log(JSON.stringify(c));

    // For each canonical, how many DISTINCT stores corroborate it (via normalized_product_observations)?
    const { data: allNormForThese } = await supabase
      .from('normalized_product_observations')
      .select('canonical_product_id, store_id')
      .in('canonical_product_id', canonicalIds);
    const byCanon: Record<string, Set<string>> = {};
    for (const r of allNormForThese ?? []) {
      const cid = String((r as any).canonical_product_id);
      byCanon[cid] = byCanon[cid] || new Set();
      byCanon[cid].add(String((r as any).store_id));
    }
    console.log('=== stores per canonical (blackbox comparisons) ===');
    for (const [cid, stores] of Object.entries(byCanon)) {
      console.log(cid, '-> stores:', [...stores].join(','), stores.size >= 2 ? '<<< COMPARABLE' : '(single-store)');
    }
  }

  const { count: projCount } = await supabase
    .from('tps_product_projection')
    .select('*', { count: 'exact', head: true })
    .in('canonical_product_id', canonicalIds.length ? canonicalIds : [-1]);
  console.log('tps_product_projection rows for these canonicals:', projCount);
}
main().catch(console.error);
