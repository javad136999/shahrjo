import type { Metadata } from 'next';
import { BusinessDetail } from '@/components/business-detail';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl, openGraphFor } from '@/lib/site';
import type { BusinessDetail as BusinessDetailData } from '@/lib/types';

export const revalidate = 300;

interface PageProps { params: Promise<{ id: string }> }

function parseBusinessId(id: string): number | null {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function getBusiness(id: string): Promise<BusinessDetailData | null> {
  const businessId = parseBusinessId(id);
  return businessId ? serverApi<BusinessDetailData>(`/businesses/${businessId}`, 300) : null;
}

function businessDescription(business: BusinessDetailData): string {
  const text = business.description?.replace(/\s+/g, ' ').trim();
  return (text || `${business.category.name} در ${business.city.name}؛ اطلاعات تماس، نشانی و جزئیات کسب‌وکار در شهرجو.`).slice(0, 160);
}

function socialUrls(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.values(value as Record<string, unknown>)
    .filter((item): item is string => typeof item === 'string' && /^https?:\/\//i.test(item));
}

function openingHours(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { day?: unknown; open?: unknown; close?: unknown };
    if (typeof row.day !== 'string' || typeof row.open !== 'string' || !row.open) return [];
    return [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: row.day,
      opens: row.open,
      ...(typeof row.close === 'string' && row.close ? { closes: row.close } : {}),
    }];
  });
}

function businessJsonLd(business: BusinessDetailData) {
  const url = absoluteUrl(`/business/${business.id}`);
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}#business`,
    name: business.name,
    url,
    description: businessDescription(business),
    areaServed: { '@type': 'City', name: business.city.name },
    address: {
      '@type': 'PostalAddress',
      ...(business.address ? { streetAddress: business.address } : {}),
      addressLocality: business.city.name,
      addressCountry: 'IR',
    },
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(business.logoUrl ? { image: absoluteUrl(business.logoUrl) } : {}),
    ...(business.latitude !== null && business.longitude !== null
      ? { geo: { '@type': 'GeoCoordinates', latitude: business.latitude, longitude: business.longitude } }
      : {}),
    ...(business.ratingCount > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: business.rating, ratingCount: business.ratingCount, bestRating: 5, worstRating: 1 } }
      : {}),
    ...(socialUrls(business.socialLinks).length ? { sameAs: socialUrls(business.socialLinks) } : {}),
    ...(openingHours(business.workingHours).length ? { openingHoursSpecification: openingHours(business.workingHours) } : {}),
  };
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) return { title: 'کسب‌وکار پیدا نشد', robots: { index: false, follow: false } };
  const title = `${business.name} | ${business.category.name} در ${business.city.name}`;
  const description = businessDescription(business);
  const url = absoluteUrl(`/business/${business.id}`);
  return { title, description, alternates: { canonical: url }, openGraph: openGraphFor({ url, title, description }) };
}

/** Business detail route — /business/30 */
export default async function BusinessPage({ params }: PageProps) {
  const { id } = await params;
  const business = await getBusiness(id);
  return (
    <>
      {business && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: businessJsonLd(business) }} />}
      <BusinessDetail id={Number(id)} />
    </>
  );
}
