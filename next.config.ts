import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
    ],
  },
};

export default nextConfig;
