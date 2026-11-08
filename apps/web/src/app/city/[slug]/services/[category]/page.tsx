import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CityServiceDirectory } from '@/components/city-service-directory';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import type { BusinessCategoryOption, City, ServiceListingItem } from '@/lib/types';

interface PageProps { params: Promise<{ slug: string; category: string }> }
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
  return { city, listings, categories: allCategories.filter((category) => usedSlugs.has(category.slug)) };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, category: categorySlug } = await params;
  const data = await loadCityServices(slug);
  if (data === null) return { title: 'شهر پیدا نشد', robots: { index: false } };
  if (!data) return { robots: { index: false } };
  const category = data.categories.find((item) => item.slug === categorySlug);
  if (!category) return { title: 'دستهٔ خدمات پیدا نشد', robots: { index: false } };
  const title = `${category.name} در ${data.city.name} | شهرجو`;
  const description = `فهرست ${category.name}های ثبت‌شده در شهر ${data.city.name}؛ توضیحات و راه تماس ارائه‌دهندگان خدمت را ببینید.`;
  const url = absoluteUrl(`/city/${data.city.slug}/services/${encodeURIComponent(category.slug)}`);
  return { title, description, alternates: { canonical: url }, openGraph: openGraphFor({ url, title, description }) };
}

export default async function CityServiceCategoryPage({ params }: PageProps) {
  const { slug, category: categorySlug } = await params;
  const data = await loadCityServices(slug);
  if (data === null) notFound();
  if (!data) return <div className="banner banner--error" role="alert">دریافت فهرست خدمات شهر موقتاً ممکن نیست.</div>;
  const category = data.categories.find((item) => item.slug === categorySlug);
  if (!category) notFound();
  const listings = data.listings.filter((item) => item.category.slug === categorySlug);
  return <CityServiceDirectory city={data.city} listings={listings} categories={data.categories} activeCategory={category} />;
}
