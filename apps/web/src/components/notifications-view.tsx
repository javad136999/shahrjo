'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ApiError,
  getNotifications,
  getTokens,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  type UserNotification,
} from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  SYSTEM: 'پیام سامانه',
  AD_APPROVED: 'تأیید آگهی',
  AD_REJECTED: 'وضعیت آگهی',
  MESSAGE: 'پیام جدید',
  REPORT_RESOLVED: 'رسیدگی به گزارش',
  PAYMENT: 'پرداخت',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function NotificationsView() {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!getTokens()) {
      setNeedsLogin(true);
      setLoading(false);
      return () => { alive = false; };
    }

    getNotifications()
      .then((rows) => {
        if (alive) setItems(rows);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) setNeedsLogin(true);
        else setError(err instanceof Error ? err.message : 'بارگذاری اعلان‌ها ناموفق بود');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, []);

  const markRead = async (item: UserNotification) => {
    if (item.readAt || busyId !== null) return;
    setBusyId(item.id);
    setError('');
    try {
      const updated = await markNotificationRead(item.id);
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت وضعیت اعلان ناموفق بود');
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    if (markingAll || !items.some((item) => !item.readAt)) return;
    setMarkingAll(true);
    setError('');
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => item.readAt ? item : { ...item, readAt: now }));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت وضعیت اعلان‌ها ناموفق بود');
    } finally {
      setMarkingAll(false);
    }
  };

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <section className="notifications-card">
      <header className="notifications-header">
        <div>
          <h1>اعلان‌های من</h1>
          <p className="muted">پیام‌های مربوط به حساب، آگهی‌ها و پرداخت‌ها</p>
        </div>
        {!needsLogin && unread > 0 && (
          <button className="btn btn-ghost" type="button" disabled={markingAll} onClick={() => void markAllRead()}>
            {markingAll ? 'در حال ثبت…' : 'خواندن همه'}
          </button>
        )}
      </header>

      {needsLogin && (
        <div className="notifications-empty">
          <p>برای دیدن اعلان‌ها ابتدا وارد حساب خود شوید.</p>
          <Link href="/login" className="btn btn-primary">ورود</Link>
        </div>
      )}
      {loading && <p className="muted" role="status">در حال بارگذاری اعلان‌ها…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !needsLogin && !error && items.length === 0 && (
        <div className="notifications-empty">
          <span aria-hidden>🔔</span>
          <p>هنوز اعلانی ندارید.</p>
        </div>
      )}

      <div className="notifications-list">
        {items.map((item) => (
          <article
            key={item.id}
            className={`notification-item${item.readAt ? '' : ' notification-item--unread'}`}
            data-testid={`notification-${item.id}`}
          >
            <div className="notification-item__content">
              <div className="notification-item__meta">
                <span>{TYPE_LABELS[item.type] ?? 'اعلان'}</span>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </div>
              <h2>{item.title}</h2>
              {item.body && <p>{item.body}</p>}
            </div>
            {!item.readAt && (
              <button
                type="button"
                className="btn btn-ghost notification-item__read"
                disabled={busyId !== null}
                onClick={() => void markRead(item)}
                aria-label={`علامت‌گذاری «${item.title}» به‌عنوان خوانده‌شده`}
              >
                {busyId === item.id ? '…' : 'خواندم'}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
