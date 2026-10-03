import type { Metadata } from 'next';
import { AdForm } from '@/components/ad-form';

export const metadata: Metadata = {
  title: 'ثبت آگهی',
};

/** Ad submission (Phase 5): form + image upload → moderation queue. */
export default function NewAdPage() {
  return <AdForm />;
}
