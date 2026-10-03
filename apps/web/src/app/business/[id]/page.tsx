import type { Metadata } from 'next';
import { BusinessDetail } from '@/components/business-detail';

export const metadata: Metadata = {
  title: 'کسب‌وکار',
};

/** Business detail route — /business/30 */
export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BusinessDetail id={Number(id)} />;
}
