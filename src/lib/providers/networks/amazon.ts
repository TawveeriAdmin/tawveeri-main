// src/lib/providers/networks/amazon.ts
// REFERENCE affiliate-network adapter: Amazon Associates (ADR-085).
//
// Amazon is the first reference implementation because the program is already live
// (tracking id `tawveeri-21`). It demonstrates every capability the framework must
// support for any future network:
//   • advanced link generation — collapse a noisy PDP URL to the canonical
//     `/dp/<ASIN>` deep link (shorter, stable, higher-trust);
//   • affiliate tag injection — `tag=tawveeri-21` (never clobbered if already present);
//   • per-click sub-id attribution — `ascsubtag=<clickId>` ties the outbound click to
//     a future Amazon-reported conversion (Amazon allows one sub-tag up to 100 chars).
//
// Pure + never throws: on any parsing doubt it returns a still-valid tagged URL.
import type { AffiliateNetwork, AffiliateConfig, LinkContext, AffiliateLinkResult } from "../types";

const ASIN_RE = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;
const AMAZON_HOST_RE = /(^|\.)amazon\.[a-z.]+$/i;

/** True when the host is an Amazon marketplace (amazon.sa, amazon.com, …). */
export function isAmazonHost(host: string): boolean {
  return AMAZON_HOST_RE.test(host.toLowerCase());
}

/** Sub-ids must be short, opaque, URL-safe. Amazon caps ascsubtag at 100 chars. */
function sanitizeSubId(clickId: string | number | undefined): string | null {
  if (clickId === undefined || clickId === null) return null;
  const s = String(clickId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  return s.length ? s : null;
}

export const amazonNetwork: AffiliateNetwork = {
  id: "amazon",
  build(url: URL, config: AffiliateConfig, ctx: LinkContext): AffiliateLinkResult {
    const tag = (config.trackingId && config.trackingId.trim()) || "tawveeri-21";
    const subId = sanitizeSubId(ctx.clickId);
    try {
      const asin = url.pathname.match(ASIN_RE)?.[1]?.toUpperCase();
      // Canonical deep link when we can identify the ASIN; else keep the original path.
      const out = asin
        ? new URL(`${url.protocol}//${url.host}/dp/${asin}`)
        : new URL(url.toString());
      // Drop pre-existing tracking noise on the canonical form so our tag is unambiguous.
      if (asin) out.search = "";
      if (!out.searchParams.has("tag")) out.searchParams.set("tag", tag);
      if (subId) out.searchParams.set(config.subIdParam || "ascsubtag", subId);
      return { url: out.toString(), network: "amazon", program: "amazon", tag, subId };
    } catch {
      // Never break a measured exit — fall back to a best-effort tag append.
      const sep = url.toString().includes("?") ? "&" : "?";
      return { url: `${url.toString()}${sep}tag=${encodeURIComponent(tag)}`, network: "amazon", program: "amazon", tag, subId };
    }
  },
};
