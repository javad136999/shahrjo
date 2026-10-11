import type { Metadata } from 'next';
import { BusinessManage } from '@/components/business-manage';

export const metadata: Metadata = {
  title: 'مدیریت کسب‌وکار',
};

/** Owner workspace — /business/30/manage (profile edit + menu/products). */
export default async function BusinessManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BusinessManage id={Number(id)} />;
}
