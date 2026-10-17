import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlansView } from '@/components/plans-view';
import { absoluteUrl, openGraphFor } from '@/lib/site';

export const metadata: Metadata = {
  // already ends in «شهرجو» → absolute, so the template cannot append it twice
  title: { absolute: 'طرح‌های ویژه شهرجو | معرفی آگهی و کسب‌وکار' },
  description:
    'طرح‌های شهرجو برای دیده‌شدن آگهی و معرفی کسب‌وکار محلی را بررسی کنید. جزئیات و شرایط هر طرح را پیش از انتخاب بخوانید.',
  alternates: { canonical: absoluteUrl('/plans') },
  openGraph: openGraphFor({
    url: absoluteUrl('/plans'),
    title: 'طرح‌های ویژه شهرجو | معرفی آگهی و کسب‌وکار',
    description:
      'طرح‌های شهرجو برای دیده‌شدن آگهی و معرفی کسب‌وکار محلی را بررسی کنید. جزئیات و شرایط هر طرح را پیش از انتخاب بخوانید.',
  }),
};

/** Subscription plans (Phase 7) — checkout hands off to ZarinPal. */
export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansView />
    </Suspense>
  );
}
