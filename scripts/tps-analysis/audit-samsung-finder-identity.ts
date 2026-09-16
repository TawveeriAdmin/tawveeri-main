import { readFileSync, writeFileSync } from 'fs';
import { CATEGORY_DEFS } from '../tps-core/category-registry';
import { samsungCatalogProduct } from '../../src/lib/scraping/stores/samsung-catalog';
import { samsungManufacturerIdentity } from '../tps-core/samsung-manufacturer-identity';

const input = JSON.parse(readFileSync('docs/evidence/samsung-recovery-finder-raw-2026-09-16.json', 'utf8'));
const models = new Map<string, any>();
for (const surface of input.surfaces) for (const family of surface.families) for (const model of family.modelList) {
  if (!models.has(model.modelCode)) models.set(model.modelCode, { site: surface.site, type: surface.type,
    subcategory: family.categorySubTypeEngName, familyId: family.familyId, model,
    observedAt: input.updatedAt, sourceUrl: surface.pages[0].url });
}
const rows = [];
const keys = new Map<string, string[]>();
for (const item of models.values()) {
  const product = samsungCatalogProduct(item);
  const manufacturer = process.argv.includes('--manufacturer') ? samsungManufacturerIdentity(6, product as any) : null;
  const matches = [];
  for (const [category, def] of Object.entries(CATEGORY_DEFS)) {
    if (manufacturer ? category !== manufacturer.category : !def.plugin.detect(product.name_ar, product.name_en)) continue;
    const normalized = def.normalize(product.name_ar, product.name_en, product.brand, product as any);
    const identity = manufacturer ? { key: manufacturer.key, status: 'valid' } : def.plugin.buildIdentityKey(product.brand, normalized.payload, { model_number: normalized.model_number });
    matches.push({ category, identity, model: normalized.model_number });
    if (identity.key) {
      const key = `${category}:${identity.key}`;
      keys.set(key, [...(keys.get(key) || []), product.sku!]);
    }
  }
  rows.push({ model: product.sku, category: item.type, subcategory: item.subcategory,
    name: product.name_en, url: product.product_url, availability: product.availability, matches });
}
const collisions = [...keys].filter(([, models]) => new Set(models).size > 1).map(([key, models]) => ({ key, models }));
const summary = { models: rows.length, noValidIdentity: rows.filter(row => !row.matches.some(m => m.identity.status === 'valid')).length,
  multipleCategories: rows.filter(row => row.matches.filter(m => m.identity.key).length > 1).length,
  identityKeysSharedByMultipleModelCodes: collisions.length };
writeFileSync(`docs/evidence/samsung-recovery-identity-${process.argv.includes('--manufacturer') ? 'candidate' : 'dry'}-2026-09-16.json`, JSON.stringify({ observedAt: new Date().toISOString(), summary, rows, collisions }, null, 2));
console.log(JSON.stringify(summary));
