// src/app/go/[offerId]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tawveeri Redirect Layer — كل خروج من توفيري يمر من هنا
//   1. جلب العرض من normalized_product_observations
//   2. تطبيع الرابط (normalizeStoreUrl) — حماية من روابط dev القديمة
//   3. حقن كود العمولة حسب المتجر (Amazon / Noon / مباشر)
//   4. تسجيل النقرة في outbound_clicks
//   5. التحويل 302 للمتجر
// إضافة برنامج أفلييت جديد = تعديل AFFILIATE_RULES فقط.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeStoreUrl } from "@/lib/catalog/normalizeStoreUrl";

// A measured exit is per-request and must never be cached (each hit records an
// outbound click and resolves the current offer URL). Force dynamic + Node runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const AFFILIATE_RULES: { match: (host: string) => boolean; program: string; apply: (url: URL) => URL }[] = [
  {
    match: (host) => host.includes("amazon."),
    program: "amazon",
    apply: (url) => { url.searchParams.set("tag", "tawveeri-21"); return url; },
  },
  {
    match: (host) => host.includes("noon.com"),
    program: "noon",
    apply: (url) => { url.searchParams.set("utm_source", "tawveeri"); url.searchParams.set("utm_medium", "affiliate"); url.searchParams.set("utm_campaign", "DNC160"); return url; },
  },
];

function applyAffiliate(rawUrl: string): { finalUrl: string; program: string } {
  try {
    const url = new URL(rawUrl);
    for (const rule of AFFILIATE_RULES) {
      if (rule.match(url.hostname.toLowerCase())) {
        return { finalUrl: rule.apply(url).toString(), program: rule.program };
      }
    }
    return { finalUrl: url.toString(), program: "direct" };
  } catch {
    return { finalUrl: rawUrl, program: "direct" };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  const { offerId } = params;

  if (!offerId || !UUID_RE.test(offerId)) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const { data: offer, error } = await supabase
    .from("normalized_product_observations")
    .select("id, store_id, canonical_product_id, normalized_payload")
    .eq("id", offerId)
    .maybeSingle();

  const rawUrl = (offer?.normalized_payload as any)?._url as string | undefined;

  if (error || !offer || !rawUrl) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  // حماية مركزية: تطبيع الرابط حتى لو كانت البيانات المحفوظة قديمة (dev)
  const cleanUrl = normalizeStoreUrl(offer.store_id ?? "", rawUrl) ?? rawUrl;

  const { finalUrl, program } = applyAffiliate(cleanUrl);

  // Defensive: a non-absolute destination (legacy relative store URL) would make
  // NextResponse.redirect throw (500). Never crash a measured exit — fall back to
  // home. The write path now stores absolute URLs (pickBestUrl), so this is a
  // guard for legacy rows only.
  if (!/^https?:\/\//i.test(finalUrl)) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  // Channel attribution: ?source=mobile|web|product_page|... (validated, defaulted).
  const rawSource = req.nextUrl.searchParams.get("source") || "product_page";
  const source = /^[a-z_]{1,32}$/.test(rawSource) ? rawSource : "product_page";

  supabase.from("outbound_clicks").insert({
    offer_id: offer.id,
    canonical_product_id: offer.canonical_product_id,
    store_name: offer.store_id,
    destination_url: finalUrl,
    affiliate_program: program,
    source,
    user_agent: req.headers.get("user-agent") ?? null,
    referrer: req.headers.get("referer") ?? null,
  }).then(({ error: e }) => { if (e) console.error("outbound_clicks insert failed:", e.message); });

  return NextResponse.redirect(finalUrl, 302);
}