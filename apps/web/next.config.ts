import type { NextConfig } from 'next';
import { SITE_URL } from './src/lib/site';

// Proxy target for same-origin /api calls (dev server & direct container access).
// In production Caddy routes /api/* straight to the NestJS API before it reaches Next.
const internalApi = process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  output: 'standalone',  // One canonical host: www → apex as a permanent 301, so the same page is
  // never reachable under two hosts. Every page's rel=canonical points at
  // SITE_URL too — redirect and canonical must agree or Google has to guess
  // which URL to show.
  async redirects() {
    const canonical = new URL(SITE_URL);
    // an already-www primary host must not redirect to itself
    if (canonical.hostname.startsWith('www.')) return [];
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: `www.${canonical.hostname}` }],
        destination: `${canonical.origin}/:path*`,
        permanent: true,
      },
    ];
  },
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
