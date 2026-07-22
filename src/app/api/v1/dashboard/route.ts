import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { APPLIANCE_META } from "@/lib/agent/decision-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bespoke deciders + generic config-factory appliance deciders (single source: the
// decision engine). Derived so it can never drift from what decide() actually supports.
const BESPOKE_SUPPORTED = ["air_conditioner", "tv", "tablet", "mobile", "laptop", "refrigerator", "washing_machine"];
const AGENT_SUPPORTED = [...BESPOKE_SUPPORTED, ...Object.keys(APPLIANCE_META)];
const STORE_NAME: Record<number, string> = { 1: "Jarir", 2: "Amazon", 4: "Extra", 5: "Almanea" };

/**
 * GET /api/v1/dashboard — E15.5 Commerce Intelligence dashboard data layer.
 * Aggregates the knowledge-graph state for the Dashboard: coverage totals + trend
 * (from the Coverage Ledger), per-category coverage, agent-supported categories,
 * and a per-store summary. Read-only, deterministic, ranking-blind.
 */
export async function GET() {
  const sb = createServerClient();

  const { data: proj } = await sb.from("tps_product_projection").select("category, has_comparison, store_count");
  const { data: ledger } = await sb.from("tps_coverage_ledger").select("snapshot_at, category, raw, resolved, corroborated, single_store").eq("category", "_total_").order("snapshot_at", { ascending: false }).limit(14);

  const byCat: Record<string, { corroborated: number; single_store: number }> = {};
  for (const p of proj ?? []) { const c = (byCat[p.category as string] ??= { corroborated: 0, single_store: 0 }); if (p.has_comparison) c.corroborated++; else c.single_store++; }
  const totalCorroborated = (proj ?? []).filter((p) => p.has_comparison).length;
  const totalIndexed = (proj ?? []).length;

  // per-store coverage (distinct products observed) from staging
  const { data: stg } = await sb.from("tps_identity_staging").select("store_id, identity_key").not("identity_key", "is", null);
  const storeProducts: Record<number, Set<string>> = {};
  for (const r of stg ?? []) { const s = (r.store_id as number); if (s == null) continue; (storeProducts[s] ??= new Set()).add(r.identity_key as string); }

  const trend = (ledger ?? []).map((l) => ({ at: l.snapshot_at, raw: l.raw, resolved: l.resolved, corroborated: l.corroborated, single_store: l.single_store })).reverse();
  const latest = trend[trend.length - 1] ?? null;
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;

  return NextResponse.json({
    version: "v1", generated_at: new Date().toISOString(),
    totals: { indexed: totalIndexed, corroborated: totalCorroborated, single_store: totalIndexed - totalCorroborated,
      resolved: latest?.resolved ?? null, raw: latest?.raw ?? null,
      corroborated_delta: latest && prev ? (latest.corroborated ?? 0) - (prev.corroborated ?? 0) : null },
    by_category: Object.fromEntries(Object.entries(byCat).map(([c, v]) => [c, { ...v, agent_supported: AGENT_SUPPORTED.includes(c) }])),
    agent: { supported_categories: AGENT_SUPPORTED, endpoint: "/api/v1/agent/decide", modes: ["structured", "free_text"] },
    protocols: { exposed: ["ucp", "acp"], feed: "/api/v1/protocol/ucp/feed", note: "UCP-compatible, not UCP-dependent; no checkout (Stage-2 SAMA-gated)" },
    stores: Object.entries(storeProducts).map(([id, set]) => ({ store_id: Number(id), store: STORE_NAME[Number(id)] ?? id, distinct_products: set.size, twin: `/api/v1/intelligence/merchant/${id}` })).sort((a, b) => b.distinct_products - a.distinct_products),
    coverage_trend: trend,
    neutrality: "ranking-blind (commercial interest never enters ranking)",
  });
}
