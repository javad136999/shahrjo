'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CITY_CHANGED_EVENT,
  DM_CHANGED_EVENT,
  getDmUnread,
  getLocalCity,
  getTokens,
  getWallUnread,
  markWallRead,
} from '@/lib/api';
import type { LocalCity } from '@/lib/types';

interface NavItem {
  id: 'home' | 'wall' | 'messages' | 'businesses' | 'register-business' | 'profile';
  href: string;
  icon: string;
  label: string;
}

/** Unread badge refresh cadence (also refreshed on focus / DM events). */
const BADGE_POLL_MS = 30_000;

/**
 * Bottom navigation (JamCity-style): home, the public city wall, private
 * messages, «کسب‌وکارهای من» (the owner's businesses, their profile editor and
 * their menus/products), the business signup and the profile. The wall and
 * messages icons carry a red unread badge (فقط برای کاربر وارد شده): wall
 * counts posts newer than the last visit, messages counts unread private
 * messages.
 *
 * The news icon that used to sit here is gone — the news feed keeps its own
 * header pill, and the slot now opens the owner's businesses. On the *city home
 * page* the bar is always on screen, at every width (`bottom-nav--always` +
 * `body.nav-pinned`): the city dashboard must never lose its navigation.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [city, setCity] = useState<LocalCity | null>(null);
  const [hash, setHash] = useState('');
  const [unread, setUnread] = useState<{ dm: number; wall: number }>({ dm: 0, wall: 0 });
  const wallReadPending = useRef<Promise<unknown> | null>(null);

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

  // Clear the wall badge as soon as the user opens the wall. The server stores
  // this visit marker; after leaving, the badge counts only posts created later.
  useEffect(() => {
    if (!getTokens()) {
      setUnread({ dm: 0, wall: 0 });
      return;
    }
    const isWallPage = pathname === '/wall' || pathname.startsWith('/wall/');
    if (isWallPage) {
      setUnread((current) => ({ ...current, wall: 0 }));
      if (city) wallReadPending.current = markWallRead(city.id).catch(() => undefined);
    }
    let alive = true;
    const refresh = async () => {
      const wallPromise = city && !isWallPage
        ? (wallReadPending.current
          ? wallReadPending.current.then(() => getWallUnread(city.slug)).catch(() => null)
          : getWallUnread(city.slug).catch(() => null))
        : Promise.resolve(null);
      const [dm, wall] = await Promise.all([
        getDmUnread().catch(() => null),
        wallPromise,
      ]);
      if (!alive) return;
      setUnread((current) => ({ dm: dm?.total ?? 0, wall: isWallPage ? 0 : wall?.unseenCount ?? 0 }));
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
  }, [city?.id, city?.slug, pathname]);

  /** /city/<slug> exactly — the city home page keeps the bar on screen. */
  const isCityHome = /^\/city\/[^/]+\/?$/.test(pathname);
  const isTourismPage = pathname.startsWith('/city/') && pathname.endsWith('/tourism');
  const items: NavItem[] = [
    // 🏠 returns to the city the visitor already picked — only someone who has
    // never chosen a city is sent to the city-selection page (`/`).
    { id: 'home', href: city ? `/city/${city.slug}` : '/', icon: '🏠', label: 'خانه' },
    { id: 'wall', href: '/wall', icon: '🧱', label: 'دیوار' },
    { id: 'businesses', href: '/businesses', icon: '🏬', label: 'کسب‌وکارها' },
    { id: 'messages', href: '/messages', icon: '💬', label: 'پیام‌ها' },
    { id: 'register-business', href: '/business/new', icon: '🏪', label: 'ثبت کسب‌وکار' },
    { id: 'profile', href: '/profile', icon: '👤', label: 'پروفایل' },
  ];

  const isActive = (item: NavItem): boolean => {
    if (item.id === 'profile') return pathname.startsWith('/profile');
    if (item.id === 'register-business') return pathname.startsWith('/business/new');
    if (item.id === 'businesses') return pathname.startsWith('/businesses') || /^\/business\/\d+\/manage/.test(pathname);
    if (item.id === 'messages') return pathname.startsWith('/messages');
    if (item.id === 'wall') return pathname.startsWith('/wall');
    if (item.id === 'home') return (pathname === '/' || pathname.startsWith('/city/')) && !isTourismPage && !hash;
    return false;
  };

  // the pinned bar needs its own space at the bottom of the page on desktop
  useEffect(() => {
    document.body.classList.toggle('nav-pinned', isCityHome);
    return () => document.body.classList.remove('nav-pinned');
  }, [isCityHome]);

  const badgeFor = (id: NavItem['id']): number =>
    id === 'messages' ? unread.dm : id === 'wall' ? unread.wall : 0;

  return (
    <nav
      className={`bottom-nav${isCityHome ? ' bottom-nav--always' : ''}`}
      aria-label="ناوبری سریع"
      data-pinned={isCityHome ? 'true' : undefined}
    >
      {items.map((item) => {
        const badge = badgeFor(item.id);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`bottom-nav__item${isActive(item) ? ' is-active' : ''}${item.id === 'register-business' ? ' bottom-nav__item--register-business' : ''}`}
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
