import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/profile'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shahrjo.ir'}/sitemap.xml`,
  };
}
