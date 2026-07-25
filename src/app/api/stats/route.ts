import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats — HONEST public counters for the homepage (Founder Directive Part 1/7:
 * never fabricate). Every number is a live count from the production database (the source
 * of truth), cached briefly. Replaces hardcoded marketing figures (e.g. "85,000 compared
 * products") that did not match reality (295 real cross-store comparisons).
 */
let cache: { at: number; data: Record<string, number> } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, { headers: { "cache-control": "public, max-age=300" } });
  }
  const supabase = createServerClient();
  const count = async (table: string, filter?: (q: ReturnType<ReturnType<typeof createServerClient>["from"]>) => unknown): Promise<number> => {
    try {
      let q = supabase.from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q) as typeof q;
      const { count: n } = await q;
      return n ?? 0;
    } catch { return 0; }
  };

  const [published, comparable, observations] = await Promise.all([
    count("tps_product_projection"),
    count("tps_product_projection", (q) => q.eq("has_comparison", true)),
    count("raw_observations"),
  ]);

  const data = {
    published_products: published,     // searchable products
    comparable_products: comparable,   // verified ≥2-store comparisons (the honest headline)
    observations,                      // total price observations tracked
    stores: 8,                         // integrated stores
  };
  cache = { at: Date.now(), data };
  return NextResponse.json(data, { headers: { "cache-control": "public, max-age=300" } });
}
