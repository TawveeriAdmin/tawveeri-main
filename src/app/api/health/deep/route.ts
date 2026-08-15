import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/deep — PRODUCT-TRUTH health (ADR-252, SEV-1 remediation).
 *
 * The SEV-1 lesson: `/api/health` returned 200 (Node alive) while every DB-backed
 * consumer surface — Search, Stores, Product — was dark, so uptime monitoring showed
 * green through a full outage. This endpoint answers the question that actually
 * matters: CAN A CUSTOMER GET DATA RIGHT NOW?
 *
 * Checks (≤3 tiny indexed reads, results cached in-process for 60s so external
 * monitors polling every 1–5 min cost ~1 query set/min — a health check must never
 * itself become load):
 *   1. stores readable (the exact surface that failed: «تعذر تحميل بيانات المتاجر»);
 *   2. projection readable + freshest last_observed_at (data, not just connectivity);
 *   3. DB round-trip latency.
 *
 * Semantics: 200 {healthy:true} · 200 {healthy:true, degraded:[…]} when slow/stale
 * (degraded ≠ down — fail open per health-check doctrine) · 503 when a consumer read
 * itself fails. Point UptimeRobot HERE, keep /api/health as pure liveness.
 */

interface DeepHealth {
  healthy: boolean;
  degraded: string[];
  failed: string[];
  db_latency_ms: number | null;
  stores_readable: boolean;
  projection_readable: boolean;
  freshest_observation_age_hours: number | null;
  checked_at: string;
}

let cache: { result: DeepHealth; at: number } | null = null;
const CACHE_MS = 60_000;
const SLOW_MS = 2_000;
const STALE_HOURS = 48;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.result, { status: cache.result.healthy ? 200 : 503 });
  }
  const degraded: string[] = [];
  const failed: string[] = [];
  let storesReadable = false, projectionReadable = false;
  let freshestAgeH: number | null = null;
  let latency: number | null = null;

  try {
    const sb = createServerClient() as unknown as { from: (t: string) => { select: (c: string, o?: object) => any } };
    const t0 = Date.now();
    const [storesRes, projRes] = await Promise.all([
      sb.from("stores").select("id").limit(1),
      sb.from("tps_product_projection").select("last_observed_at").order("last_observed_at", { ascending: false }).limit(1),
    ]);
    latency = Date.now() - t0;
    storesReadable = !storesRes?.error && (storesRes?.data ?? []).length > 0;
    projectionReadable = !projRes?.error && (projRes?.data ?? []).length > 0;
    if (!storesReadable) failed.push("stores_read");
    if (!projectionReadable) failed.push("projection_read");
    const lastObs = projRes?.data?.[0]?.last_observed_at as string | undefined;
    if (lastObs) {
      freshestAgeH = Math.round((Date.now() - new Date(lastObs).getTime()) / 3600_000);
      if (freshestAgeH > STALE_HOURS) degraded.push(`freshest_observation_${freshestAgeH}h`);
    }
    if (latency > SLOW_MS) degraded.push(`db_latency_${latency}ms`);
  } catch (e) {
    failed.push(`db_unreachable:${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
  }

  const result: DeepHealth = {
    healthy: failed.length === 0,
    degraded, failed,
    db_latency_ms: latency,
    stores_readable: storesReadable,
    projection_readable: projectionReadable,
    freshest_observation_age_hours: freshestAgeH,
    checked_at: new Date().toISOString(),
  };
  cache = { result, at: Date.now() };
  return NextResponse.json(result, { status: result.healthy ? 200 : 503 });
}
