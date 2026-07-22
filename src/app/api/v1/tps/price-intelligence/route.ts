import { NextRequest, NextResponse } from "next/server";
import { getPriceVerdict, getPriceVerdicts } from "@/lib/intelligence/getPriceIntelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/tps/price-intelligence — deterministic buy-timing intelligence.
 *   ?canonical_id=<uuid>          → verdict for one product
 *   ?ids=<uuid>,<uuid>,...        → { [id]: verdict } for up to 50 products
 * Read-only. Precision-first: thin history returns `building_history` (honest),
 * never a fabricated "record low". No commission ever influences this.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const one = url.searchParams.get("canonical_id");
  const many = url.searchParams.get("ids");

  if (one) {
    const v = await getPriceVerdict(one);
    if (!v) return NextResponse.json({ canonical_id: one, price_intel: null, note: "no price history" });
    return NextResponse.json({ canonical_id: one, price_intel: v });
  }

  if (many) {
    const ids = many.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
    if (!ids.length) return NextResponse.json({ error: "no ids" }, { status: 400 });
    const map = await getPriceVerdicts(ids);
    return NextResponse.json({ count: map.size, price_intel: Object.fromEntries(map) });
  }

  return NextResponse.json({ error: "provide canonical_id or ids" }, { status: 400 });
}
