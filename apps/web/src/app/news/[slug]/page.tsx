import type { Metadata } from 'next';
import { NewsDetail } from '@/components/news-detail';
import { serverApi } from '@/lib/server-data';
import { absoluteUrl } from '@/lib/site';
import type { NewsDetail as NewsDetailData } from '@/lib/types';

export const revalidate = 60;

interface NewsPageProps {
  params: Promise<{ slug: string }>;
}

async function getNewsForRendering(slug: string): Promise<NewsDetailData | null> {
  return serverApi<NewsDetailData>(`/news/${encodeURIComponent(slug)}/render`, 60);
}

function descriptionFor(news: NewsDetailData): string {
  const source = news.excerpt?.trim() || news.body;
  const plainText = source.replace(/\s+/g, ' ').trim();
  return plainText.length > 157 ? `${plainText.slice(0, 157).trimEnd()}…` : plainText;
}

export async function generateMetadata({ params }: NewsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const news = await getNewsForRendering(slug);

  if (!news) {
    return {
      title: 'خبر پیدا نشد',
      robots: { index: false, follow: false },
    };
  }

  const title = news.title;
  const description = descriptionFor(news);
  const url = absoluteUrl(`/news/${encodeURIComponent(news.slug)}`);
  const imageUrl = news.coverUrl ? absoluteUrl(news.coverUrl) : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: { 'max-image-preview': 'large' },
    },
    openGraph: {
      type: 'article',
      locale: 'fa_IR',
      siteName: 'شهرجو',
      url,
      title,
      description,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: title }] } : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

/** News detail route — render public article content in the initial HTML. */
export default async function NewsPage({ params }: NewsPageProps) {
  const { slug } = await params;
  const news = await getNewsForRendering(slug);
  return <NewsDetail key={slug} slug={slug} initialDetail={news} />;
}
