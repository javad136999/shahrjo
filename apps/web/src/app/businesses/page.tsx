import type { Metadata } from 'next';
import { MyBusinesses } from '@/components/my-businesses';

export const metadata: Metadata = {
  title: 'کسب‌وکارهای من',
};

/** Owner dashboard for the caller's businesses (+ their menus & products). */
export default function MyBusinessesPage() {
  return <MyBusinesses />;
}
