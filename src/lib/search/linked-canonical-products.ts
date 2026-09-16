/** Reuse persisted canonical links only when that active canonical was retrieved.
 * No title/model inference, variant collapsing, pricing, or ranking changes. */
export function linkRetrievedCanonicals<T extends { product_id?: string; tps_identity_key?: string | null }>(
  products: T[], canonicals: T[], links: Array<{ id: string; canonical_product_id: string | null; model?: string | null; brand?: string | null }>,
): T[] {
  const keys = new Map(canonicals.filter(p => p.product_id && p.tps_identity_key)
    .map(p => [p.product_id!, p.tps_identity_key!]));
  const linked = new Map(links.map(p => [p.id, p.canonical_product_id]));
  const declared = new Map(links.filter(p => ['samsung', 'سامسونج'].includes((p.brand || '').trim().toLowerCase())
    && p.model).map(p => [p.id, `samsung|MODEL:${p.model!.trim().toUpperCase()}`]));
  const retrieved = new Set(keys.values());
  return products.map(p => {
    if (p.tps_identity_key || !p.product_id) return p;
    // A retailer's declared complete MPN is eligible only when that exact
    // manufacturer key was independently retrieved. Never infer it from a title.
    const declaredKey = declared.get(p.product_id);
    const key = declaredKey && retrieved.has(declaredKey) ? declaredKey : keys.get(linked.get(p.product_id) || '');
    return key ? { ...p, tps_identity_key: key } : p;
  });
}
