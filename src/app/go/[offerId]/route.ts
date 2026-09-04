// src/app/go/[offerId]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tawveeri Redirect Layer — every exit from Tawveeri passes through here.
//   1. resolve the offer from normalized_product_observations
//   2. resolve its RetailerProvider (registry) and build the monetized, attributed
//      exit link via the provider framework (ADR-085) — the SINGLE affiliate path,
//      replacing the old in-route AFFILIATE_RULES / affiliate-config / normalizeStoreUrl
//      tag divergence. Amazon → tawveeri0f-21 + ascsubtag; others per their config.
//   3. record the click (offer, program, tag, sub_id, source) in outbound_clicks
//   4. 302 to the store.
// Adding/adjusting an affiliate program is now a change in src/lib/providers, not here.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { buildOfferExitLink, getProviderByStoreId } from "@/lib/providers";
import { normalizeExitUrl, isNonProductionExitUrl } from "@/lib/retailers/exit-url";
import { getBaseUrl } from "@/lib/seo/metadata";
import { isKnownBotUserAgent } from "@/lib/analytics/bot-detection";
import { verifyGoToken } from "@/lib/analytics/go-token";

// A measured exit is per-request and must never be cached (each hit records an
// outbound click and resolves the current offer URL). Force dynamic + Node runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Session + campaign identity carried by cookies (ADR-244). The tw_sid cookie is the
 *  same anonymous id track.ts keeps in localStorage; tw_campaign is the same utm set
 *  campaign.ts keeps in sessionStorage. Reading them here lets the exit ledger itself
 *  answer "which session/content produced this exit" — CONFIRMED, not estimated. */
function readAttribution(req: NextRequest): { sessionId: string | null; campaign: Record<string, string> | null } {
  const sessionId = req.cookies.get("tw_sid")?.value?.slice(0, 64) || null;
  let campaign: Record<string, string> | null = null;
  try {
    const raw = req.cookies.get("tw_campaign")?.value;
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
      const pick = (k: string, n: number) => (typeof parsed[k] === "string" ? (parsed[k] as string).slice(0, n) : undefined);
      const c = {
        utm_source: pick("utm_source", 32), utm_medium: pick("utm_medium", 32),
        utm_campaign: pick("utm_campaign", 64), utm_content: pick("utm_content", 64),
        utm_term: pick("utm_term", 64),
      };
      if (c.utm_source) campaign = Object.fromEntries(Object.entries(c).filter(([, v]) => v)) as Record<string, string>;
    }
  } catch { /* malformed cookie → no campaign, never an error */ }
  return { sessionId, campaign };
}

