// Not-found boundary for the product-detail group.
//
// ⚠ IT RENDERS IN THE BROWSER, NOT IN THE SERVED BYTES — and the earlier explanation for that
// was WRONG. The root-layout restructure (ADR-155) was expected to fix it; it did not, and the
// real cause was measured while doing the restructure:
//
//   `notFound()` raised during the render aborts the whole React Flight stream, because the
//   throwing subtree is not inside a Suspense boundary. Next then serves its bare
//   `<html id="__next_error__">` fallback — HTTP 404, ZERO bytes of markup — and the browser
//   renders this component from the flight payload after hydration.
//
// PROVEN, not inferred. Four placements were measured on the same build and all four behave
// identically (404, empty body): boundary here · boundary deleted so the root one handles it ·
// `notFound()` raised from the page · `notFound()` raised from `generateMetadata`. Adding a
// Suspense boundary above the page DOES produce a fully server-rendered not-found — and turns
// the status into 200, because the shell flushes before the error arrives. That is the soft 404
// this route group was created to eliminate (see ../layout.tsx), so it was rejected.
//
// So the two properties are mutually exclusive under Next 14 / React 18 streaming:
//   correct 404 status  XOR  server-rendered body.
// We keep the STATUS, because it is what stops crawlers indexing missing products as valid
// pages, and a real visitor still sees this component.
//
// The only way to have both is to decide the product's existence BEFORE the render — a lookup
// in middleware that rewrites a miss onto an unmatched path (the routing-level 404 path, which
// does serve a full body). That costs a network round trip on the hottest customer surface and
// duplicates the page's own query; it is scoped, not started.
import Link from 'next/link';

export default function ProductNotFound() {
  // Boundaries cannot read route params, so this is locale-neutral: Arabic first, English
  // beneath. We show both rather than guessing which the visitor wanted.
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 56, fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1, marginBottom: 12 }}>404</div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-on-surface)', margin: '0 0 8px' }}>
        هذا المنتج غير موجود
      </h1>
      <p style={{ fontSize: 15, color: 'var(--color-on-surface-variant)', margin: '0 0 6px' }}>
        قد يكون المتجر أزاله، أو تغيّر الرابط.
      </p>
      <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', margin: '0 0 24px' }}>
        This product could not be found — the retailer may have removed it, or the link changed.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/ar/search"
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 20px',
            borderRadius: 999, background: 'var(--color-primary)', color: 'var(--color-on-primary)',
            fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}
        >
          ابحث عن منتج
        </Link>
        <Link
          href="/ar"
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 20px',
            borderRadius: 999, border: '1px solid var(--color-outline-variant)',
            color: 'var(--color-on-surface)', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}
        >
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
