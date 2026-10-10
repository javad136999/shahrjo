import type { Metadata } from 'next';
import { BusinessRegistration } from '@/components/business-registration';

export const metadata: Metadata = {
  title: 'ثبت کسب‌وکار',
  description: 'کسب‌وکارت را ثبت کن، موقعیتش را روی نقشه شهر مشخص کن و اشتراک طلایی/نقره‌ای بخر',
};

export default function NewBusinessPage() {
  return (
    <div className="ad-page">
      <BusinessRegistration />
    </div>
  );
}
