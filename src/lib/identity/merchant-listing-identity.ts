// src/lib/identity/merchant-listing-identity.ts
// ─────────────────────────────────────────────────────────────────────────────
// MERCHANT-SPECIFIC LISTING IDENTITY (ADR-059)
//
// A universal URL-cleaning rule is the wrong abstraction. The same query
// parameter means different things at different merchants, and each merchant
// publishes a durable product id in its own shape. Guessing globally either
// destroys identity (merging variants) or fragments it (host/path churn).
//
// Each merchant therefore declares an explicit contract:
//   • how to read its DURABLE product id  (immune to host, path and session churn)
//   • which query params carry IDENTITY    (variant / seller / offer) and must survive
//   • how to read the MARKET               (country) the listing belongs to
//
// PRODUCTION EVIDENCE (2026-07-23) behind each decision:
//   jarir   …/apple-ipad-a16-tablet-pc-jpm1424.html?childSku=654165
//           childSku is the ONLY param (20,573 rows, 293 values) and selects a
//           VARIANT — stripping it merged 89 listings in a dry run. Path also
//           carries the market: /sa-en/, /ae-en/, /qa-ar/ …
//   amazon  /dp/B0CVMTTDMM/ref=sr_1_1?dib=…&qid=…&keywords=…&sr=…
//           every param is search-session state (dib/qid/keywords/sr/s/sbo…);
//           identity is the ASIN alone.
//   noon    /saudi-en/<slug>/N70126887V/p/      → N-code
//   extra   /en-sa/<deep/category/path>/p/100332926
//           5,040 product codes vs 5,108 URL paths — the category path drifts,
//           so path-keying double-counts 68 listings. Key on the code.
//   almanea /<slug>-p-170100501030110  — and 100% of rows are served from the
//           host `m.dev-almanea.com`. Host-keying would orphan all 1,584
//           listings' price history the moment that host changes.
//   swsg    /ar/…/iphone-17-256gb-black.html — no numeric id; the slug itself
//           encodes capacity and colour, so it IS the identity and must not be
//           truncated.
//
// MARKET SCOPING. Tawveeri is a Saudi price platform. 5,480 Jarir observations
// (1,532 distinct URLs — over HALF of Jarir's apparent catalog) are Qatar,
// Kuwait, UAE and Bahrain listings with foreign prices. They never reached
// canonicals, but they DID enter `tps_listing_price_facts`, so they were
// informing Jarir's Merchant Trust and Discount Integrity verdicts. Non-Saudi
// observations remain valid EVIDENCE but must never be counted as Saudi catalog
// coverage or inform a Saudi price verdict.
// ─────────────────────────────────────────────────────────────────────────────

export interface ListingIdentity {
  /** Stable key, or null when no durable identity could be read. */
  key: string | null;
  /** Merchant slug this contract belongs to. */
  merchant: string;
  /** ISO-ish country code of the market ('sa', 'ae', …), or null if unknown. */
  market: string | null;
  /** The merchant's own durable product id, when it publishes one. */
  productId: string | null;
  /** Identity-bearing parameters preserved in the key, e.g. `childSku=654165`. */
  variant: string | null;
}

interface MerchantContract {
  slug: string;
  /** Durable product id from the full URL string. */
  productId: (raw: string, u: URL | null) => string | null;
  /** Query params that DISTINGUISH a product, variant, seller or offer. */
  identityParams: string[];
  /** Market/country the listing belongs to. */
  market: (raw: string, u: URL | null) => string | null;
}

/** `/sa-en/`, `/en-sa/`, `/qa-ar/` … → the two-letter country. */
function countryFromPathSegment(path: string): string | null {
  const m = /\/([a-z]{2})-([a-z]{2})\//.exec(path);
  if (!m) return null;
  const KNOWN_LANG = new Set(["en", "ar"]);
  // Merchants disagree on order: Jarir uses <country>-<lang>, Extra <lang>-<country>.
  if (KNOWN_LANG.has(m[2]) && !KNOWN_LANG.has(m[1])) return m[1];
  if (KNOWN_LANG.has(m[1]) && !KNOWN_LANG.has(m[2])) return m[2];
  return null;
}

