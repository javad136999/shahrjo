import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { absoluteUrl } from '@/lib/site';

interface LegacyCityNewsPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Compatibility route: older bookmarks to «اخبار شهر» now open the city
 * tourism guide. The header and the public entry point use /tourism.
 */
export async function generateMetadata({ params }: LegacyCityNewsPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `گردشگری شهر | ${slug}`,
    alternates: { canonical: absoluteUrl(`/city/${slug}/tourism`) },
    robots: { index: false, follow: true },
  };
}

export default async function LegacyCityNewsPage({ params }: LegacyCityNewsPageProps) {
  const { slug } = await params;
  redirect(`/city/${slug}/tourism`);
}
