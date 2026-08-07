// src/lib/providers/link.ts
// buildOfferExitLink — the SINGLE source of truth for turning a raw offer URL into a
// monetized, attributed exit (ADR-085). Replaces the three previously-divergent
// affiliate paths (the /go route's AFFILIATE_RULES, transactions/affiliate-config,
// and the tag injection buried in normalizeStoreUrl).
//
// Flow: normalize the URL → resolve the affiliate config (from the RetailerProvider,
// else a host-based fallback so legacy/provider-less offers still monetize correctly)
// → dispatch to the network adapter → attach the per-click sub-id from LinkContext.
import { normalizeStoreUrl } from "@/lib/catalog/normalizeStoreUrl";
import type { AffiliateConfig, AffiliateNetwork, AffiliateLinkResult, LinkContext, RetailerProvider } from "./types";
import { amazonNetwork, isAmazonHost } from "./networks/amazon";
import { paramNetwork } from "./networks/param";
import { directNetwork } from "./networks/direct";

const NETWORKS: Record<string, AffiliateNetwork> = {
  amazon: amazonNetwork,
  param: paramNetwork,
  direct: directNetwork,
};

/**
 * Host-based fallback config, used when no RetailerProvider is supplied (legacy
 * offers, or an offer whose store did not resolve). Evidence-first: we only apply a
 * program we can prove from the destination host — otherwise `direct`.
 */
export function hostFallbackConfig(host: string): AffiliateConfig {
  const h = host.toLowerCase();
  if (isAmazonHost(h)) {
    return { network: "amazon", trackingId: "tawveeri0f-21", supportsSubId: true, subIdParam: "ascsubtag" };
  }
  if (h.includes("noon.com")) {
    // Kept identical to the registry's noon entry (ADR-224) — this path only fires for a
    // raw Noon URL with no resolved provider, but must monetize the same way either way.
    return {
      network: "param",
      trackingId: "noon",
      params: [
        { name: "utm_source", value: "C1000264L" },
        { name: "utm_medium", value: "AFFfbc721aa80c8" },
        { name: "utm_campaign", value: "CMP2ce0b63a6a1anoon" },
        { name: "adjust_deeplink_js", value: "1" },
      ],
      supportsSubId: true,
      subIdParam: "utm_content",
    };
  }
  return { network: "direct" };
}

const DIRECT_RESULT = (url: string): AffiliateLinkResult => ({ url, network: "direct", program: "direct", tag: null, subId: null });

/**
 * Build the final exit URL + attribution for an offer.
 * @param provider  the resolved RetailerProvider, or null to use host fallback.
 * @param rawUrl    the offer's raw destination URL (from the observation payload).
 * @param storeName store label used by normalizeStoreUrl (id or name; may be "").
 * @param ctx       per-click attribution context (clickId, source).
 * Never throws; returns a `direct` result for an unusable URL.
 */
export function buildOfferExitLink(
  provider: RetailerProvider | null,
  rawUrl: string | null,
  storeName: string | number | null,
  ctx: LinkContext = {},
): AffiliateLinkResult {
  if (!rawUrl) return DIRECT_RESULT("");
  const cleaned = normalizeStoreUrl(String(storeName ?? ""), rawUrl) ?? rawUrl;
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return DIRECT_RESULT(cleaned);
  }
  if (!/^https?:$/i.test(url.protocol)) return DIRECT_RESULT(cleaned);

  // Provider config wins; otherwise fall back to what the host proves.
  const config: AffiliateConfig =
    provider && provider.affiliate && provider.enabled ? provider.affiliate : hostFallbackConfig(url.hostname);

  const network = NETWORKS[config.network] ?? directNetwork;
  return network.build(url, config, ctx);
}
