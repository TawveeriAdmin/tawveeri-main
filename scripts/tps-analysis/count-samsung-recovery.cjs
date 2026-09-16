const fs = require('fs');
const source = 'samsung-recovery-source-reconciliation-2026-09-16.json';
const snapshot = JSON.parse(fs.readFileSync(`docs/evidence/${source}`));
const categories = {};
for (const model of snapshot.models.filter(m => m.identity && !m.exclusion)) {
  const product = model.product;
  const count = categories[model.identity.category] ??= { products: 0, priced: 0, available: 0, images: 0, explicitZeroPrice: 0 };
  count.products++;
  count.priced += Number(product.current_price > 0);
  count.available += Number(product.current_price > 0 && ['in_stock', 'limited_stock', 'pre_order'].includes(product.availability));
  count.images += Number(Boolean(product.image_urls?.length));
  count.explicitZeroPrice += Number(product.current_price === 0);
}
const totals = Object.values(categories).reduce((sum, count) => {
  for (const key in count) sum[key] = (sum[key] || 0) + count[key];
  return sum;
}, {});
fs.writeFileSync('docs/evidence/samsung-recovery-source-category-counts-2026-09-16.json',
  JSON.stringify({ measuredAt: new Date().toISOString(), source, categories, totals }, null, 2));
console.log(JSON.stringify(totals));
