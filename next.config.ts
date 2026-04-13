import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
  images: {
    remotePatterns: [
      // Amazon SA
      {
        protocol: 'https',
        hostname: 'www.amazon.sa',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
      },
      {
        protocol: 'https',
        hostname: '**.amazon.sa',
      },
      // Noon
      {
        protocol: 'https',
        hostname: 'www.noon.com',
      },
      {
        protocol: 'https',
        hostname: 'f.nooncdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.noon.com',
      },
      // Jarir
      {
        protocol: 'https',
        hostname: 'www.jarir.com',
      },
      {
        protocol: 'https',
        hostname: 'ak-asset.jarir.com',
      },
      {
        protocol: 'https',
        hostname: '**.jarir.com',
      },
      // Extra
      {
        protocol: 'https',
        hostname: 'www.extra.com',
      },
      {
        protocol: 'https',
        hostname: '**.extra.com',
      },
      // Almanea
      {
        protocol: 'https',
        hostname: '**.almanea.com',
      },
      {
        protocol: 'https',
        hostname: '**.dev-almanea.com',
      },
      // AliExpress (search result images)
      {
        protocol: 'https',
        hostname: '**.aliexpress.com',
      },
      {
        protocol: 'https',
        hostname: '**.aliexpress-media.com',
      },
      {
        protocol: 'https',
        hostname: 'ae-pic-a1.aliexpress-media.com',
      },
      // Najm / Salla CDNs
      {
        protocol: 'https',
        hostname: '**.salla.sa',
      },
      {
        protocol: 'https',
        hostname: 'cdn.assets.salla.network',
      },
      {
        protocol: 'https',
        hostname: 'najm.store',
      },
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
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  disableSourceMapUpload: true,
});
