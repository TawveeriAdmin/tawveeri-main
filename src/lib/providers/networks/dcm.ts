// src/lib/providers/networks/dcm.ts
// DCM Links Hub affiliate network adapter (Samsung KSA). Unlike amazon/param — which
// decorate the SAME destination URL with query params — DCM is a WRAPPING redirect
// network: the final URL is a tracking-domain endpoint that carries the real destination
// inside an encoded `url` parameter.
//
// Format CORRECTED 2026-09-12 (ADR-341) after a real founder-observed production
// incident: a live Samsung exit landed on a blank page in mobile Safari. Live curl
// verification against go.urtrackinglink.com (not a fixture, not the founder's original
// transcript) proved DCM's redirect service decodes the `url` parameter exactly ONCE —
// fed a double-encoded value, it emits an still-percent-encoded, invalid `Location`
// header (e.g. `Location: https%3A%2F%2Fwww.samsung.com%2F...`), which is not a URI a
// browser can navigate — exactly the blank-page symptom. Fed a SINGLE-encoded value, it
// substitutes its postback macro and emits a correct, absolute `Location` header that
// resolves to a real 200 OK Samsung page. The original "byte-for-byte proven" example
// (ADR-339) matched a copy of the founder's link that had picked up an extra encoding
// pass somewhere between DCM's dashboard and being pasted here — REAL USER JOURNEY
// evidence overrides that prior transcript-matching proof, per this mission's own rule.
//
//   https://go.urtrackinglink.com/aff_c?offer_id=1960&aff_id=166088&url=<url>&source=tawveeri
//
// <url> is exactly ONE encodeURIComponent pass over `${destination}?sid=` followed by
// ONE encodeURIComponent pass over the literal macro `{transaction_id}-{affiliate_id}`
// (the macro needs its own pass only because `{`/`}` are not valid raw query characters —
// this is not a second encoding of the destination). The macro is substituted by DCM's
// OWN redirect service at click time — never by us, and never with our own per-click
// sub-id (DCM exposes no separate sub-id slot, so LinkContext.clickId is not embedded
// here; ADR-085's other networks carry it themselves).
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
      const encodedDestination = encodeURIComponent(destination);
      const urlParam = encodedDestination + encodeURIComponent(DCM_SID_MACRO);
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
