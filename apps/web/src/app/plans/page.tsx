import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlansView } from '@/components/plans-view';

export const metadata: Metadata = {
  title: 'اشتراک ویژه',
};

/** Subscription plans (Phase 7) — checkout hands off to ZarinPal. */
export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansView />
    </Suspense>
  );
}
