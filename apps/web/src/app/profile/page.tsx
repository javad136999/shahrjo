import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileView } from '@/components/profile-view';

export const metadata: Metadata = {
  title: 'پروفایل',
  // private account screen — robots.txt disallows it and this meta says the
  // same thing, so both signals agree
  robots: { index: false, follow: false },
};

/** Profile route — /profile */
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileView />
    </Suspense>
  );
}
