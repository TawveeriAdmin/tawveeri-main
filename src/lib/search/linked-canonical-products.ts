/** Reuse persisted canonical links only when that active canonical was retrieved.
 * No title/model inference, variant collapsing, pricing, or ranking changes. */
export function linkRetrievedCanonicals<T extends { product_id?: string; tps_identity_key?: string | null }>(
  products: T[], canonicals: T[], links: Array<{ id: string; canonical_product_id: string | null }>,
): T[] {
  const keys = new Map(canonicals.filter(p => p.product_id && p.tps_identity_key)
    .map(p => [p.product_id!, p.tps_identity_key!]));
  const linked = new Map(links.map(p => [p.id, p.canonical_product_id]));
  return products.map(p => {
    if (p.tps_identity_key || !p.product_id) return p;
    const key = keys.get(linked.get(p.product_id) || '');
    return key ? { ...p, tps_identity_key: key } : p;
  });
}
