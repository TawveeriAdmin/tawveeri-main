/* Aggregate-only report dataset. Full production/rollback journals stay separate. */
const fs = require('fs');
const read = name => JSON.parse(fs.readFileSync(`docs/evidence/${name}`));
const source = read('samsung-recovery-source-reconciliation-2026-09-16.json');
const attribution = read('samsung-recovery-attribution-2026-09-16.json');
const before = read('samsung-recovery-production-before-realization-2026-09-16.json');
const afterFile = process.argv[2] || 'samsung-recovery-production-final-after-2026-09-16.json';
const after = read(afterFile);
const included = source.models.filter(m => !m.exclusion && m.identity);
const beforeBy = new Map(before.models.map(m => [m.model, m]));
const afterBy = new Map(after.models.map(m => [m.model, m]));
const rawBy = new Map(attribution.rows.map(m => [m.model, m]));
const purchasable = row => row?.status === 'valid' && Number(row.price) > 0
  && ['in_stock', 'limited_stock', 'pre_order'].includes(row.availability);
const categories = {}, losses = {};
for (const model of included) {
  const b = beforeBy.get(model.model), a = afterBy.get(model.model), raw = rawBy.get(model.model);
  const c = categories[model.identity.category] ??= { source: 0, rawBefore: 0, rawAfter: 0, canonicalBefore: 0,
    canonicalAfter: 0, projectionBefore: 0, projectionAfter: 0, validCurrentOfferAfter: 0, purchasableAfter: 0 };
  c.source++; c.rawBefore += Number(raw?.beforeRaw === true); c.rawAfter += Number(!!raw?.raw);
  c.canonicalBefore += Number(!!b?.canonical_id); c.canonicalAfter += Number(!!a?.canonical_id);
  c.projectionBefore += Number(!!b?.projection_id); c.projectionAfter += Number(!!a?.projection_id);
  c.validCurrentOfferAfter += Number(a?.status === 'valid'); c.purchasableAfter += Number(purchasable(a));
  const reason = !raw?.raw ? 'NO_RAW_OBSERVATION' : !a?.canonical_id ? 'CANONICAL_MISSING'
    : !a.is_active ? 'CANONICAL_INACTIVE' : !a.projection_id ? 'PROJECTION_MISSING'
    : a.status !== 'valid' ? 'CURRENT_OFFER_MISSING_OR_INVALID' : !(Number(a.price) > 0) ? 'NO_POSITIVE_CURRENT_PRICE'
    : !purchasable(a) ? 'PURCHASE_AVAILABILITY_NOT_AFFIRMED' : 'PURCHASABLE';
  losses[reason] = (losses[reason] || 0) + 1;
}
const totals = Object.values(categories).reduce((out, c) => { for (const k in c) out[k] = (out[k] || 0) + c[k]; return out; }, {});
const urlsBy = new Map(included.map(m => [m.model, new Set([m.product.product_url])]));
for (const row of source.urls) if (urlsBy.has(row.model)) urlsBy.get(row.model).add(row.url);
const owners = new Map();
for (const [model, urls] of urlsBy) for (const url of urls) {
  if (!owners.has(url)) owners.set(url, new Set()); owners.get(url).add(model);
}
const result = { measuredAt: new Date().toISOString(), beforeAt: before.observedAt, afterAt: after.observedAt,
  deployedCommit: after.runtime.commit, sourceCaptureCompletedAt: source.completedAt,
  definitions: { model: 'Complete Saudi manufacturer commercial variant, not family or URL',
    rawBefore: 'Immutable observation before recovery application started',
    canonicalBefore: 'Exact full-model identity, not any generic canonical association',
    purchasableAfter: 'Positive current valid Samsung offer and affirmatively purchasable stock state',
    search: 'API/browser census reported separately; projection is not proof of a rendered user journey',
    multiStore: 'Excluded from before/after uplift because before instrumentation lacked normalized stock metadata' },
  source: { ...source.summary, validatedModelUrls: owners.size,
    additionalAliases: [...urlsBy.values()].reduce((sum, urls) => sum + urls.size - 1, 0),
    ambiguousUrls: [...owners.values()].filter(models => models.size > 1).length },
  categories, totals, lossReasonsAfter: losses, attribution: attribution.summary,
  rawCoveragePercent: { before: Number((100 * totals.rawBefore / totals.source).toFixed(2)),
    after: Number((100 * totals.rawAfter / totals.source).toFixed(2)) } };
fs.writeFileSync('docs/evidence/samsung-recovery-measurement-summary-2026-09-16.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ totals, lossReasonsAfter: losses }));
