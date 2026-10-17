import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // technical + private surfaces: APIs, the operator panel, the personal
      // profile and the private inbox. /wall stays open — it is the public
      // face of a city. Pages that must not be *shown* in results (e.g.
      // /businesses) are left crawlable and marked noindex in their metadata:
      // blocking them here would hide that instruction from Google.
      disallow: ['/api/', '/admin', '/profile', '/messages'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
