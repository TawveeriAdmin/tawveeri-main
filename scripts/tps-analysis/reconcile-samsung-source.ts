/** Read-only, resumable reconciliation of independently captured API + eight XMLs. */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { SamsungKsaScraper, isSamsungKsaProductUrl, KNOWN_CONSUMER_CATEGORY_PATH } from '../../src/lib/scraping/stores/samsung-ksa-scraper';
import { samsungCatalogProduct } from '../../src/lib/scraping/stores/samsung-catalog';
import { samsungManufacturerIdentity, samsungCatalogExclusion } from '../tps-core/samsung-manufacturer-identity';

async function main() {
  const finder = JSON.parse(readFileSync(process.argv[2] || 'docs/evidence/samsung-recovery-finder-raw-2026-09-16.json', 'utf8'));
  const sitemap = JSON.parse(readFileSync('docs/evidence/samsung-recovery-sitemaps-2026-09-16.json', 'utf8'));
  const output = 'docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json';
  const evidence = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : {
    startedAt: new Date().toISOString(), finderObservedAt: finder.updatedAt, sitemapObservedAt: sitemap.observedAt, models: [], urls: [],
  };
  const models = new Map<string, any>();
  for (const surface of finder.surfaces) for (const family of surface.families) for (const model of family.modelList) {
    if (models.has(model.modelCode)) continue;
    const product = samsungCatalogProduct({ site: surface.site, type: surface.type, familyId: family.familyId,
      subcategory: family.categorySubTypeEngName, observedAt: finder.updatedAt, sourceUrl: surface.pages[0]?.url, model });
    models.set(model.modelCode, { model: model.modelCode, product, source: 'public_finder',
      exclusion: samsungCatalogExclusion(model.modelCode), identity: samsungManufacturerIdentity(6, product as any) });
  }
  // Re-evaluate saved products under the current identity rules without
  // pretending their old HTTP observation was fetched again.
  for (const row of evidence.urls) if (row.product) {
    row.identity = samsungManufacturerIdentity(6, row.product);
    const exclusion = samsungCatalogExclusion(row.model || '');
    if (exclusion || row.identity) row.classification = exclusion || 'PDP_SUPPLEMENT';
  }
  const done = new Map(evidence.urls.map((row: any) => [row.url, row]));
  const scraper = new SamsungKsaScraper();
  const urls = [...new Set<string>(sitemap.sitemaps.flatMap((sm: any) => sm.urls))].sort();
  for (const url of urls) {
    if (done.has(url)) continue;
    const consumer = KNOWN_CONSUMER_CATEGORY_PATH.test(url)
      || /\/(tv-accessories|home-appliance-accessories|display-accessories|projector-accessories|projectors)\//.test(url);
    const row: any = { url, observedAt: new Date().toISOString() };
    if (!consumer) row.classification = 'OUTSIDE_CONSUMER_CATEGORIES';
    else if (!isSamsungKsaProductUrl(url)) row.classification = 'NAVIGATION_OR_EDITORIAL';
    else {
      const terminal = new URL(url).pathname.replace(/\/buy\/$/, '/').split('/').filter(Boolean).pop()!
        .toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matches = [...models.values()].filter(item => terminal.endsWith(item.model.replace(/[^A-Z0-9]/g, '')));
      if (matches.length === 1) {
        row.model = matches[0].model;
        row.classification = matches[0].exclusion || 'FINDER_MODEL_ALIAS';
      } else {
        try {
          row.product = await scraper.updateProductPrice(url);
          row.model = row.product?.sku || null;
          row.identity = row.product ? samsungManufacturerIdentity(6, row.product) : null;
          row.classification = row.model && samsungCatalogExclusion(row.model)
            || (row.identity ? 'PDP_SUPPLEMENT' : row.product ? 'UNRESOLVED_IDENTITY' : 'NO_EXTRACTABLE_PRODUCT');
        } catch (error) { row.classification = 'FETCH_FAILED'; row.error = String(error); }
        console.log(row.classification, url);
      }
    }
    evidence.urls.push(row);
    evidence.updatedAt = new Date().toISOString();
    writeFileSync(output, JSON.stringify(evidence, null, 2));
  }
  for (const row of evidence.urls) if (row.product && row.identity && !models.has(row.model)) {
    models.set(row.model, { model: row.model, product: row.product, identity: row.identity, source: 'sitemap_pdp',
      exclusion: samsungCatalogExclusion(row.model) });
  }
  const legacyProof = 'docs/evidence/samsung-recovery-legacy-only-pdps-2026-09-16.json';
  if (existsSync(legacyProof)) {
    evidence.knownPdpCrossCheck = JSON.parse(readFileSync(legacyProof, 'utf8'));
    for (const row of evidence.knownPdpCrossCheck.rows) {
      const identity = row.product && samsungManufacturerIdentity(6, row.product);
      if (identity && !samsungCatalogExclusion(row.model) && !models.has(row.model)) {
        models.set(row.model, { model: row.model, product: row.product, identity, source: 'known_pdp_crosscheck', exclusion: null });
      }
    }
  }
  evidence.models = [...models.values()];
  evidence.summary = { finderModels: [...models.values()].filter(row => row.source === 'public_finder').length,
    pdpSupplementModels: [...models.values()].filter(row => row.source === 'sitemap_pdp').length,
    knownPdpSupplementModels: [...models.values()].filter(row => row.source === 'known_pdp_crosscheck').length,
    includedModels: [...models.values()].filter(row => !row.exclusion && row.identity).length,
    excludedModels: [...models.values()].filter(row => row.exclusion).length,
    unresolvedModels: [...models.values()].filter(row => !row.exclusion && !row.identity).length,
    urlClassifications: evidence.urls.reduce((counts: any, row: any) => { counts[row.classification] = (counts[row.classification] || 0) + 1; return counts; }, {}) };
  evidence.completedAt = new Date().toISOString();
  writeFileSync(output, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence.summary));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
