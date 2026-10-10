import type { Metadata } from 'next';
import { BusinessRegistrationForm } from '@/components/business-registration-form';

export const metadata: Metadata = { title: 'ثبت کسب‌وکار' };

export default function RegisterBusinessPage() {
  return <BusinessRegistrationForm />;
}
