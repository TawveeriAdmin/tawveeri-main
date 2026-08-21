// Pre-write backup for the laptop-accessory dedup fix (founder-approved 2026-08-21):
// snapshot the two suspect canonical_products rows + their current tps_product_projection
// rows (if any) before flipping is_active. Read-only. Matches the established
// backups/latest_pre-*-fix_*_FULL.json convention from the vacuum/tablet/camera mission.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const IDS = [
  '800d664c-26d9-4aed-b115-d84d0d608596', // Lenovo GX41K08218 Laptop (active)
  '2364359b-1343-4051-adad-63a3477ba575', // 2b LF-01-6 Laptop (already inactive)
];
const KEYS = ['lenovo|MODEL:GX41K08218', '2b|MODEL:LF-01-6'];

(async () => {
  const { data: canon, error: e1 } = await supabase
    .from('canonical_products').select('*').in('id', IDS);
  if (e1) { console.error(e1); process.exit(1); }

  const { data: proj, error: e2 } = await supabase
    .from('tps_product_projection').select('*').in('tps_identity_key', KEYS);
  if (e2) { console.error(e2); process.exit(1); }

  fs.writeFileSync('backups/latest_pre-laptop-suspects-fix_canonical_products_FULL.json', JSON.stringify(canon, null, 2));
  fs.writeFileSync('backups/latest_pre-laptop-suspects-fix_tps_product_projection_FULL.json', JSON.stringify(proj, null, 2));

  console.log('canonical_products snapshot:');
  console.table(canon.map(c => ({ id: c.id, name_en: c.name_en, is_active: c.is_active, category: c.category })));
  console.log('tps_product_projection snapshot (before):');
  console.table(proj.map(p => ({ tps_identity_key: p.tps_identity_key, category: p.category, store_count: p.store_count, has_comparison: p.has_comparison, algolia_synced_at: p.algolia_synced_at })));
})();
