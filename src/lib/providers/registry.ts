// src/lib/providers/registry.ts
// The pluggable RetailerProvider registry + feature flags (ADR-085).
//
// Each of the current 8 production stores is a provider. Today every store is sourced
// by `scraper`; Amazon is monetized by the Amazon Associates network (tawveeri-21) and
// Noon by the generic `param` network. Retailers with no known program are `direct`
// (unknown beats incorrect — we never invent a tag). Adding a retailer or flipping its
// sourcing to an official feed is a data change here, not a code change elsewhere.
//
// Feature flags (env, resolved at read time — no restart-coupling in the type):
//   PROVIDER_<SLUG>_ENABLED   = 0 | 1
//   PROVIDER_<SLUG>_SOURCING  = scraper | official_feed | affiliate_feed | api | csv_xml
//   PROVIDER_<SLUG>_AFFILIATE = amazon | param | direct   (forces the network)
import type { RetailerProvider, SourcingMode, AffiliateNetworkId } from "./types";

const BASE: Record<string, RetailerProvider> = {
  jarir:       { slug: "jarir",       storeId: 1, displayName: "Jarir",             displayNameAr: "جرير",             enabled: true, sourcing: "scraper", affiliate: null },
  amazon:      { slug: "amazon",      storeId: 2, displayName: "Amazon SA",         displayNameAr: "أمازون",           enabled: true, sourcing: "scraper", affiliate: { network: "amazon", trackingId: "tawveeri-21", supportsSubId: true, subIdParam: "ascsubtag" } },
  noon:        { slug: "noon",        storeId: 3, displayName: "Noon",              displayNameAr: "نون",              enabled: true, sourcing: "scraper", affiliate: { network: "param", trackingId: "noon", params: [{ name: "utm_source", value: "tawveeri" }, { name: "utm_medium", value: "affiliate" }, { name: "utm_campaign", value: "DNC160" }], supportsSubId: true, subIdParam: "utm_content" } },
  extra:       { slug: "extra",       storeId: 4, displayName: "eXtra",             displayNameAr: "اكسترا",           enabled: true, sourcing: "scraper", affiliate: null },
  almanea:     { slug: "almanea",     storeId: 5, displayName: "Almanea",           displayNameAr: "المنيع",           enabled: true, sourcing: "scraper", affiliate: null },
  samsung_ksa: { slug: "samsung_ksa", storeId: 6, displayName: "Samsung Saudi",     displayNameAr: "سامسونج السعودية", enabled: true, sourcing: "scraper", affiliate: null },
  shaker:      { slug: "shaker",      storeId: 7, displayName: "Shaker",            displayNameAr: "شاكر",             enabled: true, sourcing: "scraper", affiliate: null },
  swsg:        { slug: "swsg",        storeId: 8, displayName: "SWSG",              displayNameAr: "الشتاء والصيف",    enabled: true, sourcing: "scraper", affiliate: null },
};

const BY_ID: Record<number, string> = Object.fromEntries(Object.values(BASE).map((p) => [p.storeId, p.slug]));

const bool = (v: string | undefined, dflt: boolean) => (v === undefined ? dflt : v === "1" || v.toLowerCase() === "true");

/** Apply env feature-flag overrides to a base provider (pure; reads process.env). */
function withFlags(p: RetailerProvider): RetailerProvider {
  const S = p.slug.toUpperCase();
  const enabled = bool(process.env[`PROVIDER_${S}_ENABLED`], p.enabled);
  const sourcing = (process.env[`PROVIDER_${S}_SOURCING`] as SourcingMode) || p.sourcing;
  const affNet = process.env[`PROVIDER_${S}_AFFILIATE`] as AffiliateNetworkId | undefined;
  let affiliate = p.affiliate;
  if (affNet === "direct") affiliate = null;
  else if (affNet && p.affiliate) affiliate = { ...p.affiliate, network: affNet };
  return { ...p, enabled, sourcing, affiliate };
}

/** Resolve a provider by slug (feature-flags applied), or null if unknown. */
export function getProvider(slug: string | null | undefined): RetailerProvider | null {
  if (!slug) return null;
  const base = BASE[slug.toLowerCase()];
  return base ? withFlags(base) : null;
}

/** Resolve a provider by numeric store_id (feature-flags applied), or null. */
export function getProviderByStoreId(storeId: number | string | null | undefined): RetailerProvider | null {
  const id = Number(storeId);
  if (!Number.isFinite(id)) return null;
  return getProvider(BY_ID[id]);
}

/** All enabled providers (feature-flags applied). */
export function listProviders(): RetailerProvider[] {
  return Object.values(BASE).map(withFlags).filter((p) => p.enabled);
}
