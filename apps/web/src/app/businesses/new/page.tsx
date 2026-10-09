import type { Metadata } from 'next';
import { BusinessForm } from '@/components/business-form';

export const metadata: Metadata = {
  title: 'ثبت کسب‌وکار',
};

/** Business registration wizard: info → category → contact → images → map → admin queue. */
export default function NewBusinessPage() {
  return <BusinessForm />;
}
