import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
    // Required on Next.js 14 for instrumentation.ts `register()` to run (it became
    // the default in Next 15). Without it the hook silently never fires — which is
    // why the ADR-078 in-process scheduler would never start in production. ADR-078.
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.amazon.sa' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
      { protocol: 'https', hostname: '**.amazon.sa' },
      { protocol: 'https', hostname: 'www.noon.com' },
      { protocol: 'https', hostname: 'f.nooncdn.com' },
      { protocol: 'https', hostname: '**.noon.com' },
      { protocol: 'https', hostname: 'www.jarir.com' },
      { protocol: 'https', hostname: 'ak-asset.jarir.com' },
      { protocol: 'https', hostname: '**.jarir.com' },
      { protocol: 'https', hostname: 'www.extra.com' },
      { protocol: 'https', hostname: '**.extra.com' },
      { protocol: 'https', hostname: '**.almanea.com' },
      { protocol: 'https', hostname: '**.dev-almanea.com' },
      { protocol: 'https', hostname: '**.almanea.sa' },
      { protocol: 'https', hostname: 'gcc.luluhypermarket.com' },
      { protocol: 'https', hostname: '**.akinoncloudcdn.com' },
      { protocol: 'https', hostname: 'pimcdn.sharafdg.com' },
      { protocol: 'https', hostname: 's.sdgcdn.com' },
      { protocol: 'https', hostname: '**.sharafdg.com' },
      { protocol: 'https', hostname: '**.aliexpress.com' },
      { protocol: 'https', hostname: '**.aliexpress-media.com' },
      { protocol: 'https', hostname: 'ae-pic-a1.aliexpress-media.com' },
      { protocol: 'https', hostname: '**.salla.sa' },
      { protocol: 'https', hostname: 'cdn.assets.salla.network' },
      { protocol: 'https', hostname: 'najm.store' },
      // Feed-store image CDNs surfaced by the canonical image backfill (ADR-101).
      { protocol: 'https', hostname: 'shakersa.com' },
      { protocol: 'https', hostname: '**.shakersa.com' },
      { protocol: 'https', hostname: 'swsg.co' },
      { protocol: 'https', hostname: '**.swsg.co' },
      { protocol: 'https', hostname: 'shop.mhzm.sa' },
      { protocol: 'https', hostname: '**.mhzm.sa' },
      { protocol: 'https', hostname: 'media.zid.store' },
      { protocol: 'https', hostname: '**.zid.store' },
      { protocol: 'https', hostname: 'images.samsung.com' },
      { protocol: 'https', hostname: '**.samsung.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: '**.shopify.com' },
      // Black Box KSA (blackbox.com.sa) — media served from the ops backend, not the
      // storefront domain. See docs/BLACKBOX-RETAILER-ONBOARDING.md.
      { protocol: 'https', hostname: 'store.ops.blackbox.com.sa' },
      { protocol: 'https', hostname: 'blackbox.com.sa' },
      { protocol: 'https', hostname: '**.blackbox.com.sa' },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS: site is served exclusively over HTTPS (Railway/tawveeri.com). Safe to
          // enforce unconditionally — there is no intentional plain-HTTP surface to break.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Only `camera` is used in-app (barcode scanner, src/components/search/barcode-scanner.tsx
          // via getUserMedia). Everything else this app does not use is explicitly denied.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
          // REPORT-ONLY DRAFT — audit-time addition (2026-08-08). Not enforced: this repo could
          // not be built/run to verify it doesn't break Supabase/Algolia/Sentry/image-CDN/OAuth
          // traffic or the inline theme-flash script in src/app/layout.tsx. Ships as
          // Report-Only so browsers log violations to the console without blocking anything;
          // the coordinator should watch those reports for a few days, tighten the directives
          // (particularly 'unsafe-inline'/'unsafe-eval' on script-src), then promote it to a
          // real `Content-Security-Policy` header.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://*.algolia.net https://*.algolianet.com https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  sourcemaps: {
    disable: true,
  },
});
