// src/lib/providers/types.ts
// Provider framework core types (ADR-085). A RetailerProvider binds a retailer to
// two orthogonal, pluggable adapters: SOURCING (how offers enter the graph) and an
// AffiliateNetwork (how a measured /go exit is monetized). See docs/AFFILIATE-FRAMEWORK.md.
//
// TPS invariants these types must preserve: providers produce OFFERS only (never
// identities/verdicts); no affiliate program ⇒ a plain `direct` link (never a
// fabricated tag); every exit stays a measured /go click.

/** How a retailer's offers enter raw_observations. All modes yield ScrapedProduct[]. */
export type SourcingMode = "scraper" | "official_feed" | "affiliate_feed" | "api" | "csv_xml";

/** Affiliate network adapters. Extend by adding a networks/<id>.ts + registering it. */
export type AffiliateNetworkId = "amazon" | "param" | "direct";

/** A single query parameter appended to an affiliate URL (network 'param'). */
export interface AffiliateParam {
  name: string;
  value: string;
}

/**
 * Per-retailer affiliate program config. `network` selects the adapter; the rest are
 * network-specific and intentionally optional so a `direct` retailer needs no fields.
 */
export interface AffiliateConfig {
  network: AffiliateNetworkId;
  /** Amazon Associates tracking id (e.g. "tawveeri0f-21"). */
  trackingId?: string;
  /** Generic query params for the `param` network (e.g. aff_code, utm_*). */
  params?: AffiliateParam[];
  /** Whether this program can carry a per-click sub-id for conversion attribution. */
  supportsSubId?: boolean;
  /** The URL-param name used to carry the sub-id (e.g. "ascsubtag", "utm_content", "subid"). */
  subIdParam?: string;
}

/**
 * Public Algolia storefront index config (ADR-094). appId + apiKey are the SEARCH-ONLY
 * keys a storefront ships in its browser bundle (public data access — same class as a
 * WooCommerce Store API, never a secret). `index` is the primary (Arabic) index; `indexEn`
 * optionally supplies English names merged by objectID.
 */
export interface AlgoliaConfig {
  appId: string;
  apiKey: string;
  index: string;
  indexEn?: string;
}

/**
 * Salla storefront config (ADR-095). Salla shops expose the whole catalogue with ZERO
 * credentials: an XML sitemap enumerates product URLs and every product page carries
 * `application/ld+json` `@type: Product` (name, price, priceCurrency, sku, brand,
 * availability). One adapter covers Najm/BlackBox and the 4,400+ live Saudi Salla stores.
 */
export interface SallaConfig {
  origin: string;
  sitemapUrl?: string;
}

/**
 * Shopify storefront config (ADR-104). Every Shopify store exposes its full catalogue with
 * ZERO credentials at `/products.json` (paginated, clean JSON: title, vendor, product_type,
 * variants[].price/sku/barcode, images). One adapter covers the whole Shopify platform class.
 * products.json omits a currency code, so the adapter resolves the shop currency out-of-band
 * (meta.json / Shopify.currency) and SAR-gates — never ingesting a foreign-currency price.
 */
export interface ShopifyConfig {
  origin: string;
}

/**
 * Magento 2 storefront config (ADR-179). Magento ships a PUBLIC, unauthenticated GraphQL
 * endpoint at `/graphql` — the documented storefront API every headless Magento frontend
 * uses. One adapter covers the whole Magento class; onboarding a Magento merchant is
 * configuration, not code.
 */
export interface MagentoConfig {
  origin: string;
}

/**
 * Headless Next.js storefront over a proprietary (non-GraphQL) backend — e.g. Black Box
 * KSA (blackbox.com.sa): a custom `api.ops.*` REST backend rendered through Next.js SSR,
 * NOT standard Magento GraphQL despite Magento-shaped media paths, and NOT Salla/Zid
 * (no JSON-LD, no Salla storefront API — verified live 2026-08-06). Every product page
 * embeds its full server-rendered record in `<script id="__NEXT_DATA__">`
 * `props.pageProps` — no credentials, no JS execution needed, no API guesswork. The
 * sitemap enumerates every product URL credential-free. One adapter covers any
 * Next.js-SSR storefront of this shape; onboarding another one is configuration, not code.
 */
export interface NextjsSsrConfig {
  origin: string;
  sitemapUrl?: string;
  /** English-slug keywords a product URL must contain to be in scope (bounded-category
   *  onboarding). Omit to pull the whole catalogue. Case-insensitive substring match. */
  categoryKeywords?: string[];
}

/** A retailer bound to its sourcing + monetization adapters. */
export interface RetailerProvider {
  slug: string;
  storeId: number;
  displayName: string;
  displayNameAr?: string;
  /** Master on/off (feature-flag overridable). */
  enabled: boolean;
  /** How offers are ingested today. */
  sourcing: SourcingMode;
  /** How exits are monetized. null ⇒ direct link, no program. */
  affiliate: AffiliateConfig | null;
  /** Optional feed endpoint for official_feed/csv_xml/affiliate_feed sourcing. */
  feedUrl?: string;
  /** Optional public Algolia storefront index (sourcing 'api' via the Algolia adapter). */
  algolia?: AlgoliaConfig;
  /** Optional Salla storefront (sourcing 'api' via the Salla sitemap+JSON-LD adapter). */
  salla?: SallaConfig;
  /** Optional Shopify storefront (sourcing 'api' via the Shopify products.json adapter). */
  shopify?: ShopifyConfig;
  /** Optional Magento 2 storefront (sourcing 'api' via the public GraphQL adapter). */
  magento?: MagentoConfig;
  /** Optional Next.js-SSR storefront (sourcing 'api' via the sitemap + __NEXT_DATA__ adapter). */
  nextjsSsr?: NextjsSsrConfig;
}

/** Per-exit context used for attribution when building an affiliate link. */
export interface LinkContext {
  /** Stable id of the outbound_clicks row — embedded as the network sub-id. */
  clickId?: string | number;
  /** Channel: web | mobile | product_page | agent | … (for analytics only). */
  source?: string;
}

/** Result of building an affiliate exit link. */
export interface AffiliateLinkResult {
  /** The final absolute URL to 302 the customer to. */
  url: string;
  /** The affiliate network that built it (for logging). */
  network: AffiliateNetworkId;
  /** Program label stored on outbound_clicks.affiliate_program (e.g. "amazon", "direct"). */
  program: string;
  /** The tracking id / tag applied, if any (outbound_clicks.affiliate_tag). */
  tag?: string | null;
  /** The sub-id embedded for conversion matching, if any. */
  subId?: string | null;
}

/** An affiliate network adapter: pure function URL → monetized URL. */
export interface AffiliateNetwork {
  id: AffiliateNetworkId;
  /**
   * Build the monetized URL. Receives an already-normalized absolute URL. Must be a
   * pure, side-effect-free transform and must never throw — on any doubt, return the
   * input URL as a `direct` link (unknown beats incorrect).
   */
  build(url: URL, config: AffiliateConfig, ctx: LinkContext): AffiliateLinkResult;
}
