import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CityServiceDirectory } from '@/components/city-service-directory';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import type { BusinessCategoryOption, City, ServiceListingItem } from '@/lib/types';

interface PageProps { params: Promise<{ slug: string }> }
export const revalidate = 300;

async function loadCityServices(slug: string) {
  const [cities, listings, allCategories] = await Promise.all([
    serverApi<City[]>('/cities', 300),
    serverApi<ServiceListingItem[]>(`/service-listings?city=${encodeURIComponent(slug)}&limit=200`, 300),
    serverApi<BusinessCategoryOption[]>('/service-categories', 300),
  ]);
  if (!cities || !listings || !allCategories) return undefined;
  const city = cities.find((item) => item.slug === slug);
  if (!city) return null;
  const usedSlugs = new Set(listings.map((item) => item.category.slug));
  const categories = allCategories.filter((category) => usedSlugs.has(category.slug));
  return { city, listings, categories };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadCityServices(slug);
  if (data === null) return { title: 'شهر پیدا نشد', robots: { index: false } };
  if (!data) return { robots: { index: false } };
  const title = `استادکارها و خدمات ${data.city.name}`;
  const description = `فهرست استادکارها و ارائه‌دهندگان خدمات ثبت‌شده در ${data.city.name}؛ دسته‌بندی، توضیحات و راه تماس را ببینید.`;
  const url = absoluteUrl(`/city/${data.city.slug}/services`);
  return { title, description, alternates: { canonical: url }, openGraph: openGraphFor({ url, title, description }) };
}

export default async function CityServicesPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadCityServices(slug);
  if (data === null) notFound();
  if (!data) return <div className="banner banner--error" role="alert">دریافت فهرست خدمات شهر موقتاً ممکن نیست.</div>;
  return <CityServiceDirectory city={data.city} listings={data.listings} categories={data.categories} />;
}
