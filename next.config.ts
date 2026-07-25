import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
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
   // why the ADR-078 in-process scheduler never started in production. ADR-078.
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
