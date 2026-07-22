// src/lib/intelligence/coverage-ledger.ts
// E15.5 — writes an append-only coverage snapshot to tps_coverage_ledger. Called
// (throttled) from the dispatch tick and available as a standalone script. Records
// the graph's growth over time so the Dashboard can show trends. Read-only against
// the graph; append-only to the ledger. Deterministic.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CoverageSnapshot { snapshot_at: string; total: { raw: number; resolved: number; corroborated: number; single_store: number }; by_category: Record<string, { resolved: number; corroborated: number; single_store: number }>; }

/**
 * Snapshot the knowledge graph's coverage, append-only, for the Dashboard trend.
 * Categories are derived DYNAMICALLY from the projection (no hardcoded list to drift
 * out of sync with new plugins), and `resolved` counts distinct canonical identities
 * in the projection (bounded, honest — every resolved canonical is corroborated or
 * single_store). The projection is paginated so the PostgREST 1000-row cap can never
 * silently truncate the count as coverage grows. Read-only against the graph.
 */
export async function writeCoverageSnapshot(sb: SupabaseClient, nowIso: string): Promise<CoverageSnapshot> {
  const db = sb as unknown as SupabaseClient & { rpc: SupabaseClient["rpc"] };
  const { count: raw } = await db.from("raw_observations").select("*", { count: "exact", head: true });

  // Full projection scan (paginated — projection will exceed 1000 rows as coverage grows).
  const byCat: Record<string, { resolved: number; corroborated: number; single_store: number }> = {};
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("tps_product_projection")
      .select("category, has_comparison").range(from, from + PAGE - 1);
    if (error) throw new Error(`coverage-ledger projection read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const p of data) {
      const c = (byCat[p.category as string] ??= { resolved: 0, corroborated: 0, single_store: 0 });
      c.resolved++; if (p.has_comparison) c.corroborated++; else c.single_store++;
    }
    if (data.length < PAGE) break;
  }

  const rows: { snapshot_at: string; category: string; raw: number | null; resolved: number; corroborated: number; single_store: number }[] = [];
  const by_category: CoverageSnapshot["by_category"] = {};
  let tR = 0, tC = 0, tS = 0;
  for (const c of Object.keys(byCat).sort()) {
    const v = byCat[c];
    by_category[c] = { resolved: v.resolved, corroborated: v.corroborated, single_store: v.single_store };
    rows.push({ snapshot_at: nowIso, category: c, raw: null, resolved: v.resolved, corroborated: v.corroborated, single_store: v.single_store });
    tR += v.resolved; tC += v.corroborated; tS += v.single_store;
  }
  rows.push({ snapshot_at: nowIso, category: "_total_", raw: raw ?? null, resolved: tR, corroborated: tC, single_store: tS });
  await db.from("tps_coverage_ledger").insert(rows);
  return { snapshot_at: nowIso, total: { raw: raw ?? 0, resolved: tR, corroborated: tC, single_store: tS }, by_category };
}
