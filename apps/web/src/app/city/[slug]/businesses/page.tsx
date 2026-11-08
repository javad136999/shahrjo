import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CityBusinessDirectory } from '@/components/city-business-directory';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import type { BusinessItem, City } from '@/lib/types';

interface PageProps { params: Promise<{ slug: string }> }
export const revalidate = 300;

async function cityBySlug(slug: string): Promise<City | null | undefined> {
  const cities = await serverApi<City[]>('/cities', 300);
  if (!cities) return undefined;
  return cities.find((city) => city.slug === slug) ?? null;
}

function directoryDescription(city: City) {
  return `فهرست کسب‌وکارهای تأییدشدهٔ شهر ${city.name}؛ دسته‌بندی‌ها، نشانی و راه‌های تماس ثبت‌شده را در شهرجو پیدا کنید.`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const city = await cityBySlug(slug);
  if (!city) return city === null ? { title: 'شهر پیدا نشد', robots: { index: false } } : { robots: { index: false } };
  const title = `کسب‌وکارهای ${city.name} | شهرجو`;
  const description = directoryDescription(city);
  const url = absoluteUrl(`/city/${city.slug}/businesses`);
  return { title, description, alternates: { canonical: url }, openGraph: openGraphFor({ url, title, description }) };
}

export default async function CityBusinessesPage({ params }: PageProps) {
  const { slug } = await params;
  const city = await cityBySlug(slug);
  if (city === null) notFound();
  if (!city) return <div className="banner banner--error" role="alert">دریافت فهرست شهرها موقتاً ممکن نیست.</div>;

  const businesses = await serverApi<BusinessItem[]>(`/businesses?city=${encodeURIComponent(city.slug)}&limit=200`, 300);
  if (!businesses) return <div className="banner banner--error" role="alert">دریافت فهرست مشاغل شهر ناموفق بود؛ لطفاً کمی بعد دوباره تلاش کنید.</div>;

  return (
    <>
      <CityBusinessDirectory city={city} businesses={businesses} />
      <div className="city-business-directory__register"><Link href="/business/new">صاحب کسب‌وکار هستید؟ کسب‌وکارتان را در شهرجو ثبت کنید</Link></div>
    </>
  );
}
