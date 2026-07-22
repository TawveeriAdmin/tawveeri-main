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
// Paginated full-table read — PostgREST caps a single select at 1000 rows; the
// projection (>1000) and staging (~25k) both exceed it, so an unpaginated read
// silently undercounts. Fail-loud on error rather than return a partial total.
async function selectAll<T>(sb: ReturnType<typeof createServerClient>, table: string, cols: string, notNull?: string): Promise<T[]> {
  const out: T[] = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (notNull) q = q.not(notNull, "is", null);
    const { data, error } = await q;
    if (error) throw new Error(`dashboard read ${table} failed: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

export async function GET() {
  const sb = createServerClient();

  const proj = await selectAll<{ category: string; has_comparison: boolean; store_count: number }>(sb, "tps_product_projection", "category, has_comparison, store_count");
  const { data: ledger } = await sb.from("tps_coverage_ledger").select("snapshot_at, category, raw, resolved, corroborated, single_store").eq("category", "_total_").order("snapshot_at", { ascending: false }).limit(14);

  const byCat: Record<string, { corroborated: number; single_store: number }> = {};
  for (const p of proj) { const c = (byCat[p.category as string] ??= { corroborated: 0, single_store: 0 }); if (p.has_comparison) c.corroborated++; else c.single_store++; }
  const totalCorroborated = proj.filter((p) => p.has_comparison).length;
  const totalIndexed = proj.length;

  // per-store coverage (distinct products observed) from staging
  const stg = await selectAll<{ store_id: number; identity_key: string }>(sb, "tps_identity_staging", "store_id, identity_key", "identity_key");
  const storeProducts: Record<number, Set<string>> = {};
  for (const r of stg) { const s = (r.store_id as number); if (s == null) continue; (storeProducts[s] ??= new Set()).add(r.identity_key as string); }

  // Discount Integrity headline — how honest are advertised discounts? (trust moat)
  let discount_integrity: { checkable: number; inflated_reference: number; verified_drop: number; inflated_share_pct: number | null } | null = null;
  try {
    const vs = ["verified_drop", "inflated_reference", "stable"] as const;
    const c: Record<string, number> = {};
    for (const v of vs) { const { count } = await sb.from("tps_listing_price_facts").select("*", { count: "exact", head: true }).eq("verdict", v); c[v] = count ?? 0; }
    const checkable = c.verified_drop + c.inflated_reference + c.stable;
    discount_integrity = { checkable, inflated_reference: c.inflated_reference, verified_drop: c.verified_drop, inflated_share_pct: checkable ? Math.round((c.inflated_reference / checkable) * 100) : null };
  } catch { discount_integrity = null; }

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
    discount_integrity,
    neutrality: "ranking-blind (commercial interest never enters ranking)",
  });
}
