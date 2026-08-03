// src/lib/seo/canonical-host.ts
// ADR-190 — ONE answer to "is this request on the host we publish?"
//
// Railway serves every deployment on a generated domain
// (`tawveeri-main-production.up.railway.app`) as well as on `tawveeri.com`. Both render the
// whole site, so both were crawlable — and the preview host **is indexed**: a web search for
// «توفيري» returns `tawveeri-main-production.up.railway.app/ar/products/…` showing our
// «المنتج غير موجود» page. That is duplicate content competing with the real domain for the
// authority we have, which is not much.
//
// Used by the middleware (to mark non-canonical hosts `noindex`) and by `robots.ts` (to stop
// advertising a sitemap on a host we do not want indexed). One module so the two cannot
// disagree about what "canonical" means — that disagreement is exactly how `robots.txt` and
// `sitemap.xml` drifted apart in ADR-189.

/** The host we publish, derived from the same env var every canonical URL is built from. */
export function canonicalHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() || null;
  }
}

/**
 * True when the request arrived on a host we do NOT publish.
 *
 * Unknown ⇒ **false**. If the env var is missing or the Host header is absent we treat the
 * request as canonical and index normally: the failure mode of guessing wrong in the other
 * direction is `noindex` on the real site, which would be far worse than a duplicate.
 * Localhost and private hosts are never marked — a developer's machine is not a duplicate of
 * production, and marking it would hide the header's absence in local testing.
 */
export function isNonCanonicalHost(hostHeader: string | null | undefined): boolean {
  const expected = canonicalHost();
  if (!expected) return false;
  const host = (hostHeader ?? '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return false;
  // `www.` is the same site, not a duplicate to de-index — it should be redirected at the DNS
  // or platform layer, and de-indexing it here would drop a host people actually link to.
  const bare = host.replace(/^www\./, '');
  const expectedBare = expected.replace(/^www\./, '');
  return bare !== expectedBare;
}

/**
 * The value served on a non-canonical host.
 *
 * `noindex` removes the duplicate from the index. `follow` is deliberate: link equity on those
 * pages points at canonical-host URLs (every `<link rel=canonical>`, every sitemap entry and
 * every internal href is built from `NEXT_PUBLIC_APP_URL`), so following them passes that
 * signal to the real domain instead of stranding it.
 */
export const NON_CANONICAL_ROBOTS_TAG = 'noindex, follow';
