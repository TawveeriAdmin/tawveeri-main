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
  // Almanea powers its headless storefront with a PUBLIC Algolia index (search-only keys
  // shipped in the browser bundle — public data access, not a secret). It is the cleanest,
  // richest structured source in the KSA majors (3,600+ products with brand/model/sku/
  // storage/screen_size), which improves identity resolution → more comparisons (ADR-094).
  // Sourced via the Algolia adapter; override with PROVIDER_ALMANEA_SOURCING=scraper.
  almanea:     { slug: "almanea",     storeId: 5, displayName: "Almanea",           displayNameAr: "المنيع",           enabled: true, sourcing: "api", affiliate: null, algolia: { appId: "WCK19QC65I", apiKey: "be7745237f5f94f715b088f48b1708b8", index: "prod_headless_ar_products", indexEn: "prod_headless_en_products" } },
  samsung_ksa: { slug: "samsung_ksa", storeId: 6, displayName: "Samsung Saudi",     displayNameAr: "سامسونج السعودية", enabled: true, sourcing: "scraper", affiliate: null },
  // shaker is sourced from its public WooCommerce Store API (ADR-089) — verified cleaner
  // AND more complete than the HTML scraper (585 unique bilingual products via feed vs
  // 442 distinct scraped URLs), with no anti-bot fragility. The adapter collapses the
  // WPML EN/AR translation pairs (shared SKU) into one Arabic-first bilingual offer, so
  // the feed never double-counts — the same Arabic `/product/` listing basis the existing
  // data already uses. Override with PROVIDER_SHAKER_SOURCING=scraper to fall back.
  shaker:      { slug: "shaker",      storeId: 7, displayName: "Shaker",            displayNameAr: "شاكر",             enabled: true, sourcing: "api", affiliate: null, feedUrl: "https://shakersa.com" },
  swsg:        { slug: "swsg",        storeId: 8, displayName: "SWSG",              displayNameAr: "الشتاء والصيف",    enabled: true, sourcing: "scraper", affiliate: null },
  // Salla storefronts (ADR-095) — sourced credential-free via sitemap + product JSON-LD.
  // najm.store carries mainstream appliances (Samsung/Toshiba/Fisher/Fresh) with real
  // overlap potential; blackboxksa.com is niche (camping/appliances) + its sitemap is
  // UA-gated, so it is registered config-ready but disabled pending a category-crawl fallback.
  najm:        { slug: "najm",        storeId: 9,  displayName: "Najm Alajhiza",     displayNameAr: "نجم الأجهزة",      enabled: true,  sourcing: "api", affiliate: null, salla: { origin: "https://najm.store" } },
  blackbox:    { slug: "blackbox",    storeId: 10, displayName: "BlackBox",          displayNameAr: "الصندوق الأسود",   enabled: false, sourcing: "api", affiliate: null, salla: { origin: "https://blackboxksa.com" } },
  // ADR-097 — high-overlap mainstream electronics stores onboarded via the JSON-LD
  // storefront adapter (Salla + Zid; the adapter parses /p{id} and /products/{slug}).
  // Phones (hdf/goldenstore99/mhzm/aletawik) carry standard iPhone/Samsung/Xiaomi models
  // that corroborate across stores; pcpalace is a large Dell/Lenovo/Asus/HP laptop catalog.
  hdf:          { slug: "hdf",           storeId: 11, displayName: "HDF",            displayNameAr: "اتش دي اف",        enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://hdf.com.sa" } },
  goldenstore99:{ slug: "goldenstore99", storeId: 12, displayName: "Golden Store",   displayNameAr: "جولدن ستور",      enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://goldenstore99.com" } },
  mhzm:         { slug: "mhzm",          storeId: 13, displayName: "Mhzm",           displayNameAr: "محزم",            enabled: true, sourcing: "api", affiliate: null, feedUrl: "https://shop.mhzm.sa" },
  aletawik:     { slug: "aletawik",      storeId: 14, displayName: "Aletawik",       displayNameAr: "التاوية",         enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://aletawiksa.com" } },
  // pcpalace is a ZID custom-domain store (verified 2026-07-28 via its live UCP: media.zid.store
  // logo + /api/v1/ucp binding), NOT Salla. The `salla:` field is the GENERIC Salla-OR-Zid JSON-LD
  // sourcing config (the salla-zid adapter maps both platforms — see salla-zid-adapter.test.ts,
  // which maps amnkwm.zid.store through the same field), so the field is correct; only the platform
  // name is clarified here. ADR-130.
  pcpalace:     { slug: "pcpalace",      storeId: 15, displayName: "PC Palace",      displayNameAr: "بي سي بالاس",     enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://pcpalace.com.sa" } },
  // ADR-104/106 — Sony World KSA: Saudi Sony specialist on Shopify (SAR-verified via
  // meta.json, Riyadh). Sourced credential-free via the Shopify products.json adapter.
  // No affiliate program known → `direct` exit (correct non-affiliate state, no attribution
  // contamination). Onboarded to validate the Shopify path end-to-end + add Sony category depth.
  sonyworld:    { slug: "sonyworld",     storeId: 16, displayName: "Sony World",      displayNameAr: "سوني وورلد",       enabled: true, sourcing: "api", affiliate: null, shopify: { origin: "https://sonyworld.sa" } },
  // ADR-107 — Amn Kum (امن كوم): Zid store, window-AC/kitchen-appliance overlap with our AC
  // category (MEDIUM: 75% brand, 6% model). Sourced via the Salla/Zid JSON-LD adapter (whose
  // @type match is now case-insensitive — Zid emits lowercase "product"). affiliate: null → direct exit.
  amnkwm:       { slug: "amnkwm",        storeId: 17, displayName: "Amn Kum",         displayNameAr: "امن كوم",          enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://amnkwm.zid.store" } },
  // ADR-108 — AC/home-appliance specialist cluster (Salla, storefront-API-sourced). They
  // corroborate each other on standard AC models (brand+BTU+type) → real AC comparisons.
  alnakheelk:   { slug: "alnakheelk",    storeId: 18, displayName: "Al Nakheel",      displayNameAr: "متجر النخيل",      enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://alnakheelk.com" } },
  // DISABLED 2026-07-28 (ADR-130): alsfeerzone has SHUT DOWN. Its Salla listing salla.sa/alsfeerzone
  // returns HTTP 410 Gone and its custom domain alsfeerzone.com no longer resolves (DNS fail) — so
  // every scheduled ingest silently failed against a dead origin. Production footprint = 0 offers, so
  // disabling loses nothing. Left registered (not deleted) with the dead origin preserved for history;
  // unknown-beats-incorrect → we do NOT guess a replacement domain. Re-enable only if the store returns.
  alsfeerzone:  { slug: "alsfeerzone",   storeId: 19, displayName: "Al Safeer Zone",  displayNameAr: "السفير زون",       enabled: false, sourcing: "api", affiliate: null, salla: { origin: "https://alsfeerzone.com" } },
  // ADR-110 — category-gap fill: VACUUM (202 single-store canonicals, 3% comparable) + home
  // appliances. alhowaish carries Hitachi vacuums that corroborate our single-store units;
  // alduaalbarq (Zid) adds vacuums/fridges/appliances. Salla-API / Zid-JSON-LD sourced.
  alhowaish:    { slug: "alhowaish",     storeId: 20, displayName: "Al Howaish",      displayNameAr: "الهويش للأجهزة",   enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://salla.sa/alhowaish" } },
  alduaalbarq:  { slug: "alduaalbarq",   storeId: 21, displayName: "Al Daw Al Bariq", displayNameAr: "الضوء البارق",     enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://shrkhaldwaalbarqlltjarh.zid.store" } },
  // ADR-118 — kitchen-appliance gap fill (air_fryer/oven/blender ≈ 0 comparisons). eazyworld7
  // (Salla) carries Koolen kitchen line (ovens/grills/heaters) that corroborate on standard models.
  eazyworld:    { slug: "eazyworld",     storeId: 22, displayName: "Eazy World",     displayNameAr: "إيزي وورلد",       enabled: true, sourcing: "api", affiliate: null, salla: { origin: "https://eazyworld7.com" } },
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
