// POST /api/v1/agent/home-mission/share — create a shareable plan snapshot (ADR-257).
// The client sends STRUCTURE only (categories, canonical ids, quantities, marks);
// every displayed FACT is re-derived here from the production projection + newest
// observation, so a tampered request can never publish a fabricated price or product
// under Tawveeri's brand. Anonymous by design: the response returns the capability
// token (the share URL) plus an owner_key the client stores locally to read feedback.

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database";
import { sanitizeShareRequest, assembleSnapshot, type CanonicalFact } from "@/lib/agent/home-mission-share";
import { deriveReferralCode, appendReferralParams } from "@/lib/analytics/referral-link";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const req = sanitizeShareRequest(body);
  if (!req) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServerClient() as any;
  const ids = [...new Set(req.legs.map((l) => l.canonical_id))];

  // FACTS from production (never from the client): projection = price/name/image/store
  // authority; newest observation id = the /go exit.
  const projRes = await sb.from("tps_product_projection")
    .select("canonical_id, display_name_ar, display_name_en, lowest_price, cheapest_store, store_count, image_url, last_observed_at")
    .in("canonical_id", ids);
  const projRows = (projRes?.data ?? []) as Array<Record<string, unknown>>;
  const obsRes = await sb.from("normalized_product_observations")
    .select("id, canonical_product_id, observed_at")
    .in("canonical_product_id", ids)
    .order("observed_at", { ascending: false })
    .limit(Math.min(ids.length * 20, 400));
  const obsRows = (obsRes?.data ?? []) as Array<{ id: string; canonical_product_id: string }>;
  const goByCanon = new Map<string, string>();
  for (const o of obsRows) {
    if (!goByCanon.has(o.canonical_product_id)) goByCanon.set(o.canonical_product_id, `/go/${o.id}`);
  }

  const facts = new Map<string, CanonicalFact>();
  for (const p of projRows) {
    const cid = String(p.canonical_id).toLowerCase();
    facts.set(cid, {
      canonical_id: cid,
      title_ar: (p.display_name_ar as string) ?? null,
      title_en: (p.display_name_en as string) ?? null,
      price: p.lowest_price != null ? Math.round(Number(p.lowest_price)) : null,
      store: (p.cheapest_store as string) ?? null,
      store_count: Number(p.store_count ?? 0) || 0,
      image_url: (p.image_url as string) ?? null,
      observed_at: (p.last_observed_at as string) ?? null,
      go_url: goByCanon.get(cid) ?? null,
    });
  }

  const snapshot = assembleSnapshot(req, facts, new Date());
  if (!snapshot) return NextResponse.json({ error: "nothing_to_share" }, { status: 400 });

  const token = randomBytes(16).toString("hex");     // 128-bit capability token
  const ownerKey = randomBytes(16).toString("hex");  // feedback-readback gate
  const isTest = request.cookies.get("tw_test")?.value === "1";
  const ins = await sb.from("shared_home_plans").insert({
    token, owner_key: ownerKey, locale: req.locale, snapshot, is_test: isTest,
  });
  if (ins?.error) return NextResponse.json({ error: "store_failed" }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://tawveeri.com";
  // Referral-loop follow-up (2026-08-25) — the code is a derived slice of the token ALREADY
  // generated above, never a new stored value (see referral-link.ts's own header). Once a
  // recipient opens this URL, the globally-mounted CampaignCapture picks up utm_content for
  // free — no new capture code, no new table.
  const refCode = deriveReferralCode(token);
  return NextResponse.json({
    token,
    owner_key: ownerKey,
    url: appendReferralParams(`${base}/${req.locale}/plan/${token}`, "home_mission_share", refCode),
    expires_days: 30,
  });
}
