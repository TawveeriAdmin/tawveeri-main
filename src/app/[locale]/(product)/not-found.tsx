// Not-found boundary for the product-detail group.
//
// ⚠ KNOWN LIMITATION — THIS DOES NOT CURRENTLY RENDER, and the reason is structural.
// `src/app/layout.tsx` is a PASSTHROUGH: the real HTML shell, fonts and providers live in
// `[locale]/layout.tsx`. Next resolves the not-found render above that level, where no shell
// exists, so the response is a near-empty document — measured: HTTP 404 with 57 bytes of body,
// unchanged whether the boundary is placed here, at `[locale]`, or at the root.
//
// It is kept because it is the CORRECT location and becomes live the moment the root layout
// owns the HTML shell. It is documented rather than deleted so the next person does not
// rediscover the same dead end — and documented loudly so nobody assumes it works.
//
// The STATUS is correct today (404), which is what stops crawlers indexing missing products as
// valid pages. The body is the remaining gap.
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