export async function GET(req: NextRequest, props: { params: Promise<{ offerId: string }> }) {
  const params = await props.params;
  const { offerId } = params;
  // MEASURED DEFECT (2026-07-30): this was `new URL("/", req.url)`. Behind Railway's proxy
  // `req.url` is the INTERNAL bind address, so an unresolvable exit returned
  //   302 location: https://0.0.0.0:8080/
  // — an unreachable host, not our homepage. Verified live before the fix.
  //
  // Rate, measured rather than assumed: 1 malformed link in 695 rendered exits (0.14%) across
  // eight categories. An earlier SQL estimate of 28.4% was the WRONG INSTRUMENT — it grouped
  // price_history by raw `store_name`, while this route's caller resolves each row to an
  // approved retailer slug first, collapsing duplicate name variants (أمازون / amazon /
  // numeric ids); within a collapsed slug the latest row nearly always carries an id.
  //
  // The destination is always the real homepage, from the configured public origin — never
  // req.url, which is only correct when the process is addressed directly.
  const home = () => NextResponse.redirect(new URL("/", getBaseUrl()), 302);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // ADR-244 — STOREFRONT exits: /go/ps_<product_store_id>. Before this, the storefront
  // product page (and checkout) exited via a client-side legacy path that bypassed this
  // route entirely: no outbound_clicks row, no sub_id, no affiliate reconciliation hook,
  // and a background writer polluting retailer URLs with click_id/user_id params. Same
  // provider framework, same ledger, one exit truth.
  let resolved: { offerId: string | null; productStoreId: string | null; storeId: number | string; canonicalId: string | null; rawUrl: string } | null = null;
  if (offerId?.startsWith("ps_") && UUID_RE.test(offerId.slice(3))) {
    const psId = offerId.slice(3);
    // NOTE: System A's product_stores has NO affiliate_url column (that was a System-B
    // shape — ARCHITECTURE-RECONCILIATION §4). product_url is the offer URL; affiliate
    // params are applied by the provider framework below, never read from the row.
    const { data: ps } = await supabase
      .from("product_stores")
      .select("id, store_id, product_url, products(canonical_product_id)")
      .eq("id", psId)
      .maybeSingle();
    const productRec = Array.isArray((ps as Record<string, unknown> | null)?.products)
      ? (ps as { products: { canonical_product_id: string | null }[] }).products[0]
      : (ps as { products?: { canonical_product_id: string | null } } | null)?.products;
    const url = (ps as { product_url?: string | null } | null)?.product_url;
    if (ps && url) {
      resolved = {
        offerId: null,
        productStoreId: (ps as { id: string }).id,
        storeId: (ps as { store_id: number }).store_id,
        canonicalId: productRec?.canonical_product_id ?? null,
        rawUrl: url,
      };
    }
  } else if (offerId && UUID_RE.test(offerId)) {
    const { data: offer, error } = await supabase
      .from("normalized_product_observations")
      .select("id, store_id, canonical_product_id, normalized_payload")
      .eq("id", offerId)
      .maybeSingle();
    const rawUrl = (offer?.normalized_payload as Record<string, unknown> | undefined)?._url as string | undefined;
    if (!error && offer && rawUrl) {
      resolved = { offerId: offer.id, productStoreId: null, storeId: offer.store_id, canonicalId: offer.canonical_product_id, rawUrl };
    }
  }
  if (!resolved) return home();

  // Pre-generate an opaque per-click sub-id so the redirect stays await-free while
  // still tying this click to a future network-reported conversion (ascsubtag etc.).
  const subId = randomUUID().replace(/-/g, "").slice(0, 24);

  // Channel attribution: ?source=mobile|web|product_page|agent|… (validated, defaulted).
  const rawSource = req.nextUrl.searchParams.get("source") || "product_page";
  const source = /^[a-z_]{1,32}$/.test(rawSource) ? rawSource : "product_page";

  // ADR-286, CORRECTED 2026-09-03 (adversarial-test gate found the original label overclaimed
  // what this evidence proves): `gt` is minted server-side by issueGoToken() wherever we
  // render this exact `/go/<offerId>` href in a real page/API response — but ANY client that
  // fetches the same public API/page response (a crawler, curl, a scraper — no click, no JS,
  // no session required) receives an identically valid token. A valid `gt` therefore proves
  // ONLY that our own server minted this specific link recently (ORIGIN/AUTHENTICITY — rules
  // out ID-guessing and stale/copied links) — it does NOT prove a deliberate interaction
  // occurred (INTERACTION/INTENT), which is why the classification below is named
  // `render_token_valid`, not `first_party_ui_interaction`. The only interaction-adjacent
  // signal that actually requires a real onClick to fire is the existing `track('go_click',
  // …)` POST every current handler already sends (advisor-answer.tsx, store-comparison-
  // panel.tsx, product-card.tsx) — but it lands in `usage_events`, uncorrelated with this
  // table today. A true `first_party_ui_interaction` classification requires a read-time join
  // between `outbound_clicks` and a matching `usage_events.go_click` row (same session_id,
  // close timestamps — the same shape as the existing ADR-214 campaign-attribution join) —
  // NOT implemented this pass; scoped as explicit follow-up, not silently assumed. A missing/
  // expired/mismatched token NEVER blocks or alters the redirect — navigation stays fail-open
  // — it only changes how the resulting ledger row is CLASSIFIED. Gated behind
  // ENABLE_GO_INTERACTION_PROVENANCE (default off) so this can deploy independently of migration
  // 45 (scripts/database/45-outbound-clicks-interaction-provenance.sql) actually being applied —
  // when the flag is off, the field is omitted from the insert entirely, so an unapplied
  // migration can never turn into a broken/rejected insert on every real redirect.
  const provenanceEnabled = process.env.ENABLE_GO_INTERACTION_PROVENANCE === "1";
  const goTokenValid = provenanceEnabled
    ? verifyGoToken(offerId, req.nextUrl.searchParams.get("gt")).valid
    : null;
  const interactionProvenance: "render_token_valid" | "raw_request" | null =
    provenanceEnabled ? (goTokenValid ? "render_token_valid" : "raw_request") : null;

  // ADR-286 (second correction pass) — `iid`, if present, is the client-generated id from
  // src/lib/analytics/interaction.ts. Stored VERBATIM, UNVALIDATED — this route does not look
  // it up or use it to classify anything. "Was this navigation tied to a proven interaction"
  // is answered later, at READ time, by an exact join against first_party_interactions
  // (migration 46) — never by trusting mere possession of an id string here. Gated behind the
  // SAME provenanceEnabled flag as the token above (both migration 45's and 46's columns ship
  // in the same deploy) so an unapplied migration can never turn into a broken insert.
  const rawInteractionId = req.nextUrl.searchParams.get("iid");
  const interactionId =
    provenanceEnabled && rawInteractionId && /^[A-Za-z0-9_-]{8,64}$/.test(rawInteractionId)
      ? rawInteractionId
      : null;

  // ADR-259 — MERCHANT-DESTINATION TRUTH, enforced at the single exit boundary.
  //
  // Every consumer exit (storefront card, Home purchase checklist, retailer CTA, agent)
  // passes through this route, so repairing the destination here covers every surface at
  // once and cannot be forgotten by a new one. Measured 2026-08-18: 49,918 normalized
  // observations carried Almanea's DEV host `m.dev-almanea.com` — the table this route
  // resolves from — and on an 8-URL production sample that host already 404'd twice while
  // the canonical shape resolved 8/8. Read-side only: the observation keeps its evidence,
  // the consumer gets a destination that works.
  const locale = req.cookies.get("NEXT_LOCALE")?.value === "en" ? "en" : "ar";
  const exitUrl = normalizeExitUrl(resolved.rawUrl, locale) ?? resolved.rawUrl;

  // A destination we could not repair to a production host is refused, never guessed.
  // Sending a Saudi shopper to a merchant's development environment is not an exit we are
  // willing to make, and inventing a URL would be worse. Unknown beats incorrect.
  if (isNonProductionExitUrl(exitUrl)) {
    console.error("go: refused non-production merchant destination", {
      storeId: resolved.storeId,
      host: (() => { try { return new URL(exitUrl).host; } catch { return "unparseable"; } })(),
    });
    return home();
  }

  const provider = getProviderByStoreId(resolved.storeId);
  const link = buildOfferExitLink(provider, exitUrl, String(resolved.storeId ?? ""), { clickId: subId, source });

  // Never 302 to a non-absolute destination (legacy relative URL) — that would 500.
  if (!/^https?:\/\//i.test(link.url)) return home();

  // Real vs test exit (Part 6): a tester carries the `tw_test` cookie (?test=1); bots by UA;
  // `tw_admin` (ADR-216) marks an authenticated admin's own browsing, set only inside the
  // already-role-gated /admin layout — never fabricated from a self-reported flag.
  const ua = req.headers.get("user-agent") ?? "";
  // ADR-282: bot-UA matching extracted to src/lib/analytics/bot-detection.ts (independently
  // tested) — widened after the 2026-08-31 anomaly investigation
  // (docs/report/AUGUST-2026-FOUNDER-REVIEW.md §12) found the old list missed a bot UA that
  // WAS present that day. A false positive here only mis-labels a redirect as TEST; it never
  // blocks or alters the actual redirect.
  const isTest = req.cookies.get("tw_test")?.value === "1" ||
    req.cookies.get("tw_admin")?.value === "1" ||
    req.nextUrl.searchParams.get("tw_test") === "1" ||
    isKnownBotUserAgent(ua);

  // Session + campaign identity (ADR-244) — the ledger itself now answers
  // "which session and which piece of content produced this exit."
  const { sessionId, campaign } = readAttribution(req);

  // ADR-282: IP capture only (migration 43) — a pure additive data point for investigating
  // traffic patterns like the 2026-08-31/09-01 no-session redirect anomalies
  // (docs/report/AUGUST-2026-FOUNDER-REVIEW.md §12). Does NOT gate, throttle, or alter the
  // redirect in any way.
  //
  // CORRECTED same-day (2026-09-01): the first deploy of this trusted x-forwarded-for's
  // first hop, on the assumption Railway's own proxy was the only hop. Checking the IPs it
  // actually captured showed EVERY one falling inside Cloudflare's published edge ranges
  // (104.16.0.0/13, 172.64.0.0/13, 162.158.0.0/15) — tawveeri.com is proxied through
  // Cloudflare in front of Railway, so x-forwarded-for's first entry was Cloudflare's OWN
  // edge-node hop, not the visitor. Cloudflare's own docs are explicit that `CF-Connecting-IP`
  // (which Cloudflare sets itself, stripping/overwriting any client-supplied value — it cannot
  // be spoofed by the request) is the authoritative true-client-IP header when Cloudflare
  // fronts the origin; x-forwarded-for stays as a fallback for any request that somehow
  // reaches this route without going through Cloudflare (e.g. a direct Railway origin hit).
  const ipAddress = req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || null;

  // Fire-and-forget click record — never block or fail the exit on the write.
  supabase
    .from("outbound_clicks")
    .insert({
      offer_id: resolved.offerId,
      product_store_id: resolved.productStoreId,
      canonical_product_id: resolved.canonicalId,
      store_name: String(resolved.storeId ?? ""),
      destination_url: link.url,
      affiliate_program: link.program,
      affiliate_tag: link.tag ?? null,
      sub_id: subId,
      source,
      session_id: sessionId,
      campaign,
      is_test: isTest,
      user_agent: ua || null,
      referrer: req.headers.get("referer") ?? null,
      ip_address: ipAddress,
      // Omitted entirely (not even `null`) unless the flag is on — see the ADR-286 comments
      // above. Fields only exist in the schema after migrations 45/46 are applied.
      ...(interactionProvenance ? { interaction_provenance: interactionProvenance } : {}),
      ...(interactionId ? { interaction_id: interactionId } : {}),
    })
    .then(({ error: e }) => { if (e) console.error("outbound_clicks insert failed:", e.message); });

  return NextResponse.redirect(link.url, 302);
}
