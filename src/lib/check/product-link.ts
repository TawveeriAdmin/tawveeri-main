export type CheckStore = 'amazon' | 'noon' | 'jarir' | 'extra';
export interface ProductLink { store: CheckStore; productCode: string; url: string }

/** Only merchant product identifiers; no fetching, redirects or title-based guessing. */
export function parseProductLink(input: string): ProductLink | null {
  if (input.length > 2048) return null;
  try {
    const u = new URL(input.trim());
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
    for (const key of u.searchParams.keys()) {
      if (!/^utm_/i.test(key) && !['tag', 'ref', 'ref_', 'qid', 'sr', 'linkCode', 'ascsubtag', 'th', 'psc', 'gclid', 'fbclid'].includes(key)) return null;
    }
    u.search = ''; u.hash = '';
    return { store, productCode: code, url: u.toString() };
  } catch { return null; }
}

export function sameProductLink(a: string, b: ProductLink): boolean {
  const parsed = parseProductLink(a);
  return !!parsed && parsed.store === b.store && parsed.productCode === b.productCode;
}
