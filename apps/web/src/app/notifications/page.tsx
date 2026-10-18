import type { Metadata } from 'next';
import { NotificationsView } from '@/components/notifications-view';

export const metadata: Metadata = {
  title: 'اعلان‌ها',
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <main className="notifications-page">
      <NotificationsView />
    </main>
  );
}
