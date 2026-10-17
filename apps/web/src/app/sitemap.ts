import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/server-data';
import { SITE_URL } from '@/lib/site';

/**
 * Public sitemap — every <loc> on the confirmed host (shahrju.ir), only URLs a
 * crawler may actually show:
 *
 * - the static public pages,
 * - every city home that exists in the API (data-driven, never hardcoded),
 *
 * Deliberately absent: `priority` and `changeFrequency` (Google ignores both),
 * private/personal routes (/profile, /messages, /businesses, /login, /admin),
 * and detail URLs whose indexable content is not guaranteed yet — ad, business
 * and news detail pages should be added here once each has a stable, crawlable
 * page with real content.
 */
export const revalidate = 3600;

/** Real content date of the static pages below — not "whenever the file ran". */
const STATIC_UPDATED = new Date('2026-10-17T00:00:00.000Z');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: STATIC_UPDATED },
    { url: `${SITE_URL}/ads`, lastModified: STATIC_UPDATED },
    { url: `${SITE_URL}/plans`, lastModified: STATIC_UPDATED },
    { url: `${SITE_URL}/about`, lastModified: STATIC_UPDATED },
    { url: `${SITE_URL}/contact`, lastModified: STATIC_UPDATED },
    { url: `${SITE_URL}/privacy`, lastModified: STATIC_UPDATED },
    { url: `${SITE_URL}/terms`, lastModified: STATIC_UPDATED },
  ];

  // Cities come from data (never hardcoded); the API being unreachable leaves
  // the static entries in place instead of failing the route.
  const cities = await serverApi<Array<{ slug: string }>>('/cities', 3600);
  const cityEntries: MetadataRoute.Sitemap = (cities ?? []).map((city) => ({
    url: `${SITE_URL}/city/${city.slug}`,
    // no lastModified on purpose: we have no reliable "last important change"
    // for a city page, and a guessed date is worse than none.
  }));

  return [...fixed, ...cityEntries];
}
