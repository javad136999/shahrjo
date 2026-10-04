'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const COPY: Record<string, { icon: string; title: string; body: string; tone: string }> = {
  SUCCESS: {
    icon: '✅',
    title: 'پرداخت موفق بود',
    body: 'اشتراک شما فعال شد. اگر پلن کسب‌وکاری بود، پس از تأیید مدیر در ویترین شهر نمایش داده می‌شود.',
    tone: 'ok',
  },
  ALREADY_PAID: {
    icon: '✅',
    title: 'این پرداخت قبلاً ثبت شده است',
    body: 'نگران نباشید؛ اشتراک شما فعال است و نیازی به پرداخت دوباره نیست.',
    tone: 'ok',
  },
  CANCELED: {
    icon: '↩️',
    title: 'پرداخت لغو شد',
    body: 'شما پرداخت را لغو کردید. هیچ مبلغی کسر نشده است و می‌توانید دوباره تلاش کنید.',
    tone: 'warn',
  },
  FAILED: {
    icon: '⚠️',
    title: 'پرداخت ناموفق بود',
    body: 'درگاه پرداخت تراکنش را تأیید نکرد. اگر مبلغی از حساب شما کسر شده باشد طی ۷۲ ساعت بازمی‌گردد.',
    tone: 'err',
  },
};

function ResultBody() {
  const params = useSearchParams();
  const status = params.get('status') ?? 'FAILED';
  const copy = COPY[status] ?? COPY.FAILED;

  return (
    <div className="ad-page">
      <section className={`result-card result-card--${copy.tone}`} data-testid="payment-result" data-status={status}>
        <div className="result-card__icon" aria-hidden>
          {copy.icon}
        </div>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <div className="result-card__actions">
          <Link href="/plans" className="btn btn-primary">
            بازگشت به پلن‌ها
          </Link>
          <Link href="/" className="btn btn-ghost">
            صفحه اصلی
          </Link>
        </div>
      </section>
    </div>
  );
}

/** ZarinPal lands back here via the API callback (Phase 7). */
export default function PaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultBody />
    </Suspense>
  );
}
