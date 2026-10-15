import type { Metadata } from 'next';
import { AdminBusinessCreate } from '@/components/admin-business-create';

export const metadata: Metadata = {
  title: 'ثبت دستی کسب‌وکار',
};

/** Operator-only manual signup — a dedicated page off the admin panel. */
export default function AdminBusinessNewPage() {
  return <AdminBusinessCreate />;
}
