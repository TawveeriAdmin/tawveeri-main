// src/app/go/[offerId]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tawveeri Redirect Layer — every exit from Tawveeri passes through here.
//   1. resolve the offer from normalized_product_observations
//   2. resolve its RetailerProvider (registry) and build the monetized, attributed
//      exit link via the provider framework (ADR-085) — the SINGLE affiliate path,
//      replacing the old in-route AFFILIATE_RULES / affiliate-config / normalizeStoreUrl
//      tag divergence. Amazon → tawveeri-21 + ascsubtag; others per their config.
//   3. record the click (offer, program, tag, sub_id, source) in outbound_clicks
//   4. 302 to the store.
// Adding/adjusting an affiliate program is now a change in src/lib/providers, not here.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { buildOfferExitLink, getProviderByStoreId } from "@/lib/providers";

// A measured exit is per-request and must never be cached (each hit records an
// outbound click and resolves the current offer URL). Force dynamic + Node runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  const { offerId } = params;
  const home = () => NextResponse.redirect(new URL("/", req.url), 302);

  if (!offerId || !UUID_RE.test(offerId)) return home();

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const { data: offer, error } = await supabase
    .from("normalized_product_observations")
    .select("id, store_id, canonical_product_id, normalized_payload")
    .eq("id", offerId)
    .maybeSingle();

  const rawUrl = (offer?.normalized_payload as Record<string, unknown> | undefined)?._url as string | undefined;
  if (error || !offer || !rawUrl) return home();

  // Pre-generate an opaque per-click sub-id so the redirect stays await-free while
  // still tying this click to a future network-reported conversion (ascsubtag etc.).
  const subId = randomUUID().replace(/-/g, "").slice(0, 24);

  // Channel attribution: ?source=mobile|web|product_page|agent|… (validated, defaulted).
  const rawSource = req.nextUrl.searchParams.get("source") || "product_page";
  const source = /^[a-z_]{1,32}$/.test(rawSource) ? rawSource : "product_page";

  const provider = getProviderByStoreId(offer.store_id);
  const link = buildOfferExitLink(provider, rawUrl, offer.store_id ?? "", { clickId: subId, source });

  // Never 302 to a non-absolute destination (legacy relative URL) — that would 500.
  if (!/^https?:\/\//i.test(link.url)) return home();

  // Fire-and-forget click record — never block or fail the exit on the write.
  supabase
    .from("outbound_clicks")
    .insert({
      offer_id: offer.id,
      canonical_product_id: offer.canonical_product_id,
      store_name: offer.store_id,
      destination_url: link.url,
      affiliate_program: link.program,
      affiliate_tag: link.tag ?? null,
      sub_id: subId,
      source,
      user_agent: req.headers.get("user-agent") ?? null,
      referrer: req.headers.get("referer") ?? null,
    })
    .then(({ error: e }) => { if (e) console.error("outbound_clicks insert failed:", e.message); });

  return NextResponse.redirect(link.url, 302);
}
