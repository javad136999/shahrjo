import type { Metadata } from 'next';
import { CategoryAds } from '@/components/category-ads';
import { absoluteUrl, openGraphFor } from '@/lib/site';

export const metadata: Metadata = {
  title: 'آگهی‌های محلی شهرها',
  description:
    'آگهی‌های محلی را بر اساس شهر و دسته‌بندی پیدا کنید؛ از املاک و خودرو تا خدمات و کالاهای گوناگون.',
  alternates: { canonical: absoluteUrl('/ads') },
  openGraph: openGraphFor({
    url: absoluteUrl('/ads'),
    title: 'آگهی‌های محلی شهرها | شهرجو',
    description:
      'آگهی‌های محلی را بر اساس شهر و دسته‌بندی پیدا کنید؛ از املاک و خودرو تا خدمات و کالاهای گوناگون.',
  }),
};

/** Category-filtered ads listing — the destination of the chat-room shortcuts. */
export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return <CategoryAds category={typeof category === 'string' ? category : undefined} />;
}
