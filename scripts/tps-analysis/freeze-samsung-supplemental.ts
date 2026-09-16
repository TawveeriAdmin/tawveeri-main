import { readFileSync, writeFileSync } from 'fs';
import { adaptRow } from '../tps-core/progressive-engine';
import { samsungDeclaredModelIdentity } from '../tps-core/samsung-manufacturer-identity';
const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
const models = source.models.filter((m: any) => m.identity && !m.exclusion);
const verified = new Map(models.map((m: any) => [m.model, m.identity])) as Parameters<typeof samsungDeclaredModelIdentity>[2];
const raw = JSON.parse(readFileSync('docs/evidence/samsung-recovery-cross-merchant-raw-2026-09-16.json', 'utf8'));
const cross = raw.rows.map((row: any) => {
  const identity = samsungDeclaredModelIdentity(adaptRow(row.payload, row.name).brand, row.payload, verified);
  return { store: row.store_id, rawId: row.raw_obs_id, oldKey: row.identity_key, url: row.url, price: row.price,
    declaredModel: row.payload.model || row.payload.modelNumber || row.payload.mpn || null,
    identity, classification: identity ? 'EXACT_MANUFACTURER_SOURCE_MATCH' : 'NO_EXACT_MATCH_IN_VERIFIED_SAUDI_SOURCE',
    source: identity ? models.find((m: any) => m.model === identity.model).product : null };
});
writeFileSync('docs/evidence/samsung-recovery-cross-merchant-classification-2026-09-16.json', JSON.stringify({
  measuredAt: new Date().toISOString(), snapshotAt: raw.observedAt,
  method: 'Current valid Samsung-branded TPS offers from stores 4/5; exact declared full model only. No-match means absent from this verified source set, not proof of global absence/discontinuation.',
  counts: { rows: cross.length, exact: cross.filter((r: any) => r.identity).length, noExact: cross.filter((r: any) => !r.identity).length }, rows: cross,
}, null, 2));
const rows: any[] = [];
for (const [label, prefix] of [['flagship', 'SM-S948'], ['midrange', 'SM-A'], ['soundbar', 'HW-'], ['washer', 'WW'], ['dryer', 'DV'], ['standalone-audio', 'MX-']]) {
  const candidates = models.filter((m: any) => m.model.startsWith(prefix));
  const pick = candidates.find((m: any) => m.product.current_price > 0 && ['in_stock', 'limited_stock'].includes(m.product.availability)) || candidates[0];
  if (pick) rows.push({ category: pick.identity.category, model: pick.model, label, sourceProduct: pick.product });
}
for (const store of [4, 5]) {
  const picks = cross.filter((r: any) => r.store === store && r.identity && r.source.current_price > 0
    && ['in_stock', 'limited_stock'].includes(r.source.availability))
    .sort((a: any, b: any) => Number(b.oldKey !== b.identity.key) - Number(a.oldKey !== a.identity.key));
  const categories = new Set();
  for (const pick of picks) {
    if (categories.has(pick.identity.category)) continue;
    categories.add(pick.identity.category);
    rows.push({ category: pick.identity.category, model: pick.identity.model, label: `shared-store-${store}`,
      retailerUrl: pick.url, retailerRawId: pick.rawId, sourceProduct: pick.source });
    if (categories.size === 3) break;
  }
}
writeFileSync('docs/evidence/samsung-recovery-supplemental-cohort-2026-09-16.json', JSON.stringify({
  frozenAt: new Date().toISOString(), method: 'Additional product families and up to three distinct shared categories per retailer, selected from frozen source evidence before recovery; no journey-result selection.', rows,
}, null, 2));
console.log(JSON.stringify({ crossRows: cross.length, exact: cross.filter((r: any) => r.identity).length, supplemental: rows.map(r => ({ label: r.label, model: r.model })) }));
