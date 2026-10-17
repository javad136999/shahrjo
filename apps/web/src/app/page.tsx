import type { Metadata } from 'next';
import { HomeClient } from '@/components/home-client';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import type { City } from '@/lib/types';

export const metadata: Metadata = {
  // the brand headline already ends in «شهرجو» — the template must not append it twice
  title: { absolute: 'شهرجو | آگهی‌ها و کسب‌وکارهای محلی شهرها' },
  description:
    'آگهی‌های محلی، خدمات، کسب‌وکارها و اخبار شهر خود را در شهرجو پیدا کنید؛ یا کسب‌وکار و آگهی‌تان را برای همشهری‌ها معرفی کنید.',
  alternates: { canonical: absoluteUrl('/') },
  openGraph: openGraphFor({
    url: absoluteUrl('/'),
    title: 'شهرجو | آگهی‌ها و کسب‌وکارهای محلی شهرها',
    description:
      'آگهی‌های محلی، خدمات، کسب‌وکارها و اخبار شهر خود را در شهرجو پیدا کنید؛ یا کسب‌وکار و آگهی‌تان را برای همشهری‌ها معرفی کنید.',
  }),
};

// The city list changes as cities open up — render per request (with Next's
// data cache) instead of freezing whatever the build machine could reach.
export const revalidate = 60;

/** First-run city selection (Phase 3): the landing page of the platform. */
export default async function HomePage() {
  const cities = await serverApi<City[]>('/cities', 60);
  return <HomeClient initialCities={cities} />;
}
