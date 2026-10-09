import type { Metadata } from 'next';
import { CategoryAds } from '@/components/category-ads';

export const metadata: Metadata = {
  title: 'آگهی‌ها',
  description: 'آگهی‌های تأییدشده شهر شما، بر اساس دسته‌بندی (املاک، خودرو و…)',
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
