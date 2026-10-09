'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getTokens, logoutServer } from '@/lib/api';
import type { MeResponse } from '@/lib/types';

/** Login state / logout in the site header. */
export function HeaderActions() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (!getTokens()) return;
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
  }, []);

  const logout = async () => {
    await logoutServer();
    setMe(null);
    window.location.assign('/');
  };

  const businessLink = (
    <Link
      href="/businesses/new"
      className="pill"
      title="ثبت کسب‌وکار"
      data-testid="header-business-new"
    >
      <span aria-hidden>🏪</span>
      <span className="pill__label">ثبت کسب‌وکار</span>
    </Link>
  );

  if (!me) {
    return (
      <div className="header-user">
        {businessLink}
        <Link href="/login" className="btn btn-ghost">
          ورود
        </Link>
      </div>
    );
  }

  const isOperator = me.roles.some((r) => r !== 'USER');

  return (
    <div className="header-user">
      {businessLink}
      {isOperator && (
        <Link href="/admin" className="pill pill--gold" title="پنل مدیریت" data-testid="header-admin">
          <span aria-hidden>🛡️</span>
          <span className="pill__label">مدیریت</span>
        </Link>
      )}
      <Link href="/profile" className="header-phone" dir="ltr" title="پروفایل من" data-testid="header-profile">
        {me.phone}
      </Link>
      <button type="button" className="btn btn-ghost" onClick={logout}>
        خروج
      </button>
    </div>
  );
}
