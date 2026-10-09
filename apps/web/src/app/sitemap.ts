import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shahrjo.ir';
const API = process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:4000';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/ads`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE}/plans`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE}/news`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // City pages come from data (never hardcoded); tolerate the API being
  // unreachable at build time and keep the static entries.
  let cities: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API}/api/v1/cities`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ slug: string }> };
      cities = (body.data ?? []).map((c) => ({
        url: `${SITE}/city/${c.slug}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }));
    }
  } catch {
    // build-time offline: static routes only
  }

  return [...fixed, ...cities];
}
