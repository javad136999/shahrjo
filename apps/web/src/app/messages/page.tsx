import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MessagesView } from '@/components/messages-view';

export const metadata: Metadata = { title: 'پیام‌های خصوصی' };

export default function MessagesPage() {
  return (
    <Suspense fallback={<p className="muted loading" aria-busy>در حال بارگذاری پیام‌ها…</p>}>
      <MessagesView />
    </Suspense>
  );
}
