'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  approveAdminAd,
  approveAdminBusiness,
  approveAdminSubscription,
  getAdminAds,
  getAdminBusinesses,
  getAdminOverview,
  getAdminSubscriptions,
  getProfile,
  getTokens,
  rejectAdminAd,
  rejectAdminBusiness,
  rejectAdminSubscription,
} from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminOverview, QueueAd, QueueBusiness, QueueSubscription } from '@/lib/types';

type Tab = 'ads' | 'businesses' | 'subscriptions';
type QueueStatus = { ads: string; businesses: string; subscriptions: string };

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'ads', label: 'آگهی‌ها', icon: '📝' },
  { key: 'businesses', label: 'کسب‌وکارها', icon: '🏬' },
  { key: 'subscriptions', label: 'اشتراک‌ها', icon: '👑' },
];

const STATUS_OPTIONS: Record<Tab, string[]> = {
  ads: ['PENDING', 'APPROVED', 'REJECTED'],
  businesses: ['PENDING', 'APPROVED', 'REJECTED'],
  subscriptions: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED'],
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'در انتظار',
  APPROVED: 'تأیید شده',
  REJECTED: 'رد شده',
  PENDING_REVIEW: 'در انتظار بررسی',
  ACTIVE: 'فعال',
};

/**
 * Admin moderation panel (Phase 8): queues for ads, businesses and paid
 * subscriptions with approve/reject actions. The API enforces permissions
 * and city scope — this component only hides what the operator cannot do.
 */
