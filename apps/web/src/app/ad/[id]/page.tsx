import type { Metadata } from 'next';
import { AdDetail } from '@/components/ad-detail';

export const metadata: Metadata = {
  title: 'آگهی',
};

/** Ad detail route — /ad/123 */
export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdDetail id={Number(id)} />;
}
