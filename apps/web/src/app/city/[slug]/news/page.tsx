import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CityNewsView } from '@/components/city-news';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import type { City, NewsItem } from '@/lib/types';

interface CityNewsPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * City news (`/city/<slug>/news`) — server-rendered like the city home: the
 * headline «اخبار شهر جم» and the news themselves are in the first HTML, and
 * the page carries its own title, description and canonical.
 */
export const revalidate = 60;

/** `null` = unknown slug · `undefined` = the API could not answer (outage). */
async function resolveCity(slug: string): Promise<City | null | undefined> {
  const list = await serverApi<City[]>('/cities', 60);
  if (!list) return undefined;
  return list.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: CityNewsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const city = await resolveCity(slug);
  if (city === undefined) return {};
  if (city === null) return { title: 'شهر پیدا نشد' };

  const title = `اخبار شهر ${city.name}`;
  const description = `خبرهای محلی شهر ${city.name} را در شهرجو دنبال کنید؛ اخبار روز شهر و رویدادهای همین شهر.`;
  const url = absoluteUrl(`/city/${city.slug}/news`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: openGraphFor({ url, title, description }),
  };
}

export default async function CityNewsPage({ params }: CityNewsPageProps) {
  const { slug } = await params;
  const city = await resolveCity(slug);

  if (city === undefined) {
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

  const news = await serverApi<NewsItem[]>(`/news?city=${encodeURIComponent(city.slug)}&limit=30`, 60);

  if (news === null) {
    return <CityNewsView city={city} news={[]} loading={false} error="دریافت اخبار شهر ناموفق بود" />;
  }

  return <CityNewsView city={city} news={news} loading={false} error={null} />;
}
