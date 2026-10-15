'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, getMyBusinesses, getTokens } from '@/lib/api';
import { formatRating } from '@/lib/format';
import type { MyBusiness } from '@/lib/types';

/** Moderation status → label + chip style (same wording as the ad lists). */
const STATUS: Record<string, string> = {
  PENDING: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  REJECTED: 'رد‌شده',
  // admin suspension AND the expiry sweep both land here — the owner still
  // sees the row (with a reactivate CTA), it just leaves every public surface
  CLOSED: 'تعلیق',
  SUSPENDED: 'تعلیق',
};

/** A suspended business (manual or expired) can come back by buying a plan. */
function isSuspended(business: MyBusiness): boolean {
  return business.status === 'CLOSED' || business.status === 'SUSPENDED' || business.subscriptionStatus === 'EXPIRED';
}

/**
 * «کسب‌وکارهای من» — the owner's businesses in every moderation status, each
 * with the entry to edit its profile and to register its menu & products.
 * Reached from the bottom navigation (the news icon it replaced still lives in
 * the header pill). Login-gated: guests are sent to /login with a `next`.
 */
export function MyBusinesses() {
  const router = useRouter();
  const [items, setItems] = useState<MyBusiness[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/businesses');
      return;
    }
    let alive = true;
    getMyBusinesses()
      .then((list) => alive && setItems(list))
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : 'دریافت کسب‌وکارها ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [router]);

  if (error) {
    return (
      <div className="banner banner--error" role="alert">
        <span>{error}</span>
      </div>
    );
  }

  if (items === null) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری کسب‌وکارها…
      </p>
    );
  }

  return (
    <section className="mybiz" data-testid="my-businesses">
      <header className="mybiz__head">
        <h1>کسب‌وکارهای من</h1>
        <Link href="/business/new" className="btn btn-primary" data-testid="my-businesses-new">
          ＋ ثبت کسب‌وکار جدید
        </Link>
      </header>
      <p className="muted small">
        مشخصات را ویرایش کن، منو بساز و برای هر محصول عکس، توضیح و قیمت بگذار — همه‌شان در صفحهٔ عمومی
        کسب‌وکارت (و برای کسانی که از روی نقشه وارد می‌شوند) دیده می‌شوند.
      </p>

      {items.length === 0 ? (
        <div className="empty-state" data-testid="my-businesses-empty">
          <p>هنوز کسب‌وکاری ثبت نکرده‌ای.</p>
          <Link href="/business/new" className="btn btn-primary">
            ثبت اولین کسب‌وکار
          </Link>
        </div>
      ) : (
        <ul className="mybiz__list">
          {items.map((business) => {
            const status = business.status.toLowerCase();
            const suspended = isSuspended(business);
            return (
              <li key={business.id} className="mybiz__card" data-testid={`my-business-${business.id}`}>
                {business.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote media
                  <img className="mybiz__logo" src={business.logoUrl} alt="" />
                ) : (
                  <span className="icon-tile icon-tile--lg" aria-hidden>
                    {business.category.icon ?? '🏬'}
                  </span>
                )}
                <div className="mybiz__body">
                  <div className="detail-meta">
                    <span className={`status-chip status-chip--${status}`}>
                      {STATUS[business.status] ?? business.status}
                    </span>
                    {business.subscriptionTier === 'GOLD' && <span className="badge badge--gold">👑 طلایی</span>}
                    {business.subscriptionTier === 'SILVER' && <span className="badge badge--silver">🥈 نقره‌ای</span>}
                  </div>
                  <b className="mybiz__name">{business.name}</b>
                  <p className="muted small">
                    {business.category.icon ?? '◆'} {business.category.name} ·{' '}
                    {formatRating(business.rating, business.ratingCount)} · 🧾{' '}
                    {business.productCount.toLocaleString('fa-IR')} محصول ·{' '}
                    {business.pinned ? '📍 روی نقشه' : 'بدون موقعیت روی نقشه'}
                  </p>
                  {suspended && (
                    <p className="mybiz__suspended" data-testid={`my-business-suspended-${business.id}`}>
                      این کسب‌وکار تعلیق است {business.subscriptionStatus === 'EXPIRED' ? '(پایان مهلت اشتراک)' : ''} و از نقشه و جستجو خارج شده. با خرید اشتراک، به همان مدتی که انتخاب می‌کنی دوباره فعال می‌شود.
                    </p>
                  )}
                  <div className="mybiz__actions">
                    {suspended ? (
                      <Link
                        href={`/plans?business=${business.id}`}
                        className="btn btn-primary"
                        data-testid={`my-business-reactivate-${business.id}`}
                      >
                        🔄 فعال‌سازی با خرید اشتراک
                      </Link>
                    ) : (
                      <Link
                        href={`/business/${business.id}/manage`}
                        className="btn btn-primary"
                        data-testid={`my-business-manage-${business.id}`}
                      >
                        ویرایش و منو
                      </Link>
                    )}
                    <Link href={`/business/${business.id}`} className="btn btn-ghost">
                      مشاهدهٔ صفحهٔ عمومی
                    </Link>
                    {suspended && (
                      <Link
                        href={`/business/${business.id}/manage`}
                        className="btn btn-ghost"
                        data-testid={`my-business-manage-${business.id}`}
                      >
                        ویرایش منو
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
