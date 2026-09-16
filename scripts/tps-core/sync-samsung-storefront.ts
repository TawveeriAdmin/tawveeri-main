import { algoliasearch } from 'algoliasearch';
import { samsungCatalogExclusion } from '../../src/lib/scraping/stores/samsung-catalog';

/** Samsung legacy listings must not keep stale prices after the canonical feed
 * refresh. Only exact full manufacturer codes are linked; index writes touch
 * these existing Samsung product IDs, with no settings/ranking changes.
 * Caller owns the serialized realization lane. */
export async function syncSamsungStorefront(pg: { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }, apply: boolean) {
  const before = (await pg.query(`select p.id as product_id,p.model,p.is_active,p.name_ar,p.name_en,p.brand,p.category,p.image_url,
    p.canonical_product_id,ps.current_price,ps.original_price,ps.availability,ps.product_url,ps.last_scraped_at,
    c.id as next_canonical_id,o.price as next_price,o.url as next_url,o.observed_at as next_observed_at,o.payload as next_payload,
    b.classification as source_classification,b.last_validated_at as source_validated_at,
    exists(select 1 from product_stores other where other.product_id=p.id and other.store_id<>6) as shared
    from products p join product_stores ps on ps.product_id=p.id and ps.store_id=6
    left join canonical_products c on c.tps_identity_key='samsung|MODEL:'||p.model and c.is_active
    left join tps_current_offers o on o.identity_key=c.tps_identity_key and o.store_id=6 and o.status='valid' and o.category=c.category
    left join lateral (select classification,last_validated_at from samsung_official_url_baseline
      where official_url=ps.product_url or model_code=p.model order by last_validated_at desc nulls last limit 1) b on true`)).rows;
  // Product IDs happen to be Samsung-only in the audited snapshot. If that
  // changes, fail visibly rather than accidentally rewrite another merchant.
  if (before.some(row => row.shared)) throw new Error('Samsung storefront sync requires per-merchant handling for newly shared legacy IDs');
  const app = process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const key = process.env.ALGOLIA_ADMIN_KEY;
  if (!app || !key) throw new Error('Samsung storefront index credentials unavailable');
  const index = process.env.ALGOLIA_INDEX_NAME || 'products';
  const client = algoliasearch(app, key);
  const ids = [...new Set<string>(before.map(row => row.product_id))];
  const priorIndex: unknown[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const result = await client.getObjects({ requests: ids.slice(i, i + 100).map(objectID => ({ indexName: index, objectID })) });
    priorIndex.push(...result.results);
  }
  const objects: any[] = [], removed: string[] = [];
  const updates: any[] = [];
  let linked = 0;
  for (const row of before) {
    const excluded = samsungCatalogExclusion(row.model || '');
    if (excluded) {
      removed.push(row.product_id);
      updates.push({ id: row.product_id, canonical_id: row.canonical_product_id, active: false, update_offer: false });
      continue;
    }
    if (row.source_classification === 'INVALID' && row.source_validated_at
      && (!row.next_observed_at || new Date(row.source_validated_at) > new Date(row.next_observed_at))) {
      removed.push(row.product_id);
      updates.push({ id: row.product_id, canonical_id: row.canonical_product_id, active: false, update_offer: false });
      continue; // no current extractable offer; do not invent an out-of-stock observation
    }
    if (!row.next_canonical_id || !row.next_payload) continue; // source-unresolved is not fabricated as OOS
    linked++;
    const price = row.next_price == null ? null : Number(row.next_price);
    const original = Number(row.next_payload._original_price) > Number(price) ? Number(row.next_payload._original_price) : null;
    const availability = row.next_payload._availability || 'out_of_stock';
    const eligible = price !== null && price > 0 && ['in_stock', 'limited_stock', 'pre_order'].includes(availability);
    updates.push({ id: row.product_id, canonical_id: row.next_canonical_id, active: eligible, update_offer: true,
      price, original, availability, url: row.next_url, observed: row.next_observed_at });
    if (!eligible) {
      removed.push(row.product_id); continue;
    }
    const store = { store_name: 'سامسونج السعودية', current_price: price, original_price: original,
      product_url: row.next_url, availability, coupon_code: null };
    objects.push({ objectID: row.product_id, name_ar: row.name_ar, name_en: row.name_en, brand: row.brand || '',
      category: row.category, image_url: row.image_url, stores: [store], store_names: [store.store_name], store_count: 1,
      best_price: price, in_stock: availability !== 'pre_order', has_deal: original !== null,
      max_discount_pct: original && price ? Math.round((1 - price / original) * 100) : 0 });
  }
  if (apply) {
    await pg.query('BEGIN');
    try {
      await pg.query(`update products p set canonical_product_id=u.canonical_id,is_active=u.active
        from jsonb_to_recordset($1::jsonb) as u(id uuid,canonical_id uuid,active boolean) where p.id=u.id`, [JSON.stringify(updates)]);
      await pg.query(`update product_stores ps set current_price=u.price,original_price=u.original,availability=u.availability,
        product_url=u.url,last_scraped_at=u.observed from jsonb_to_recordset($1::jsonb)
        as u(id uuid,update_offer boolean,price numeric,original numeric,availability text,url text,observed timestamptz)
        where ps.product_id=u.id and ps.store_id=6 and u.update_offer`, [JSON.stringify(updates)]);
      await pg.query('COMMIT');
    } catch (error) { await pg.query('ROLLBACK'); throw error; }
    if (objects.length) await client.saveObjects({ indexName: index, objects, waitForTasks: true });
    if (removed.length) await client.deleteObjects({ indexName: index, objectIDs: removed, waitForTasks: true });
  }
  return { before, priorIndex, updates, summary: { apply, legacyRows: before.length, exactLinked: linked,
    indexObjects: objects.length, indexRemoved: removed.length, index } };
}
