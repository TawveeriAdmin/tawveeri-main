// src/lib/providers/networks/direct.ts
// The null affiliate network (ADR-085): a retailer with no program exits to the
// plain, normalized store URL. This is a first-class option, not a failure —
// "unknown beats incorrect": we never fabricate a tracking parameter we don't have.
import type { AffiliateNetwork, AffiliateConfig, LinkContext, AffiliateLinkResult } from "../types";

export const directNetwork: AffiliateNetwork = {
  id: "direct",
  build(url: URL, _config: AffiliateConfig, _ctx: LinkContext): AffiliateLinkResult {
    return { url: url.toString(), network: "direct", program: "direct", tag: null, subId: null };
  },
};
