import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CityBusinessDirectory } from '@/components/city-business-directory';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import type { BusinessItem, City } from '@/lib/types';

interface PageProps { params: Promise<{ slug: string; category: string }> }
export const revalidate = 300;

async function loadDirectory(slug: string) {
  const [cities, businesses] = await Promise.all([
    serverApi<City[]>('/cities', 300),
    serverApi<BusinessItem[]>(`/businesses?city=${encodeURIComponent(slug)}&limit=200`, 300),
  ]);
  if (!cities || !businesses) return undefined;
  const city = cities.find((item) => item.slug === slug);
  if (!city) return null;
  return { city, businesses };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, category: categorySlug } = await params;
  const data = await loadDirectory(slug);
  if (data === null) return { title: 'شهر پیدا نشد', robots: { index: false } };
  if (!data) return { robots: { index: false } };
  const category = data.businesses.find((business) => business.category.slug === categorySlug)?.category;
  if (!category) return { title: 'دسته‌بندی پیدا نشد', robots: { index: false } };
  const title = `${category.name} در ${data.city.name} | شهرجو`;
  const description = `فهرست کسب‌وکارهای ${category.name} در شهر ${data.city.name}؛ اطلاعات تماس و نشانی ثبت‌شده را در شهرجو ببینید.`;
  const url = absoluteUrl(`/city/${data.city.slug}/businesses/${encodeURIComponent(category.slug)}`);
  return { title, description, alternates: { canonical: url }, openGraph: openGraphFor({ url, title, description }) };
}

export default async function CityBusinessCategoryPage({ params }: PageProps) {
  const { slug, category: categorySlug } = await params;
  const data = await loadDirectory(slug);
  if (data === null) notFound();
  if (!data) return <div className="banner banner--error" role="alert">دریافت فهرست شهر و مشاغل موقتاً ممکن نیست.</div>;
  const category = data.businesses.find((business) => business.category.slug === categorySlug)?.category;
  if (!category) notFound();
  const filtered = data.businesses.filter((business) => business.category.slug === categorySlug);

  return (
    <CityBusinessDirectory
      city={data.city}
      businesses={filtered}
      allBusinesses={data.businesses}
      activeCategory={category}
    />
  );
}
