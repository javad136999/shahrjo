import type { Metadata } from 'next';
import { BusinessManage } from '@/components/business-manage';

export const metadata: Metadata = {
  title: 'مدیریت کسب‌وکار',
};

/** Owner workspace — /business/30/manage (profile edit + menu/products). */
export default async function BusinessManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const initialTab = query?.tab === 'menu' ? 'menu' : 'info';
  return <BusinessManage id={Number(id)} initialTab={initialTab} />;
}
