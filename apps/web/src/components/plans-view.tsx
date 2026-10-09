'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, checkoutPlan, getMyBusinesses, getMySubscriptions, getPlans, getTokens } from '@/lib/api';
import { redirectTo } from '@/lib/navigation';
import type { MyBusinessItem, MySubscription, PlanItem } from '@/lib/types';
import { StatusChip } from './my-ads';

const TIER_META: Record<string, { icon: string; label: string }> = {
  GOLD: { icon: '👑', label: 'طلایی' },
  SILVER: { icon: '🥈', label: 'نقره‌ای' },
  FREE: { icon: '🆓', label: 'رایگان' },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'فعال', cls: 'chip--ok' },
  PENDING_REVIEW: { label: 'در انتظار تأیید', cls: 'chip--warn' },
  EXPIRED: { label: 'منقضی', cls: 'chip--muted' },
  REJECTED: { label: 'رد شده', cls: 'chip--err' },
  CANCELED: { label: 'لغو شده', cls: 'chip--muted' },
};

function formatRial(price: number): string {
  return `${price.toLocaleString('fa-IR')} ریال`;
}

function formatDays(days: number): string {
  if (days % 30 === 0 && days >= 30) {
    const months = days / 30;
    return `${months.toLocaleString('fa-IR')} ماهه`;
  }
  return `${days.toLocaleString('fa-IR')} روزه`;
}

/**
 * Subscription plans (Phase 7): shows Gold/Silver tiers, starts a ZarinPal
 * checkout (the browser is redirected to the gateway) and lists the caller's
 * current subscriptions + payment history.
 */
