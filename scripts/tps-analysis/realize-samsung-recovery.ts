/** Exact-evidence recovery; dry by default. Does not scrape or append raw events.
 * --apply replays existing immutable observations at their original timestamps.
 * Production application is serialized with the normalizer's advisory lane.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
const { Client } = require('pg');
import { createClient } from '@supabase/supabase-js';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
import { CATEGORY_DEFS } from '../tps-core/category-registry';
import { adaptRow, extractImage, extractPrice, corroboratePass, stableUuid } from '../tps-core/progressive-engine';
import { samsungDeclaredModelIdentity, type SamsungVerifiedModel } from '../tps-core/samsung-manufacturer-identity';
import { syncSamsungStorefront } from '../tps-core/sync-samsung-storefront';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('vyceqrzttspyycdpojtn')) throw new Error('Unexpected database');
  const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
  if (!source.completedAt || source.summary.unresolvedModels) throw new Error('Source reconciliation not complete');
  const verified = new Map<string, SamsungVerifiedModel>(source.models.filter((m: any) => !m.exclusion && m.identity).map((m: any) => [m.model, m.identity]));
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await pg.connect();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const evidence: any = { observedAt: new Date().toISOString(), apply, sourceCompletedAt: source.completedAt, metrics: [] };
  const output = `docs/evidence/samsung-recovery-realization-${apply ? 'apply' : 'dry'}-${Date.now()}.json`;
  try {
    if (apply && !(await pg.query('select pg_try_advisory_lock($1) ok', [8148148])).rows[0].ok) throw new Error('Normalization lane busy');
    const canonicals: any[] = (await pg.query("select * from canonical_products where lower(brand)='samsung'")).rows;
    const offers = (await pg.query(`select o.*,r.payload as raw_payload,r.scraped_at,r.raw_name
      from tps_current_offers o join raw_observations r on r.id=o.raw_obs_id
      where o.store_id=6 or (o.store_id in (4,5) and lower(o.identity_key) like 'samsung|%')`)).rows;
    const legacy = (await pg.query(`select p.id,p.canonical_product_id,p.model,p.is_active as product_active,ps.* from products p
      join product_stores ps on ps.product_id=p.id where ps.store_id=6`)).rows;
    const conflicts = canonicals.filter(c => verified.has(c.model_number) && c.tps_identity_key !== verified.get(c.model_number)!.key);
    const rows = new Map<string, any>();
    const moves: any[] = [];
    for (const offer of offers) {
      const p = offer.raw_payload;
      const adapted = adaptRow(p, offer.raw_name);
      const identity = samsungDeclaredModelIdentity(adapted.brand, p, verified);
      if (!identity) continue;
      const def = CATEGORY_DEFS[identity.category];
      if (!def) throw new Error(`Missing category ${identity.category}`);
      const norm = def.normalize(adapted.nameAr, adapted.nameEn, adapted.brand, p);
      const rawImage = extractImage(p);
      const stage = { category: identity.category, raw_obs_id: Number(offer.raw_obs_id), store_id: offer.store_id,
        identity_key: identity.key, status: 'valid', price: extractPrice(p), url: adapted.url,
        name: (adapted.nameEn || adapted.nameAr).slice(0, 300), confidence: 95, detected: true,
        observed_at: offer.scraped_at, payload: { ...norm.payload, _manufacturer_model: identity.model,
          _source_name_ar: adapted.nameAr.includes(identity.model) ? adapted.nameAr : `${adapted.nameAr} (${identity.model})`,
          _source_name_en: adapted.nameEn.includes(identity.model) ? adapted.nameEn : `${adapted.nameEn} (${identity.model})`,
          ...(rawImage ? { _image: rawImage } : {}), ...(p.availability ? { _availability: p.availability } : {}),
          ...(typeof p.original_price === 'number' ? { _original_price: p.original_price } : {}) } };
      const key = `${identity.key}|${offer.store_id}`;
      if (!rows.has(key) || rows.get(key).raw_obs_id < stage.raw_obs_id) rows.set(key, stage);
      if (offer.identity_key !== identity.key || offer.category !== identity.category) moves.push({ category: offer.category,
        oldKey: offer.identity_key, nextKey: identity.key, nextCategory: identity.category, store: offer.store_id, rawId: offer.raw_obs_id });
    }
    const rawIds = [...new Set([...rows.values()].map(row => row.raw_obs_id))];
    const normalizedIds = [...new Set([...rows.values(), ...offers].filter(row => CATEGORY_DEFS[row.category])
      .map(row => stableUuid(CATEGORY_DEFS[row.category].normSeed(Number(row.raw_obs_id)))))];
    const targetIds = [...new Set([...rows.values()].map(row => canonicals.find(c => c.tps_identity_key === row.identity_key)?.id
      || stableUuid(CATEGORY_DEFS[row.category].canonSeed(row.identity_key))))];
    evidence.before = { canonicals, offers, legacy, storefront: await syncSamsungStorefront(pg, false),
      staging: (await pg.query('select * from tps_identity_staging where raw_obs_id=any($1::bigint[])', [rawIds])).rows,
      normalized: (await pg.query('select * from normalized_product_observations where id=any($1::uuid[])', [normalizedIds])).rows,
      matches: (await pg.query('select * from product_matches where canonical_product_id=any($1::uuid[])', [targetIds])).rows };
    evidence.plan = { targetCanonicalIds: targetIds, modelConflicts: conflicts.map(c => ({ id: c.id, model: c.model_number, oldKey: c.tps_identity_key })),
      moves, replayRows: [...rows.values()] };
    writeFileSync(output, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ output, conflicts: conflicts.length, moves: moves.length, replayRows: rows.size }));
    if (apply) {
      // A generic identity cannot truthfully own one arbitrarily selected full SKU.
      // Release only these proven conflicting claims; keep canonical IDs/history.
      await pg.query('BEGIN');
      for (const c of conflicts) await pg.query(`update canonical_products set model_number=null,
        attributes=coalesce(attributes,'{}'::jsonb)||jsonb_build_object('samsung_recovery_prior_model',$2::text)
        where id=$1 and model_number=$2 and tps_identity_key is not distinct from $3`, [c.id, c.model_number, c.tps_identity_key]);
      await pg.query('COMMIT');
      const staged = [...rows.values()];
      for (let i = 0; i < staged.length; i += 200) {
        const { error } = await sb.from('tps_identity_staging').upsert(staged.slice(i, i + 200), { onConflict: 'category,raw_obs_id' });
        if (error) throw error;
      }
    }
    const released = new Set(apply ? conflicts.map(c => c.id) : []);
    const writeGuards = {
      takenPair: new Set<string>(canonicals.filter(c => c.model_number && !released.has(c.id)).map(c => `${c.brand.toLowerCase()}|${c.model_number}`)),
      takenNameBrand: new Set<string>(canonicals.map(c => `${(c.name_ar || '').trim().toLowerCase()}|${c.brand.trim().toLowerCase()}`)),
    };
    for (const category of new Set([...rows.values()].map(row => row.category))) {
      const staged = [...rows.values()].filter(row => row.category === category);
      const keys = [...new Set<string>(staged.map(row => row.identity_key))];
      for (const singleStore of [false, true]) evidence.metrics.push({ category, singleStorePass: singleStore,
        ...await corroboratePass(sb, CATEGORY_DEFS[category], keys, { dry: !apply, singleStore, sweepRows: staged, writeGuards }) });
      writeFileSync(output, JSON.stringify(evidence, null, 2));
    }
    if (apply) {
      await pg.query('BEGIN');
      for (const move of moves) {
        const { rowCount } = await pg.query(`update tps_current_offers old set status='invalid',
          payload=coalesce(old.payload,'{}'::jsonb)||case when old.identity_key<>$4
            then jsonb_build_object('_superseded_by_identity',$4::text)
            else jsonb_build_object('_superseded_category',$5::text) end
          where old.category=$1 and old.identity_key=$2 and old.store_id=$3 and old.raw_obs_id=$6
          and exists(select 1 from tps_current_offers replacement join canonical_products c
            on c.tps_identity_key=replacement.identity_key and c.is_active
            where replacement.category=$5 and replacement.identity_key=$4 and replacement.store_id=$3 and replacement.status='valid')`,
        [move.category, move.oldKey, move.store, move.nextKey, move.nextCategory, move.rawId]);
        move.retired = rowCount === 1;
      }
      // Re-link only the exact full declared manufacturer code. No title/image guesses.
      for (const row of legacy) {
        const identity = verified.get(row.model);
        if (!identity) continue;
        await pg.query(`update products p set canonical_product_id=c.id from canonical_products c
          where p.id=$1 and c.tps_identity_key=$2 and c.is_active`, [row.product_id, identity.key]);
        await pg.query(`update product_stores ps set current_price=o.price,
          original_price=nullif(o.payload->>'_original_price','')::numeric,
          availability=coalesce(o.payload->>'_availability','out_of_stock'),product_url=o.url,last_scraped_at=o.observed_at
          from tps_current_offers o where ps.product_id=$1 and ps.store_id=6 and o.store_id=6
          and o.identity_key=$2 and o.status='valid'`, [row.product_id, identity.key]);
      }
      await pg.query(`update canonical_products c set is_active=false where lower(c.brand)='samsung'
        and exists(select 1 from tps_current_offers o where o.identity_key=c.tps_identity_key and o.payload->>'_superseded_by_identity' is not null)
        and not exists(select 1 from tps_current_offers o where o.identity_key=c.tps_identity_key and o.status='valid')
        and not exists(select 1 from products p where p.canonical_product_id=c.id)`);
      await pg.query('COMMIT');
      evidence.storefrontResult = (await syncSamsungStorefront(pg, true)).summary;
    }
    evidence.completedAt = new Date().toISOString();
    if (apply) evidence.after = {
      canonicals: (await pg.query("select * from canonical_products where lower(brand)='samsung'")).rows,
      offers: (await pg.query('select * from tps_current_offers where identity_key=any($1::text[])', [[...new Set([...rows.values()].map(row => row.identity_key))]])).rows,
    };
    writeFileSync(output, JSON.stringify(evidence, null, 2));
  } catch (error) {
    await pg.query('ROLLBACK').catch(() => {});
    evidence.error = String(error); writeFileSync(output, JSON.stringify(evidence, null, 2)); throw error;
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
