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

  if (!me) {
    return (
      <Link href="/login" className="btn btn-ghost">
        ورود
      </Link>
    );
  }

  // The admin entry is NOT in the header any more (only operators ever saw it,
  // and it lives in the profile page where it belongs) — the header is for
  // everyone, signed in or not.
  return (
    <div className="header-user">
      <Link href="/profile" className="header-phone" dir="ltr" title="پروفایل من" data-testid="header-profile">
        {me.phone}
      </Link>
      <button type="button" className="btn btn-ghost" onClick={logout}>
        خروج
      </button>
    </div>
  );
}
