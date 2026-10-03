import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileView } from '@/components/profile-view';

export const metadata: Metadata = {
  title: 'پروفایل',
};

/** Profile route — /profile */
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileView />
    </Suspense>
  );
}
