// src/lib/intelligence/coverage-ledger.ts
// E15.5 — writes an append-only coverage snapshot to tps_coverage_ledger. Called
// (throttled) from the dispatch tick and available as a standalone script. Records
// the graph's growth over time so the Dashboard can show trends. Read-only against
// the graph; append-only to the ledger. Deterministic.
import type { SupabaseClient } from "@supabase/supabase-js";

const SWEEP_CATS = ["air_conditioner", "audio", "camera", "laptop", "tablet", "tv", "mobile"];

export interface CoverageSnapshot { snapshot_at: string; total: { raw: number; resolved: number; corroborated: number; single_store: number }; by_category: Record<string, { resolved: number; corroborated: number; single_store: number }>; }

export async function writeCoverageSnapshot(sb: SupabaseClient, nowIso: string): Promise<CoverageSnapshot> {
  const db = sb as unknown as SupabaseClient & { rpc: SupabaseClient["rpc"] };
  // raw + resolved-key totals
  const { count: raw } = await db.from("raw_observations").select("*", { count: "exact", head: true });
  const { data: proj } = await db.from("tps_product_projection").select("category, has_comparison");
  const { data: stg } = await db.from("tps_identity_staging").select("category, identity_key").not("identity_key", "is", null);

  const byCat: Record<string, { resolved: Set<string>; corroborated: number; single_store: number }> = {};
  for (const c of SWEEP_CATS) byCat[c] = { resolved: new Set(), corroborated: 0, single_store: 0 };
  for (const r of stg ?? []) { const c = byCat[r.category as string]; if (c && r.identity_key) c.resolved.add(r.identity_key as string); }
  for (const p of proj ?? []) { const c = byCat[p.category as string]; if (!c) continue; if (p.has_comparison) c.corroborated++; else c.single_store++; }

  const rows: { snapshot_at: string; category: string; raw: number | null; resolved: number; corroborated: number; single_store: number }[] = [];
  const by_category: CoverageSnapshot["by_category"] = {};
  let tR = 0, tC = 0, tS = 0;
  for (const c of SWEEP_CATS) {
    const v = byCat[c]; const resolved = v.resolved.size;
    by_category[c] = { resolved, corroborated: v.corroborated, single_store: v.single_store };
    rows.push({ snapshot_at: nowIso, category: c, raw: null, resolved, corroborated: v.corroborated, single_store: v.single_store });
    tR += resolved; tC += v.corroborated; tS += v.single_store;
  }
  rows.push({ snapshot_at: nowIso, category: "_total_", raw: raw ?? null, resolved: tR, corroborated: tC, single_store: tS });
  await db.from("tps_coverage_ledger").insert(rows);
  return { snapshot_at: nowIso, total: { raw: raw ?? 0, resolved: tR, corroborated: tC, single_store: tS }, by_category };
}
