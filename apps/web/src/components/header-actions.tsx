'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, getTokens, logoutServer } from '@/lib/api';
import type { MeResponse } from '@/lib/types';

function HeaderActionIcon({ type }: { type: 'user' | 'logout' }) {
  return type === 'user' ? (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c.8-3.1 3-4.7 6.5-4.7s5.7 1.6 6.5 4.7" />
    </svg>
  ) : (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10M13 8l4 4-4 4M9 12h8" />
    </svg>
  );
}

/** Login state / logout in the site header. */
export function HeaderActions() {
  const [me, setMe] = useState<MeResponse | null>(null);
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

  const logout = async () => {
    await logoutServer();
    setMe(null);
    window.location.assign('/');
  };

  if (!me) {
    return (
      <Link href="/login" className="btn btn-ghost">
        <HeaderActionIcon type="user" />
        ورود
      </Link>
    );
  }

  // The admin entry is NOT in the header any more (only operators ever saw it,
  // and it lives in the profile page where it belongs) — the header is for
  // everyone, signed in or not. The top-left slot greets the visitor by NAME
  // (display name when they set one, phone otherwise) instead of the bare
  // «ورود» button. The notification bell was removed by request: it crowded
  // the header on phones (the installed app's too) and the inbox lives in the
  // profile page instead.
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
        <HeaderActionIcon type="user" /> {displayName}
      </Link>
      <button type="button" className="btn btn-ghost header-logout" onClick={logout} data-testid="header-logout" aria-label="خروج">
        <span className="header-logout__icon" aria-hidden><HeaderActionIcon type="logout" /></span>
        <span className="header-logout__label">خروج</span>
      </button>
    </div>
  );
}
