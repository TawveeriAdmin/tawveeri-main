// scripts/tps-analysis/reclassify-firecrawl-accessories.ts — ADR-387 data remediation.
//
// discover-firecrawl/route.ts stamped every adapter-uncategorized product as 'accessories'
// (fixed at the source in the same ADR). This re-runs the SAME shared classifier
// (`classifyFromTitle` — the high-confidence form of `determineCategory`, src/lib/scraping/utils/category-utils.ts — the one every scraper
// uses) over the rows that default created, and moves ONLY the rows where the classifier
// finds a real category. Rows the classifier still calls 'accessories' are left untouched.
//
//   npx tsx scripts/tps-analysis/reclassify-firecrawl-accessories.ts            # dry run (default)
//   npx tsx scripts/tps-analysis/reclassify-firecrawl-accessories.ts --apply    # write, with export
//
// Bounded and reversible: the before-state of every changed row is exported to
// docs/evidence/compare-freshness-2026-09-26/reclassify-*.json and the rollback SQL is
// printed. Reads/writes `products.category` only (a text column). Never touches
// canonical_products, price_history, or any identity row.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// `pg` ships no types in this repo's toolchain; the other analysis scripts require() it too.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (o: { connectionString: string; ssl: { rejectUnauthorized: boolean } }) => { connect(): Promise<void>; end(): Promise<void>; query<T = Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> } };
import { writeFileSync, mkdirSync } from 'fs';
import { classifyFromTitle } from '../../src/lib/scraping/utils/category-utils';

const APPLY = process.argv.includes('--apply');
const SINCE = '2026-09-07'; // the day the discover-firecrawl slug fix unblocked product creation
const OUT_DIR = 'docs/evidence/compare-freshness-2026-09-26';

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('SUPABASE_DB_URL missing');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query<{ id: string; name_en: string; name_ar: string; brand: string; category: string }>(
    `select id, name_en, name_ar, brand, category from products where category='accessories' and is_active and created_at >= $1 order by created_at`,
    [SINCE],
  );
  const changes: { id: string; name: string; from: string; to: string }[] = [];
  const byTarget: Record<string, number> = {};
  // Arabic accessory vocabulary the shared classifier's English-leaning guard misses (dry run
  // 2026-09-26 surfaced «لوحة مفاتيح تابلت …» → tablet). An accessory stays an accessory.
  // Second dry-run sample (25 random) still showed 4 accessories slipping through (a tempered-
  // glass pack → smartphone, a watch bumper → smartwatch, a recliner with a "laptop table" →
  // laptop): the guard below is deliberately WIDE — precision over recall, a row this script
  // leaves as 'accessories' costs nothing, a row it mislabels becomes a false category claim.
  const AR_ACCESSORY = /لوحة مفاتيح|كفر|غطاء|حامل|شاحن|كيبل|كابل|سوار|حافظة|واقي|لاصق|قلم|محول|زجاج|حماية|طقم|مقعد|كرسي|طاولة|شنطة|حقيبة|ستاند|keyboard|\bcase\b|\bcases\b|\bcover\b|charger|charging|cable|\bstand\b|\bmount\b|\bstrap\b|\bband\b|protector|protection|adapter|\bdock\b|holder|sleeve|\bbag\b|stylus|tempered|\bglass\b|bumper|recliner|\btable\b|\bchair\b|\bdesk\b|\bskin\b|\bfilm\b|\bpcs\b|\bpack\b|\bkit\b|remote control|\bremote\b|battery pack|power ?bank|screen guard|lens|filter|cleaner|\bpad\b|\bmat\b|hub\b|splitter|extension|bracket|wall ?mount|tripod|\bgrip\b|\bring\b|lanyard|pouch|wallet|\bstickers?\b/i;
  for (const r of rows) {
    const title = r.name_en || r.name_ar || '';
    if (AR_ACCESSORY.test(title)) continue;
    const to = classifyFromTitle(title);
    if (to && to !== 'accessories') {
      changes.push({ id: r.id, name: (r.name_en || r.name_ar).slice(0, 90), from: r.category, to });
      byTarget[to] = (byTarget[to] ?? 0) + 1;
    }
  }
  console.log(`candidates=${rows.length} reclassify=${changes.length} unchanged(still accessories)=${rows.length - changes.length}`);
  console.log('by target:', JSON.stringify(byTarget));
  for (const s of changes.slice(0, 12)) console.log(`  ${s.to.padEnd(16)} ← ${s.name}`);

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `${OUT_DIR}/reclassify-firecrawl-accessories-${APPLY ? 'applied' : 'dry'}-${stamp}.json`;
  writeFileSync(file, JSON.stringify({ readAt: new Date().toISOString(), since: SINCE, apply: APPLY, candidates: rows.length, byTarget, changes }, null, 1));
  console.log(`exported → ${file}`);

  if (!APPLY) { console.log('DRY RUN — nothing written. Re-run with --apply to write.'); await c.end(); return; }

  // Grouped UPDATE per target category, inside one transaction; the export above is the rollback source.
  await c.query('BEGIN');
  let updated = 0;
  for (const [to, _n] of Object.entries(byTarget)) {
    const ids = changes.filter((x) => x.to === to).map((x) => x.id);
    for (let i = 0; i < ids.length; i += 500) {
      const res = await c.query(`update products set category=$1 where id = any($2::uuid[]) and category='accessories'`, [to, ids.slice(i, i + 500)]);
      updated += res.rowCount ?? 0;
    }
  }
  await c.query('COMMIT');
  console.log(`APPLIED: ${updated} rows updated.`);
  console.log(`ROLLBACK: for each change in ${file}: update products set category='accessories' where id=<id> and category=<to>;`);
  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
