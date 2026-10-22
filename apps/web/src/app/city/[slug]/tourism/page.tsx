import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CityTourismView } from '@/components/city-tourism';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import { getTourismSpots } from '@/lib/tourism';
import type { City } from '@/lib/types';

interface CityTourismPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600;

async function resolveCity(slug: string): Promise<City | null | undefined> {
  const list = await serverApi<City[]>('/cities', 60);
  if (!list) return undefined;
  return list.find((city) => city.slug === slug) ?? null;
}

export async function generateMetadata({ params }: CityTourismPageProps): Promise<Metadata> {
  const { slug } = await params;
  const city = await resolveCity(slug);
  if (city === undefined) return {};
  if (city === null) return { title: 'شهر پیدا نشد' };
  const title = `جاهای دیدنی ${city.name} | گردشگری شهرجو`;
  const description = `راهنمای گردشگری ${city.name}: جاهای دیدنی، طبیعت، مکان‌های تاریخی، غذا و بازار با لوکیشن روی نقشه.`;
  const url = absoluteUrl(`/city/${city.slug}/tourism`);
  const imageUrl = getTourismSpots(city).find((spot) => spot.imageUrl)?.imageUrl;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: openGraphFor({ url, title, description, imageUrl }),
    twitter: { card: 'summary_large_image', title, description, images: imageUrl ? [imageUrl] : undefined },
  };
}

export default async function CityTourismPage({ params }: CityTourismPageProps) {
  const { slug } = await params;
  const city = await resolveCity(slug);
  if (city === undefined) {
    return <div className="banner banner--error" role="alert"><span>دریافت اطلاعات شهر ناموفق بود؛ چند لحظه دیگر دوباره تلاش کنید.</span><Link href="/" className="btn btn-ghost">بازگشت به فهرست شهرها</Link></div>;
  }
  if (city === null) notFound();
  return <CityTourismView city={city} />;
}
