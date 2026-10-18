'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, getNotificationUnreadCount, getTokens, logoutServer, NOTIFICATIONS_CHANGED_EVENT } from '@/lib/api';
import type { MeResponse } from '@/lib/types';

/** Login state / logout in the site header. */
export function HeaderActions() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (!getTokens()) {
      setMe(null);
      return;
    }
    let alive = true;
    api
      .get<MeResponse>('/users/me')
      .then((profile) => {
        if (alive) setMe(profile);
      })
      .catch(() => {
        // expired session without successful refresh: api layer already cleared tokens
        if (alive) setMe(null);
      });
    return () => {
      alive = false;
    };
    // pathname: a login lands back in the app without remounting the header —
    // re-read the profile so the name shows up the moment the user is in.
  }, [pathname]);

  useEffect(() => {
    if (!getTokens()) {
      setUnreadNotifications(0);
      return;
    }
    let alive = true;
    const refresh = () => {
      void getNotificationUnreadCount()
        .then(({ total }) => {
          if (alive) setUnreadNotifications(total);
        })
        .catch(() => {
          // Keep the last known count during a temporary network failure.
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [pathname]);

  const logout = async () => {
    await logoutServer();
    setMe(null);
    window.location.assign('/');
  };

  if (!me) {
    return (
      <Link href="/login" className="btn btn-ghost">
        ورود
      </Link>
    );
  }

  // The admin entry is NOT in the header any more (only operators ever saw it,
  // and it lives in the profile page where it belongs) — the header is for
  // everyone, signed in or not. The top-left slot greets the visitor by NAME
  // (display name when they set one, phone otherwise) instead of the bare
  // «ورود» button.
  const displayName = me.fullName?.trim() || me.phone;
  return (
    <div className="header-user">
      <Link
        href="/profile"
        className="header-phone header-user__name"
        dir={me.fullName?.trim() ? 'rtl' : 'ltr'}
        title="پروفایل من"
        data-testid="header-profile"
      >
        <span aria-hidden>👤</span> {displayName}
      </Link>
      <Link
        href="/notifications"
        className="btn btn-ghost header-notifications-link"
        aria-label={unreadNotifications > 0 ? `اعلان‌ها، ${unreadNotifications} اعلان خوانده‌نشده` : 'اعلان‌ها'}
        data-testid="header-notifications"
      >
        <span aria-hidden>🔔</span>
        {unreadNotifications > 0 && (
          <span className="header-notification-badge" data-testid="header-notifications-badge">
            {unreadNotifications > 99 ? '۹۹+' : unreadNotifications}
          </span>
        )}
      </Link>
      <button type="button" className="btn btn-ghost" onClick={logout} data-testid="header-logout">
        خروج
      </button>
    </div>
  );
}
