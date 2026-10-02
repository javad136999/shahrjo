import type { NextConfig } from 'next';

// Proxy target for same-origin /api calls (dev server & direct container access).
// In production Caddy routes /api/* straight to the NestJS API before it reaches Next.
const internalApi = process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${internalApi}/api/:path*` }];
  },
};

export default nextConfig;
