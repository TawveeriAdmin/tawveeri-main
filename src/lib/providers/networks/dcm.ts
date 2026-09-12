// src/lib/providers/networks/dcm.ts
// DCM Links Hub affiliate network adapter (Samsung KSA). Unlike amazon/param — which
// decorate the SAME destination URL with query params — DCM is a WRAPPING redirect
// network: the final URL is a tracking-domain endpoint that carries the real destination
// inside an encoded `url` parameter.
//
// Format reverse-engineered from a real link the founder generated in the DCM dashboard
// and manually verified (redirected correctly to the exact Samsung PDP) — reproduced
// byte-for-byte, never guessed:
//
//   https://go.urtrackinglink.com/aff_c?offer_id=1960&aff_id=166088&url=<url>&source=tawveeri
//
// <url> is NOT a single encodeURIComponent pass. Decomposed from the proven example:
//   encodeURIComponent(encodeURIComponent(`${destination}?sid=`)) + encodeURIComponent('{transaction_id}-{affiliate_id}')
// i.e. "destination + ?sid=" is double-URL-encoded, and DCM's own postback macro
// `{transaction_id}-{affiliate_id}` is appended after that, single-encoded. The macro is
// substituted by DCM's OWN redirect service at click time — never by us, and never with
// our own per-click sub-id (DCM exposes no separate sub-id slot in the proven format, so
// LinkContext.clickId is not embedded here; ADR-085's other networks carry it themselves).
import type { AffiliateNetwork, AffiliateConfig, LinkContext, AffiliateLinkResult } from "../types";

const DCM_BASE = "https://go.urtrackinglink.com/aff_c";
const DCM_SID_MACRO = "{transaction_id}-{affiliate_id}";

function paramValue(params: { name?: string; value: string }[] | undefined, name: string): string | null {
  return params?.find((p) => p.name === name)?.value ?? null;
}

export const dcmNetwork: AffiliateNetwork = {
  id: "dcm",
  build(url: URL, config: AffiliateConfig, _ctx: LinkContext): AffiliateLinkResult {
    const offerId = config.trackingId?.trim();
    const affId = paramValue(config.params, "aff_id");
    const source = paramValue(config.params, "source") || "tawveeri";

    // Never emit a half-built tracking link — a DCM config missing its required ids is
    // not distinguishable from misconfiguration, and "unknown beats incorrect" means we
    // fall back to a plain, honest direct link rather than a broken-looking affiliate one.
    if (!offerId || !affId) {
      return { url: url.toString(), network: "direct", program: "direct", tag: null, subId: null };
    }

    try {
      const destination = `${url.toString()}${url.search ? "&" : "?"}sid=`;
      const doubleEncodedDestination = encodeURIComponent(encodeURIComponent(destination));
      const urlParam = doubleEncodedDestination + encodeURIComponent(DCM_SID_MACRO);
      const out =
        `${DCM_BASE}?offer_id=${encodeURIComponent(offerId)}` +
        `&aff_id=${encodeURIComponent(affId)}` +
        `&url=${urlParam}` +
        `&source=${encodeURIComponent(source)}`;
      return { url: out, network: "dcm", program: "samsung_ksa", tag: offerId, subId: null };
    } catch {
      // Never break a measured exit — fall back to the untagged destination.
      return { url: url.toString(), network: "direct", program: "direct", tag: null, subId: null };
    }
  },
};
