// src/lib/intelligence/product-edges-lookup.ts
// Resolve knowledge-graph relationship edges (tps_product_edges) into agent-ready
// alternatives per product: bigger/smaller-storage variants and newer/older
// generations, with price deltas. Powers budget-aware guidance ("the 256GB is
// −800", "last year's model is −700, still excellent"). Read-only, deterministic.
import type { createServerClient } from "@/lib/database";

export interface ProductAlternative {
  id: string;
  relation: "larger_storage" | "smaller_storage" | "newer" | "older";
  title_ar: string | null;
  title_en: string | null;
  price: number | null;
  price_delta: number | null; // FRESH: alt current price − anchor current price (null if either stale/missing)
  detail: string;             // durable identity fact (e.g. "256GB → 512GB")
}

export async function getProductAlternatives(
  sb: ReturnType<typeof createServerClient>, canonicalIds: string[]
): Promise<Map<string, ProductAlternative[]>> {
  const out = new Map<string, ProductAlternative[]>();
  const ids = [...new Set(canonicalIds.filter(Boolean))];
  if (!ids.length) return out;

  const { data: edges } = await sb.from("tps_product_edges").select("from_id, to_id, type, price_delta, detail").or(`from_id.in.(${ids.join(",")}),to_id.in.(${ids.join(",")})`);
  if (!edges?.length) return out;

  // Fetch FRESH prices for anchors AND alternatives — the price delta is derived from
  // current comparable offers, never a stale value baked into the edge (the edge
  // stores only the durable relationship identity, e.g. "256GB → 512GB").
  const allNodes = new Set<string>(ids);
  for (const e of edges) { allNodes.add(e.from_id as string); allNodes.add(e.to_id as string); }
  const nodeIds = [...allNodes];
  const nameById = new Map<string, { ar: string | null; en: string | null }>();
  const priceById = new Map<string, number | null>();
  const { data: canon } = await sb.from("canonical_products").select("id, name_ar, name_en").in("id", nodeIds);
  for (const c of canon ?? []) nameById.set(c.id as string, { ar: c.name_ar, en: c.name_en });
  const { data: proj } = await sb.from("tps_product_projection").select("canonical_id, lowest_price").in("canonical_id", nodeIds);
  for (const p of proj ?? []) priceById.set(p.canonical_id as string, p.lowest_price != null ? Number(p.lowest_price) : null);

  // fresh delta = alt current price − anchor current price (null if either is missing)
  const freshDelta = (anchor: string, other: string): number | null => {
    const a = priceById.get(anchor), b = priceById.get(other);
    return a != null && b != null ? Math.round(b - a) : null;
  };
  const push = (anchor: string, otherId: string, relation: ProductAlternative["relation"], detail: string) => {
    const nm = nameById.get(otherId);
    (out.get(anchor) ?? out.set(anchor, []).get(anchor)!).push({
      id: otherId, relation, title_ar: nm?.ar ?? null, title_en: nm?.en ?? null,
      price: priceById.get(otherId) ?? null, price_delta: freshDelta(anchor, otherId), detail,
    });
  };

  for (const e of edges) {
    const from = e.from_id as string, to = e.to_id as string;
    if (e.type === "storage_variant") {
      if (ids.includes(from)) push(from, to, "larger_storage", e.detail as string);   // to has more storage
      if (ids.includes(to)) push(to, from, "smaller_storage", e.detail as string);
    } else if (e.type === "successor") {
      if (ids.includes(from)) push(from, to, "newer", e.detail as string);            // to is newer
      if (ids.includes(to)) push(to, from, "older", e.detail as string);
    }
  }
  // keep it compact: at most 3 alternatives per product, cheaper options first
  for (const [k, alts] of out) out.set(k, alts.sort((a, b) => (a.price_delta ?? 0) - (b.price_delta ?? 0)).slice(0, 3));
  return out;
}
