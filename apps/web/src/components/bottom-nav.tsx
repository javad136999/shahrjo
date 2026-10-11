'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CITY_CHANGED_EVENT,
  DM_CHANGED_EVENT,
  getDmUnread,
  getLocalCity,
  getTokens,
  getWallUnread,
} from '@/lib/api';
import type { LocalCity } from '@/lib/types';

interface NavItem {
  id: 'home' | 'news' | 'wall' | 'messages' | 'register-business' | 'profile';
  href: string;
  icon: string;
  label: string;
}

/** Unread badge refresh cadence (also refreshed on focus / DM events). */
const BADGE_POLL_MS = 30_000;

/**
 * Mobile bottom navigation (JamCity-style): home, city news, the public
 * city wall, private messages, the business signup and the profile. The
 * wall and messages icons carry a red unread badge (فقط برای کاربر وارد
 * شده): wall counts posts newer than the last visit, messages counts
 * unread private messages.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [city, setCity] = useState<LocalCity | null>(null);
  const [hash, setHash] = useState('');
  const [unread, setUnread] = useState<{ dm: number; wall: number }>({ dm: 0, wall: 0 });

  useEffect(() => {
    const sync = () => setCity(getLocalCity());
    sync();
    window.addEventListener(CITY_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CITY_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [pathname]);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [pathname]);

  // red badges: private-message unread + wall posts unseen since last visit
  useEffect(() => {
    if (!getTokens()) {
      setUnread({ dm: 0, wall: 0 });
      return;
    }
    let alive = true;
    const refresh = async () => {
      const [dm, wall] = await Promise.all([
        getDmUnread().catch(() => null),
        city ? getWallUnread(city.slug).catch(() => null) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setUnread({ dm: dm?.total ?? 0, wall: wall?.unseenCount ?? 0 });
    };
    void refresh();
    const timer = setInterval(() => void refresh(), BADGE_POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener(DM_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(DM_CHANGED_EVENT, refresh);
    };
  }, [city?.slug]);

  const cityBase = city ? `/city/${city.slug}` : '';
  const isNewsPage = pathname.startsWith('/city/') && pathname.endsWith('/news');
  const items: NavItem[] = [
    { id: 'home', href: '/', icon: '🏠', label: 'خانه' },
    { id: 'news', href: cityBase ? `${cityBase}/news` : '/', icon: '📰', label: 'اخبار' },
    { id: 'wall', href: '/wall', icon: '🧱', label: 'دیوار' },
    { id: 'messages', href: '/messages', icon: '💬', label: 'پیام‌ها' },
    { id: 'register-business', href: '/business/new', icon: '🏪', label: 'ثبت کسب‌وکار' },
    { id: 'profile', href: '/profile', icon: '👤', label: 'پروفایل' },
  ];

  const isActive = (item: NavItem): boolean => {
    if (item.id === 'profile') return pathname.startsWith('/profile');
    if (item.id === 'news') return isNewsPage;
    if (item.id === 'register-business') return pathname.startsWith('/business/new');
    if (item.id === 'messages') return pathname.startsWith('/messages');
    if (item.id === 'wall') return pathname.startsWith('/wall');
    if (item.id === 'home') return (pathname === '/' || pathname.startsWith('/city/')) && !isNewsPage && !hash;
    return false;
  };

  const badgeFor = (id: NavItem['id']): number =>
    id === 'messages' ? unread.dm : id === 'wall' ? unread.wall : 0;

  return (
    <nav className="bottom-nav" aria-label="ناوبری سریع">
      {items.map((item) => {
        const badge = badgeFor(item.id);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`bottom-nav__item${isActive(item) ? ' is-active' : ''}`}
            data-testid={`bottom-nav-${item.id}`}
          >
            <span className="bottom-nav__iconwrap" aria-hidden>
              <span className="bottom-nav__icon">{item.icon}</span>
              {badge > 0 && (
                <span className="bottom-nav__badge" data-testid={`bottom-nav-${item.id}-badge`}>
                  {badge > 99 ? '۹۹+' : badge}
                </span>
              )}
            </span>
            <span>{item.label}</span>
            {badge > 0 && <span className="sr-only">{`${badge} پیام ندیده`}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
