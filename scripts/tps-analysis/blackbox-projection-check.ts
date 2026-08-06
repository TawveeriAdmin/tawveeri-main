import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Inspect the projection table schema shape via one row
  const { data: sampleProj, error: e1 } = await supabase.from('tps_product_projection').select('*').limit(1);
  console.log('sample tps_product_projection row keys:', sampleProj?.[0] ? Object.keys(sampleProj[0]) : sampleProj, e1);

  const canonicalIds = [
    'fbf9238d-a6ee-43e7-a588-71440418794a', '6a24d326-efd4-49b8-b246-e0c1aaf88070',
    'f59ded03-348d-41bd-991e-990a4ce459a2', '5cc8ec25-d0ff-42ac-bf7a-1f9c1d38466f',
    '19b8971c-6f4d-4e41-8663-9eeee31a885d', 'd62dd498-f6d9-43b5-b98a-b27a27370e2e',
    '0abf88f9-13e3-48c3-8b7e-1df496d9e230', '4b1c3e4c-72a0-4101-b93c-f7da50c98e14',
    'edd8790c-9133-44f2-8eba-56ed6ab315af', 'a810282e-6078-43c5-ab62-1019bb49ce85',
  ];
  const { data: proj, error: e2, count } = await supabase
    .from('tps_product_projection')
    .select('id, canonical_product_id, has_comparison, store_count', { count: 'exact' })
    .in('canonical_product_id', canonicalIds);
  console.log('projection rows for our 9 comparable canonicals:', count, e2);
  console.log(JSON.stringify(proj, null, 2));

  // price_history for one of these canonicals — does it carry a blackbox row yet?
  const { data: canon } = await supabase.from('canonical_products').select('id, tps_identity_key').in('id', canonicalIds).limit(3);
  console.log('canonical sample:', JSON.stringify(canon));
}
main().catch(console.error);
