import type { Metadata } from 'next';
import { MyBusinesses } from '@/components/my-businesses';

export const metadata: Metadata = {
  title: 'کسب‌وکارهای من',
  // Personal owner dashboard: crawlable (robots.txt keeps no Disallow so the
  // noindex is actually seen) but never a search result — it is empty and
  // meaningless without the caller's session.
  robots: { index: false, follow: true },
};

/** Owner dashboard for the caller's businesses (+ their menus & products). */
export default function MyBusinessesPage() {
  return <MyBusinesses />;
}