const CONTRACTS: Record<string, MerchantContract> = {
  jarir: {
    slug: "jarir",
    // `jpm1424` where present, else the trailing numeric id before `.html`.
    productId: (raw) =>
      /-(jpm\d+)\.html/i.exec(raw)?.[1]?.toLowerCase() ??
      /-(\d{5,})\.html/.exec(raw)?.[1] ??
      null,
    identityParams: ["childSku"],
    market: (raw, u) => countryFromPathSegment(u?.pathname ?? raw),
  },
  amazon: {
    slug: "amazon",
    productId: (raw) => /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i.exec(raw)?.[1]?.toUpperCase() ?? null,
    identityParams: [],
    // amazon.sa is the Saudi storefront; the TLD is the market.
    market: (raw, u) => (/amazon\.sa/i.test(u?.host ?? raw) ? "sa" : null),
  },
  noon: {
    slug: "noon",
    productId: (raw) => /\/([NZ][A-Z0-9]{8,})\/p\//i.exec(raw)?.[1]?.toUpperCase() ?? null,
    identityParams: [],
    market: (raw, u) => (/\/saudi-(?:en|ar)\//i.test(u?.pathname ?? raw) ? "sa" : null),
  },
  extra: {
    slug: "extra",
    productId: (raw) => /\/p\/([A-Za-z0-9]+)\/?$/.exec((raw.split("?")[0] ?? raw))?.[1]?.toUpperCase() ?? null,
    identityParams: [],
    market: (raw, u) => countryFromPathSegment(u?.pathname ?? raw),
  },
  almanea: {
    slug: "almanea",
    // Host-independent by design: production data is served from a `dev-` host.
    productId: (raw) => /-p-(\d{6,})\/?$/.exec((raw.split("?")[0] ?? raw))?.[1] ?? null,
    identityParams: [],
    market: () => "sa", // Almanea is a Saudi-only retailer.
  },
  swsg: {
    slug: "swsg",
    // No numeric id; the terminal slug encodes capacity and colour → it IS identity.
    productId: (raw) => {
      const path = (raw.split("?")[0] ?? raw).replace(/\/+$/, "");
      const last = path.split("/").pop() ?? "";
      const slug = last.replace(/\.html?$/i, "");
      return slug.length >= 3 ? slug.toLowerCase() : null;
    },
    identityParams: [],
    market: () => "sa", // swsg.co is a Saudi retailer.
  },
};

/** Query params that are campaign/session state at every merchant. */
const GLOBAL_VOLATILE = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "gclid", "fbclid", "srsltid", "spm", "campaign", "ref", "ref_",
  "dib", "dib_tag", "qid", "sr", "keywords", "sprefix", "crid", "s", "sbo", "aref", "sp_cr", "ie",
]);

/**
 * Canonicalise a URL for merchants with no declared contract: drop the fragment,
 * lowercase the host, remove globally-volatile params and Amazon-style `/ref=`
 * path noise, and sort what remains so ordering never forks a listing.
 *
 * Conservative by design — an unknown merchant keeps every param that is not on
 * the global volatile list, because we cannot know which ones carry identity.
 */
export function canonicalListingUrl(rawUrl: string): string {
  const raw = rawUrl.trim();
  if (!raw) return raw;
  let u: URL;
  try { u = new URL(raw); } catch { return raw; }
  for (const k of [...u.searchParams.keys()]) {
    if (GLOBAL_VOLATILE.has(k.toLowerCase())) u.searchParams.delete(k);
  }
  u.pathname = u.pathname.replace(/\/ref=[^/]*/gi, "").replace(/\/{2,}/g, "/");
  u.hash = "";
  u.host = u.host.toLowerCase();
  u.searchParams.sort();
  return u.toString().replace(/\/(\?|$)/, "$1");
}

/**
 * Resolve a listing's durable identity under its merchant's contract.
 *
 * The key is `<storeId>::<merchant>:<productId>[|param=value…]`, or
 * `<storeId>::<canonical-url>` when the merchant has no contract or its URL does
 * not carry a readable product id. Returns `key: null` only when there is no URL
 * at all — we never invent identity.
 */
export function resolveListingIdentity(
  storeId: number | string,
  rawUrl: string | null | undefined,
  merchantSlug?: string | null
): ListingIdentity {
  const raw = (rawUrl ?? "").trim();
  const slug = (merchantSlug ?? "").toLowerCase();
  const contract = CONTRACTS[slug];
  const empty: ListingIdentity = { key: null, merchant: slug, market: null, productId: null, variant: null };
  if (!raw) return empty;

  let u: URL | null = null;
  try { u = new URL(raw); } catch { u = null; }

  if (!contract) {
    return { key: `${storeId}::${canonicalListingUrl(raw)}`, merchant: slug, market: null, productId: null, variant: null };
  }

  const market = contract.market(raw, u);
  const productId = contract.productId(raw, u);

  // Identity-bearing params, in the contract's declared order (stable output).
  const parts: string[] = [];
  if (u) {
    for (const p of contract.identityParams) {
      const v = u.searchParams.get(p);
      if (v) parts.push(`${p}=${v}`);
    }
  }
  const variant = parts.length ? parts.join("|") : null;

  // No readable product id ⇒ fall back to the canonical URL rather than guessing.
  const base = productId
    ? `${storeId}::${contract.slug}:${productId}`
    : `${storeId}::${canonicalListingUrl(raw)}`;

  return { key: variant ? `${base}|${variant}` : base, merchant: contract.slug, market, productId, variant };
}

/** Convenience: the stable key alone. */
export function stableListingKey(
  storeId: number | string,
  rawUrl: string | null | undefined,
  merchantSlug?: string | null
): string | null {
  return resolveListingIdentity(storeId, rawUrl, merchantSlug).key;
}

/**
 * Whether a listing belongs to the Saudi market — the scope of Tawveeri's
 * catalog claims and price verdicts. `null` (market unknown) is treated as
 * IN-scope so a missing contract never silently deletes a merchant's catalog;
 * a known foreign market is excluded.
 */
export function isSaudiMarket(market: string | null): boolean {
  return market === null || market === "sa";
}
