import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  if (process.argv.includes('--fix-domain')) {
    const { data: updated, error: updErr } = await supabase
      .from('stores')
      .update({
        link: 'https://blackbox.com.sa',
        website_url: 'https://blackbox.com.sa',
        name_en: 'Black Box',
      })
      .eq('id', 10)
      .select('*')
      .maybeSingle();
    console.log('=== UPDATE RESULT ===');
    console.log(JSON.stringify(updated, null, 2));
    if (updErr) console.error(updErr);
    return;
  }

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('*')
    .eq('id', 10)
    .maybeSingle();
  console.log('=== store id 10 ===');
  console.log(JSON.stringify(store, null, 2));
  if (storeErr) console.error(storeErr);

  const { count: obsCount } = await supabase
    .from('raw_observations')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', 10);
  console.log('raw_observations for store 10:', obsCount);

  const { count: psCount } = await supabase
    .from('product_stores')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', 10);
  console.log('product_stores for store 10:', psCount);

  // list all stores for a fresh full picture
  const { data: allStores } = await supabase
    .from('stores')
    .select('id, name, slug, domain, is_active')
    .order('id');
  console.log('=== all stores ===');
  console.log(JSON.stringify(allStores, null, 2));

  // check for any promotion/campaign-like tables via information_schema (best-effort through PostgREST introspection isn't direct; try known candidate names)
  for (const t of ['promotions', 'campaigns', 'retailer_campaigns', 'bundle_offers', 'conditional_offers']) {
    const { error } = await supabase.from(t).select('*').limit(1);
    console.log(`table "${t}" exists:`, !error);
  }
}

main().catch(console.error);
