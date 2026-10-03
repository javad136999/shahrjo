import type { Metadata } from 'next';
import { NewsDetail } from '@/components/news-detail';

export const metadata: Metadata = {
  title: 'خبر',
};

/** News detail route — /news/sample-slug */
export default async function NewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <NewsDetail slug={slug} />;
}
