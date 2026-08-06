import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Pull a few compare_url values for our 9 comparable canonicals, straight from prod.
  const { data: proj } = await supabase
    .from('tps_product_projection')
    .select('canonical_id, compare_url, cheapest_store, store_count')
    .in('canonical_id', [
      'fbf9238d-a6ee-43e7-a588-71440418794a', '5cc8ec25-d0ff-42ac-bf7a-1f9c1d38466f',
      '19b8971c-6f4d-4e41-8663-9eeee31a885d', 'a810282e-6078-43c5-ab62-1019bb49ce85',
    ]);
  console.log('=== compare_urls to live-check ===');
  for (const p of proj ?? []) console.log(JSON.stringify(p));
}
main().catch(console.error);
