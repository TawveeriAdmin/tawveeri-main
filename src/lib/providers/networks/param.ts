// src/lib/providers/networks/param.ts
// Generic query-parameter affiliate network (ADR-085). Covers the large class of
// programs that monetize by appending one or more fixed query params (Noon's
// `aff_code`, UTM campaigns, etc.) plus an optional per-click sub-id. Existing
// params are never clobbered (an explicit value on the source URL wins).
import type { AffiliateNetwork, AffiliateConfig, LinkContext, AffiliateLinkResult } from "../types";

function sanitizeSubId(clickId: string | number | undefined): string | null {
  if (clickId === undefined || clickId === null) return null;
  const s = String(clickId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  return s.length ? s : null;
}

/**
 * Which param actually carries the ATTRIBUTION CODE, in priority order.
 *
 * The recorded `tag` used to be "whichever param happened to be listed first" — position,
 * not meaning. `utm_source` leads the list for referral programs because that is where a
 * publisher/network id lives (noon: `utm_source=C1000264L`, ADR-224); `aff_code` stays
 * ahead of it for programs that use a dedicated code param.
 *
 * HISTORY WORTH KEEPING (2026-08-02): this file previously said the exit link "was always
 * correct" and called DNC160 the partner code. Both were wrong. DNC160 is a customer COUPON
 * (10% cashback, capped 25 SAR) typed at checkout — a different system in the same
 * dashboard — and we were sending it as `utm_campaign`, which matched no mechanism at all.
 * A confident comment is not evidence; the founder generating one real dashboard link
 * settled in seconds what our config had asserted for weeks.
 */
const ATTRIBUTION_PARAMS = ["aff_code", "utm_source", "utm_campaign", "tag", "ref", "affiliate", "partner"];

function attributionValue(params: { name?: string; value: string }[]): string | null {
  for (const key of ATTRIBUTION_PARAMS) {
    const hit = params.find((p) => p.name?.toLowerCase() === key);
    if (hit) return hit.value;
  }
  return params.find((p) => p.name)?.value ?? null;
}

export const paramNetwork: AffiliateNetwork = {
  id: "param",
  build(url: URL, config: AffiliateConfig, ctx: LinkContext): AffiliateLinkResult {
    const subId = sanitizeSubId(ctx.clickId);
    const firstParamValue = attributionValue(config.params ?? []);
    try {
      const out = new URL(url.toString());
      for (const p of config.params ?? []) {
        if (!p.name) continue;
        if (!out.searchParams.has(p.name)) out.searchParams.set(p.name, p.value);
      }
      if (subId && config.subIdParam) out.searchParams.set(config.subIdParam, subId);
      return { url: out.toString(), network: "param", program: config.trackingId || "affiliate", tag: firstParamValue, subId };
    } catch {
      return { url: url.toString(), network: "param", program: "direct", tag: null, subId };
    }
  },
};
