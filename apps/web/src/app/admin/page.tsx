import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminPanel } from '@/components/admin-panel';

export const metadata: Metadata = {
  title: 'پنل مدیریت',
};

/** Admin moderation panel (Phase 8) — operators only. */
export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPanel />
    </Suspense>
  );
}