export function PlansView() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanItem[] | null>(null);
  const [subs, setSubs] = useState<MySubscription[]>([]);
  /** Set when the page was opened as `/plans?business=<id>` (registration flow). */
  const [targetBusiness, setTargetBusiness] = useState<MyBusinessItem | null>(null);
  const [businessNotice, setBusinessNotice] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const hasTokens = getTokens() !== null;
    setLoggedIn(hasTokens);

    // Read once on the client so the page stays statically prerendered.
    const raw = new URLSearchParams(window.location.search).get('business');
    const businessId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;

    (async () => {
      try {
        const [planRows, subRows, myBusinesses] = await Promise.all([
          getPlans(),
          hasTokens ? getMySubscriptions().catch(() => []) : Promise.resolve([]),
          hasTokens && businessId !== null ? getMyBusinesses().catch(() => []) : Promise.resolve([]),
        ]);
        if (!alive) return;
        setPlans(planRows);
        setSubs(subRows);
        if (businessId !== null) {
          if (!hasTokens) return; // login gate keeps the param via `next`
          const found = myBusinesses.find((b) => b.id === businessId) ?? null;
          setTargetBusiness(found);
          if (!found) {
            // Never attach a payment to an unverified id — fall back to a
            // personal plan and say so.
            setBusinessNotice('کسب‌وکار موردنظر در فهرست شما یافت نشد؛ پرداخت شخصی انجام می‌شود.');
          }
        }
      } catch (err) {
        if (!alive) return;
        setPageError(err instanceof ApiError ? err.message : 'دریافت پلن‌ها ممکن نشد');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function buy(plan: PlanItem) {
    setError(null);
    if (!loggedIn) {
      const raw = new URLSearchParams(window.location.search).get('business');
      const back = raw !== null && /^\d+$/.test(raw)
        ? `/login?next=${encodeURIComponent(`/plans?business=${raw}`)}`
        : '/login?next=/plans';
      router.replace(back);
      return;
    }
    setLoading(plan.id);
    try {
      const session = await checkoutPlan(
        targetBusiness ? { planId: plan.id, businessId: targetBusiness.id } : { planId: plan.id },
      );
      // Full navigation: the gateway owns the next page.
      redirectTo(session.payUrl);
    } catch (err) {
      setLoading(null);
      setError(err instanceof ApiError ? err.message : 'شروع پرداخت ممکن نشد؛ دوباره تلاش کنید');
    }
  }

  /** Cheapest real price per tier straight from the DB rows (no invented numbers). */
  function minPriceOf(tier: string): string {
    const rows = (plans ?? []).filter((p) => p.tier === tier);
    if (rows.length === 0) return '—';
    return formatRial(Math.min(...rows.map((p) => p.price)));
  }

  return (
    <div className="ad-page">
      <section className="plans-hero">
        <span className="icon-tile icon-tile--lg" aria-hidden>👑</span>
        <div>
          <h1>اشتراک ویژه</h1>
          <p className="muted">
            با اشتراک طلایی یا نقره‌ای، کسب‌وکارت را در صدر ویترین شهرش نشان بده. پرداخت امن از طریق درگاه زرین‌پال.
          </p>
        </div>
      </section>

      {pageError && <div className="banner banner--error">{pageError}</div>}
      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      {targetBusiness && (
        <div className="banner banner--ok" data-testid="business-plan-target">
          <span aria-hidden>🏬</span>
          <span>
            خرید اشتراک برای کسب‌وکار «{targetBusiness.name}» — وضعیت درخواست:{' '}
            <StatusChip status={targetBusiness.status} />
          </span>
        </div>
      )}
      {businessNotice && (
        <div className="banner banner--warn" role="status" data-testid="business-plan-notice">
          {businessNotice}
        </div>
      )}

      {subs.length > 0 && (
        <section className="dash-section">
          <div className="dash-section__head">
            <span className="icon-tile" aria-hidden>⭐</span>
            <div className="dash-section__title">
              <h2>اشتراک‌های من</h2>
              <p className="dash-section__sub">وضعیت اشتراک‌های خریداری‌شده</p>
            </div>
          </div>
          <div className="subs-list">
            {subs.map((sub) => {
              const status = STATUS_META[sub.status] ?? { label: sub.status, cls: 'chip--muted' };
              const tier = TIER_META[sub.tier] ?? { icon: '⭐', label: sub.tier };
              return (
                <div className="sub-row" key={sub.id} data-testid="my-subscription">
                  <span aria-hidden>{tier.icon}</span>
                  <div className="sub-row__body">
                    <strong>
                      اشتراک {tier.label} — {sub.plan.label}
                    </strong>
                    <span className="sub-row__meta">
                      {sub.business ? `کسب‌وکار: ${sub.business.name}` : 'اشتراک شخصی'}
                      {sub.expiresAt ? ` · تا ${new Date(sub.expiresAt).toLocaleDateString('fa-IR')}` : ''}
                    </span>
                  </div>
                  <span className={`chip ${status.cls}`}>{status.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="dash-section">
        <div className="dash-section__head">
          <span className="icon-tile" aria-hidden>🏷️</span>
          <div className="dash-section__title">
            <h2>پلن‌های اشتراک</h2>
            <p className="dash-section__sub">مدت و قیمت هر پلن را بررسی و یکی را انتخاب کن</p>
          </div>
        </div>

        {!plans && !pageError && (
          <p className="loading muted" aria-busy>
            در حال بارگذاری پلن‌ها…
          </p>
        )}

        {plans && (
          <div className="plans-grid" data-testid="plans-grid">
            {plans.map((plan) => {
              const tier = TIER_META[plan.tier] ?? { icon: '⭐', label: plan.tier };
              const busy = loading === plan.id;
              return (
                <article
                  key={plan.id}
                  className={`plan-card plan-card--${plan.tier.toLowerCase()}`}
                  data-testid="plan-card"
                >
                  {plan.badge && <span className="plan-card__badge">{plan.badge}</span>}
                  <div className="plan-card__tier">
                    <span aria-hidden>{tier.icon}</span> {tier.label}
                  </div>
                  <div className="plan-card__duration">{formatDays(plan.durationDays)}</div>
                  <div className="plan-card__price">{formatRial(plan.price)}</div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => buy(plan)}
                    disabled={busy}
                    data-testid={`buy-${plan.code}`}
                  >
                    {busy ? 'در حال اتصال به درگاه…' : 'پرداخت و فعال‌سازی'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="dash-section" data-testid="plans-compare">
        <div className="dash-section__head">
          <span className="icon-tile" aria-hidden>⚖️</span>
          <div className="dash-section__title">
            <h2>مقایسه امکانات</h2>
            <p className="dash-section__sub">
              بر اساس قوانین پیاده‌شدهٔ فعلی شهرجو؛ قیمت‌ها همان مقادیر دیتابیس است
            </p>
          </div>
        </div>
        {!plans && !pageError && (
          <p className="loading muted" aria-busy>
            در حال بارگذاری پلن‌ها…
          </p>
        )}
        {plans && (
          <div className="compare-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">امکان</th>
                  <th scope="col">طلایی 👑</th>
                  <th scope="col">نقره‌ای 🥈</th>
                  <th scope="col">رایگان</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">حضور در ویترین طلایی بالای نقشه</th>
                  <td>✓</td>
                  <td>✓</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th scope="row">جایگاه در ویترین</th>
                  <td>اول از همه</td>
                  <td>بعد از طلایی‌ها</td>
                  <td>در ویترین نیست</td>
                </tr>
                <tr>
                  <th scope="row">بازنشانی روزانه در دیوار شهر</th>
                  <td>۲ بار (صبح و عصر)</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th scope="row">شروع قیمت از</th>
                  <td>{minPriceOf('GOLD')}</td>
                  <td>{minPriceOf('SILVER')}</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="plans-note">
        <p>
          ✅ پرداخت شخصی بلافاصله فعال می‌شود · پلن‌های کسب‌وکاری پس از تأیید مدیر فعال خواهند شد.
        </p>
        <p>
          کسب‌وکار داری؟ در <Link href="/businesses/new">صفحه ثبت کسب‌وکار</Link> از لیست «کسب‌وکارهای
          من» اشتراک را انتخاب کن یا با <code dir="ltr">?business=&lt;id&gt;</code> به همین صفحه بیا.
        </p>
      </section>
    </div>
  );
}