export function AdminPanel() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<Tab>('ads');
  const [status, setStatus] = useState<QueueStatus>({ ads: 'PENDING', businesses: 'PENDING', subscriptions: 'PENDING_REVIEW' });
  const [ads, setAds] = useState<QueueAd[]>([]);
  const [businesses, setBusinesses] = useState<QueueBusiness[]>([]);
  const [subs, setSubs] = useState<QueueSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await getAdminOverview());
    } catch {
      // non-fatal: counters are cosmetic
    }
  }, []);

  const loadQueue = useCallback(async (activeTab: Tab, activeStatus: string) => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'ads') setAds(await getAdminAds(activeStatus));
      else if (activeTab === 'businesses') setBusinesses(await getAdminBusinesses(activeStatus));
      else setSubs(await getAdminSubscriptions(activeStatus));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت فهرست ممکن نشد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/admin');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const me = await getProfile();
        if (!alive) return;
        const isAdmin = me.roles.some((r) => r !== 'USER');
        setAllowed(isAdmin);
        if (isAdmin) {
          await loadOverview();
          await loadQueue('ads', 'PENDING');
        }
      } catch {
        if (alive) setAllowed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router, loadOverview, loadQueue]);

  async function switchTab(next: Tab) {
    setTab(next);
    await loadQueue(next, status[next]);
  }

  async function switchStatus(next: string) {
    setStatus((s) => ({ ...s, [tab]: next }));
    await loadQueue(tab, next);
  }

  async function run(action: () => Promise<unknown>, success: string, id: number) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await Promise.all([loadQueue(tab, status[tab]), loadOverview()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'عملیات انجام نشد');
    } finally {
      setBusyId(null);
    }
  }

  async function askReason(): Promise<string | null> {
    // Simple prompt keeps the panel dependency-free; empty/cancel = abort.
    return window.prompt('علت رد چیست؟ (حداقل ۳ حرف)');
  }

  if (allowed === null) {
    return (
      <div className="ad-page">
        <p className="loading muted" aria-busy>
          در حال بررسی دسترسی…
        </p>
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="ad-page">
        <section className="result-card result-card--err">
          <div className="result-card__icon" aria-hidden>
            🔒
          </div>
          <h1>دسترسی ندارید</h1>
          <p>این بخش فقط برای مدیران شهرجو است. اگر فکر می‌کنید این اشتباه است، با پشتیبانی تماس بگیرید.</p>
          <div className="result-card__actions">
            <Link href="/" className="btn btn-primary">
              صفحه اصلی
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const queue: (QueueAd | QueueBusiness | QueueSubscription)[] =
    tab === 'ads' ? ads : tab === 'businesses' ? businesses : subs;

  return (
    <div className="ad-page" data-testid="admin-panel">
      <section className="plans-hero">
        <span className="icon-tile icon-tile--lg" aria-hidden>
          🛡️
        </span>
        <div>
          <h1>پنل مدیریت</h1>
          <p className="muted">تأیید آگهی‌ها، کسب‌وکارها و اشتراک‌های پرداخت‌شده</p>
        </div>
      </section>

      {overview && (
        <div className="stats-row" data-testid="admin-stats">
          <div className="stat-card">
            <span aria-hidden>📝</span>
            <strong>{overview.pendingAds.toLocaleString('fa-IR')}</strong>
            <span className="muted small">آگهی در انتظار</span>
          </div>
          <div className="stat-card">
            <span aria-hidden>🏬</span>
            <strong>{overview.pendingBusinesses.toLocaleString('fa-IR')}</strong>
            <span className="muted small">کسب‌وکار در انتظار</span>
          </div>
          <div className="stat-card">
            <span aria-hidden>👑</span>
            <strong>{overview.pendingSubscriptions.toLocaleString('fa-IR')}</strong>
            <span className="muted small">اشتراک در انتظار</span>
          </div>
        </div>
      )}

      <div className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`admin-tab ${tab === t.key ? 'admin-tab--active' : ''}`}
            onClick={() => switchTab(t.key)}
            data-testid={`tab-${t.key}`}
          >
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
        <select
          className="admin-status-select"
          aria-label="فیلتر وضعیت"
          value={status[tab]}
          onChange={(e) => switchStatus(e.target.value)}
          data-testid="status-filter"
        >
          {STATUS_OPTIONS[tab].map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="banner banner--ok" role="status">
          {notice}
        </div>
      )}

      {loading && (
        <p className="loading muted" aria-busy>
          در حال بارگذاری…
        </p>
      )}

      {!loading && queue.length === 0 && (
        <p className="empty-state" data-testid="empty-queue">
          در این فهرست موردی نیست ✅
        </p>
      )}

      {!loading && queue.length > 0 && (
        <ul className="admin-list" data-testid="admin-list">
          {queue.map((row) => (
            <li key={row.id} className="admin-row" data-testid={`row-${row.id}`}>
              <div className="admin-row__body">
                {'title' in row && (
                  <>
                    <strong>
                      {row.category.icon} {row.title}
                    </strong>
                    <span className="muted small">
                      {row.city.name} · {row.owner.phone} · {formatDate(row.createdAt)}
                      {'imageCount' in row && row.imageCount > 0 && ` · ${row.imageCount.toLocaleString('fa-IR')} عکس`}
                    </span>
                  </>
                )}
                {'slug' in row && (
                  <>
                    <strong>
                      {row.category.icon} {row.name}
                    </strong>
                    <span className="muted small">
                      {row.city.name} · {row.owner.phone} · {formatDate(row.createdAt)}
                      {row.address && ` · 📍 ${row.address}`}
                      {row.latitude !== null && row.longitude !== null && ' · 📌 مختصات ثبت شده'}
                    </span>
                  </>
                )}
                {'plan' in row && (
                  <>
                    <strong>
                      👑 اشتراک {row.plan.label} — {row.business ? row.business.name : 'شخصی'}
                    </strong>
                    <span className="muted small">
                      {(row.business?.city.name ?? 'کاربر شخصی') +
                        ' · ' +
                        row.payer.phone +
                        ' · ' +
                        formatDate(row.createdAt)}
                    </span>
                  </>
                )}
              </div>
              <div className="admin-row__actions">
                {'title' in row && row.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost admin-action admin-action--ok"
                      disabled={busyId === row.id}
                      onClick={() => run(() => approveAdminAd(row.id), 'آگهی تأیید شد', row.id)}
                      data-testid={`approve-${row.id}`}
                    >
                      تأیید
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost admin-action admin-action--err"
                      disabled={busyId === row.id}
                      onClick={async () => {
                        const reason = await askReason();
                        if (reason && reason.trim().length >= 3) {
                          await run(() => rejectAdminAd(row.id, reason), 'آگهی رد شد', row.id);
                        }
                      }}
                      data-testid={`reject-${row.id}`}
                    >
                      رد
                    </button>
                  </>
                )}
                {'slug' in row && row.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost admin-action admin-action--ok"
                      disabled={busyId === row.id}
                      onClick={() => run(() => approveAdminBusiness(row.id), 'کسب‌وکار تأیید شد', row.id)}
                      data-testid={`approve-${row.id}`}
                    >
                      تأیید
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost admin-action admin-action--err"
                      disabled={busyId === row.id}
                      onClick={async () => {
                        const reason = await askReason();
                        if (reason && reason.trim().length >= 3) {
                          await run(() => rejectAdminBusiness(row.id, reason), 'کسب‌وکار رد شد', row.id);
                        }
                      }}
                      data-testid={`reject-${row.id}`}
                    >
                      رد
                    </button>
                  </>
                )}
                {'plan' in row && row.status === 'PENDING_REVIEW' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost admin-action admin-action--ok"
                      disabled={busyId === row.id}
                      onClick={() => run(() => approveAdminSubscription(row.id), 'اشتراک فعال شد', row.id)}
                      data-testid={`approve-${row.id}`}
                    >
                      فعال‌سازی
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost admin-action admin-action--err"
                      disabled={busyId === row.id}
                      onClick={async () => {
                        const reason = await askReason();
                        if (reason && reason.trim().length >= 3) {
                          await run(() => rejectAdminSubscription(row.id, reason), 'اشتراک رد شد', row.id);
                        }
                      }}
                      data-testid={`reject-${row.id}`}
                    >
                      رد
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
