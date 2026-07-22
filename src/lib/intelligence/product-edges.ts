// src/lib/intelligence/product-edges.ts
// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE-GRAPH RELATIONSHIP EDGES — turn the flat product catalog into a real
// knowledge graph (Strategic Brief §5.4). Deterministic edges derived ONLY from
// corroborated Product DNA — never fabricated:
//   • storage_variant : same product, different storage (iPhone 16 Pro Max 256↔512)
//   • successor       : same config, consecutive generation (iPhone 15→16 Pro Max 256)
// Powers budget-aware agent guidance ("the 256GB is −800 SAR", "last year's model is
// −700, still excellent") and a richer consumer experience. Pure & testable.
// Precision-first: an edge requires exact structured agreement on every identity
// field except the ONE that defines the relationship. LLM-free.
// ─────────────────────────────────────────────────────────────────────────────

export interface EdgeCanonical {
  id: string;
  brand: string | null;
  family: string | null;
  generation: string | null;
  variant: string | null;
  storage: number | null;
  price: number | null;
}

export type EdgeType = "storage_variant" | "successor";
export interface ProductEdge {
  from_id: string;
  to_id: string;
  type: EdgeType;
  price_delta: number | null; // price(to) − price(from); null if either price missing
  detail: string;             // e.g. "256GB → 512GB" or "gen 15 → 16"
}

/** Numeric generation from a generation label ("16" → 16, "S26" → 26). Null if none. */
export function genNumber(gen: string | null): number | null {
  if (!gen) return null;
  const m = String(gen).match(/(\d{1,3})/);
  return m ? Number(m[1]) : null;
}

const key = (c: EdgeCanonical, ...fields: (keyof EdgeCanonical)[]) =>
  fields.map((f) => String(c[f] ?? "∅")).join("|");
const delta = (a: EdgeCanonical, b: EdgeCanonical): number | null =>
  a.price != null && b.price != null ? Math.round(b.price - a.price) : null;

/**
 * Derive deterministic variant + successor edges over a set of canonicals that
 * share a category with clean family/generation/variant/storage DNA (mobile-shape).
 * Directed: storage_variant links smaller→larger storage; successor links older→newer.
 */
export function deriveProductEdges(canonicals: EdgeCanonical[]): ProductEdge[] {
  const edges: ProductEdge[] = [];
  const clean = canonicals.filter((c) => c.brand && c.family);

  // ── storage_variant: same (brand, family, generation, variant), differ on storage ──
  const byModel = new Map<string, EdgeCanonical[]>();
  for (const c of clean) {
    if (c.storage == null) continue;
    const k = key(c, "brand", "family", "generation", "variant");
    (byModel.get(k) ?? byModel.set(k, []).get(k)!).push(c);
  }
  for (const group of byModel.values()) {
    const uniq = [...new Map(group.map((c) => [c.storage, c])).values()].sort((a, b) => (a.storage! - b.storage!));
    for (let i = 0; i < uniq.length - 1; i++) {
      const a = uniq[i], b = uniq[i + 1];
      edges.push({ from_id: a.id, to_id: b.id, type: "storage_variant", price_delta: delta(a, b), detail: `${a.storage}GB → ${b.storage}GB` });
    }
  }

  // ── successor: same (brand, family, variant, storage), consecutive generation ──
  const byConfig = new Map<string, EdgeCanonical[]>();
  for (const c of clean) {
    if (genNumber(c.generation) == null) continue;
    const k = key(c, "brand", "family", "variant", "storage");
    (byConfig.get(k) ?? byConfig.set(k, []).get(k)!).push(c);
  }
  for (const group of byConfig.values()) {
    const uniq = [...new Map(group.map((c) => [genNumber(c.generation)!, c])).values()].sort((a, b) => genNumber(a.generation)! - genNumber(b.generation)!);
    for (let i = 0; i < uniq.length - 1; i++) {
      const a = uniq[i], b = uniq[i + 1];
      if (genNumber(b.generation)! - genNumber(a.generation)! === 1) {
        edges.push({ from_id: a.id, to_id: b.id, type: "successor", price_delta: delta(a, b), detail: `gen ${genNumber(a.generation)} → ${genNumber(b.generation)}` });
      }
    }
  }
  return edges;
}
