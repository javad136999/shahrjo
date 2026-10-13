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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(self), payment=(self)',
          },
        ],
      },
      {
        // Uploaded media must never execute as HTML/JS.
        source: '/files/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; img-src 'self'; media-src 'self'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        // Icons are referenced with a `?v=2` suffix (see app/layout.tsx), so the
        // URL changes whenever the artwork does. That lets us cache them hard
        // without ever leaving users stuck on the previous icon set.
        // Listed explicitly rather than as one regex so the intent is greppable
        // and a new icon cannot silently miss the rule.
        source: '/:file(favicon\\.ico|favicon-16x16\\.png|favicon-32x32\\.png|apple-touch-icon\\.png|icon-192x192\\.png|icon-512x512\\.png|icon-maskable-192x192\\.png|icon-maskable-512x512\\.png)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        // The manifest is what decides which icon the launcher installs — keep
        // it fresh so a new icon set propagates within the hour, not the day.
        source: '/site.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
