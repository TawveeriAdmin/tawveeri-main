// src/lib/providers/index.ts — public surface of the Affiliate & Official Feed
// Framework (ADR-085). Import from here, not from deep paths.
export type {
  RetailerProvider, AffiliateConfig, AffiliateNetwork, AffiliateNetworkId,
  AffiliateParam, SourcingMode, LinkContext, AffiliateLinkResult,
} from "./types";
export { buildOfferExitLink, hostFallbackConfig } from "./link";
export { getProvider, getProviderByStoreId, listProviders } from "./registry";
export type { SourcingAdapter, SourcingOptions, SourcingResult } from "./sourcing/types";
export { sourceOffers, resolveSourcingAdapter } from "./sourcing/router";
export { mapFeedRecord } from "./sourcing/feed-adapter";
export type { FeedColumnMap } from "./sourcing/feed-adapter";
