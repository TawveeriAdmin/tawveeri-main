export type CheckStore = 'amazon' | 'noon' | 'jarir' | 'extra';
export interface ProductLink { store: CheckStore; productCode: string; url: string }

// A trailing character a share-sheet sentence commonly appends after a pasted URL,
// never a character a real product-page URL ends with.
const TRAILING_PUNCTUATION = /[)\]}>'".,!?؟،؛]+$/;

/**
 * Share-sheet text often prepends a label before the link (e.g. "Share product link
 * https://..."). Extract the first embedded https URL instead of requiring the whole
 * input to already be a bare URL. Falls back to the trimmed input unchanged when no
 * embedded URL is found, so plain non-URL input still fails the same way as before.
 */
export function extractUrlFromText(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/https:\/\/\S+/);
  return match ? match[0].replace(TRAILING_PUNCTUATION, '') : trimmed;
}

/** Only merchant product identifiers; no fetching, redirects or title-based guessing. */
export function parseProductLink(input: string): ProductLink | null {
  if (input.length > 4096) return null;
  const candidate = extractUrlFromText(input);
  if (candidate.length > 2048) return null;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const host = u.hostname.replace(/^www\./, '');
    let store: CheckStore; let code: string | undefined;
    if (host === 'amazon.sa') {
      store = 'amazon'; code = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]?.toUpperCase();
    } else if (host === 'noon.com' && /^\/saudi-(?:ar|en)\//.test(u.pathname)) {
      store = 'noon'; code = u.pathname.match(/\/([A-Z0-9]+)\/p\/?$/i)?.[1]?.toUpperCase();
    } else if (host === 'jarir.com') {
      store = 'jarir'; code = u.pathname.match(/-(\d{5,10})\.html$/)?.[1];
    } else if (host === 'extra.com' && /^\/(?:en|ar)-sa\//.test(u.pathname)) {
      store = 'extra'; code = u.pathname.match(/\/p\/(\d{6,12})\/?$/)?.[1];
    } else return null;
    if (!code) return null;
    // Variant selectors can change the item without changing the URL path. Unknown
    // parameters fail closed; only well-known tracking/presentation parameters pass.
    // linkId/btn_type/btn_ref: observed live 2026-09-15 on the real destination a
    // link.amazon short link resolves to (Amazon's Button-powered redirect chain) —
    // pure click-tracking artifacts, stripped below like tag/ascsubtag, never used for identity.
    // dib/dib_tag/keywords: Amazon's own internal search-results-page tracking params,
    // present on the majority of our stored Amazon offer URLs because the scraper
    // captures search-result links verbatim (measured 2026-09-16: 719/829 = 86.7% of
    // valid Amazon offers carried these and were unmatchable by sameProductLink() before
    // this — see ADR-370). Query string is always stripped below; these never affect
    // which product an offer resolves to.
    for (const key of u.searchParams.keys()) {
      if (!/^utm_/i.test(key) && !['tag', 'ref', 'ref_', 'qid', 'sr', 'linkCode', 'ascsubtag', 'th', 'psc', 'gclid', 'fbclid', 'linkId', 'btn_type', 'btn_ref', 'dib', 'dib_tag', 'keywords'].includes(key)) return null;
    }
    u.search = ''; u.hash = '';
    return { store, productCode: code, url: u.toString() };
  } catch { return null; }
}

export function sameProductLink(a: string, b: ProductLink): boolean {
  const parsed = parseProductLink(a);
  return !!parsed && parsed.store === b.store && parsed.productCode === b.productCode;
}

// Verified 2026-09-15 from a real Amazon-app share action (ADR-367 field evidence):
// the app's "Share" button produces a link.amazon short link, not the full product
// page. Noon/Jarir/eXtra were not reachable to verify their own share-sheet output in
// this environment, so no domain is assumed for them — an unverified guess here would
// fail closed anyway (resolveShortLink only ever follows a listed host), but listing a
// wrong host would silently do nothing rather than surface the gap. Add a store's real
// share-link domain here only after observing it directly.
const SHORT_LINK_HOSTS = new Set(['link.amazon']);

/** True only for a recognized short-link domain; never true for a full product link. */
export function isKnownShortLink(input: string): boolean {
  try {
    const u = new URL(extractUrlFromText(input));
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && SHORT_LINK_HOSTS.has(u.hostname.replace(/^www\./, ''));
  } catch { return false; }
}

/** "0; url=<value>" -> <value>, with an app-deep-link scheme rewritten to https. */
export function extractRefreshTarget(header: string): string | null {
  const match = header.match(/url\s*=\s*(.+)$/i);
  if (!match) return null;
  const value = match[1].trim();
  // Amazon's redirect chain hands a browser a "com.amazon.mobile.shopping.web://host/path"
  // app-deep-link, wrapping a normal https destination after the "://" — verified live
  // 2026-09-15 (ADR-369). Rewriting the scheme is a no-op when it is already https.
  const afterScheme = value.match(/^[a-z0-9.+-]+:\/\/(.+)$/i);
  return afterScheme ? `https://${afterScheme[1]}` : value;
}

/**
 * Follows the redirect chain for a KNOWN short-link domain only. Amazon's link.amazon
 * endpoint does not support HTTP HEAD — verified live 2026-09-15: it returns 404
 * regardless of User-Agent, not a bot block (ADR-369) — so this uses GET instead. The
 * response body is never read or parsed: resolution relies only on response headers,
 * either the Location chain fetch() follows automatically, or (Amazon's own redirect
 * service ends its chain with a 200 carrying a non-standard Refresh header instead of a
 * 3xx) the Refresh header read explicitly below. Its output still goes through
 * parseProductLink()/tps_current_offers unchanged. Returns the final destination URL, or
 * null if the domain is not a recognized short link, no redirect happened, or resolution
 * failed/timed out.
 */
export async function resolveShortLink(input: string): Promise<string | null> {
  if (!isKnownShortLink(input)) return null;
  const candidate = extractUrlFromText(input);
  try {
    const response = await fetch(candidate, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (response.body) { try { await response.body.cancel(); } catch { /* stream already closed */ } }
    if (response.url && response.url !== candidate && parseProductLink(response.url)) return response.url;
    const refresh = response.headers.get('refresh');
    const target = refresh ? extractRefreshTarget(refresh) : null;
    return target && target !== candidate ? target : null;
  } catch { return null; }
}
