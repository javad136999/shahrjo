import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CityHomeClient } from '@/components/city-home-client';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import type { City, CityMapData, ShowcaseItem } from '@/lib/types';

interface CityPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * City home (`/city/<slug>`) — server-rendered on purpose.
 *
 * Before, this was a client page whose first paint said «در حال بارگذاری» and
 * carried the generic site title, so crawlers got no city name, no H1 and no
 * canonical (SEO audit, 2026-10). Now the city is resolved on the server, the
 * dashboard is rendered into the HTML, and each city gets its own title,
 * description and canonical pointing at the confirmed host.
 */
export const revalidate = 60;

/** `null` = the slug does not exist · `undefined` = the API could not answer (outage). */
async function resolveCity(slug: string): Promise<City | null | undefined> {
  const list = await serverApi<City[]>('/cities', 60);
  if (!list) return undefined;
  return list.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { slug } = await params;
  const city = await resolveCity(slug);
  if (city === undefined) return {}; // outage: fall back to the site-wide defaults
  if (city === null) return { title: 'شهر پیدا نشد' };

  const title = `آگهی و کسب‌وکارهای شهر ${city.name}`;
  const description = `خدمات، کسب‌وکارها و آگهی‌های محلی ${city.name} را در شهرجو پیدا کنید؛ اگر صاحب کسب‌وکار هستید، آن را برای همشهری‌ها معرفی کنید.`;
  const url = absoluteUrl(`/city/${city.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: openGraphFor({ url, title, description }),
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { slug } = await params;
  const city = await resolveCity(slug);

  if (city === undefined) {
    // API outage — a soft failure, not a 404: never let a downtime read as
    // «this city does not exist» to a crawler.
    return (
      <div className="banner banner--error" role="alert">
        <span>دریافت اطلاعات شهر ناموفق بود؛ چند لحظه دیگر دوباره تلاش کنید.</span>
        <Link href="/" className="btn btn-ghost">
          بازگشت به فهرست شهرها
        </Link>
      </div>
    );
  }
  if (city === null) notFound();

  const [showcase, mapData] = await Promise.all([
    serverApi<ShowcaseItem[]>(`/showcase?city=${encodeURIComponent(city.slug)}&limit=12`, 60),
    serverApi<CityMapData>(`/map?city=${encodeURIComponent(city.slug)}`, 60),
  ]);

  const feedError =
    showcase === null && mapData === null ? 'دریافت محتوای شهر ناموفق بود؛ چند لحظه دیگر دوباره تلاش کنید.' : null;

  return (
    <>
      <div className="city-tourism-cta">
        <Link href={`/city/${city.slug}/tourism`} className="btn btn-primary">
          🧭 راهنمای گردشگری و جاهای دیدنی {city.name}
        </Link>
      </div>
      <CityHomeClient
        city={city}
        showcase={showcase ?? []}
        mapData={mapData}
        feedError={feedError}
      />
    </>
  );
}
