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

export const paramNetwork: AffiliateNetwork = {
  id: "param",
  build(url: URL, config: AffiliateConfig, ctx: LinkContext): AffiliateLinkResult {
    const subId = sanitizeSubId(ctx.clickId);
    let firstParamValue: string | null = null;
    try {
      const out = new URL(url.toString());
      for (const p of config.params ?? []) {
        if (!p.name) continue;
        if (firstParamValue === null) firstParamValue = p.value;
        if (!out.searchParams.has(p.name)) out.searchParams.set(p.name, p.value);
      }
      if (subId && config.subIdParam) out.searchParams.set(config.subIdParam, subId);
      return { url: out.toString(), network: "param", program: config.trackingId || "affiliate", tag: firstParamValue, subId };
    } catch {
      return { url: url.toString(), network: "param", program: "direct", tag: null, subId };
    }
  },
};
