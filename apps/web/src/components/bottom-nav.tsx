'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ApiError,
  CITY_CHANGED_EVENT,
  getConversations,
  getLocalCity,
  getProfile,
  getTokens,
  getWallUnread,
} from '@/lib/api';
import { getWallReadAt, WALL_READ_EVENT } from '@/lib/wall-read-state';
import { PRIVATE_MESSAGES_READ_EVENT } from '@/lib/message-read-state';
import type { LocalCity } from '@/lib/types';

interface NavItem {
  id: 'home' | 'news' | 'businesses' | 'wall' | 'messages' | 'register' | 'profile';
  href: string;
  icon: string;
  label: string;
  accent?: boolean;
}

function faCount(count: number): string {
  return count > 99 ? '۹۹+' : count.toLocaleString('fa-IR');
}

/**
 * Mobile quick navigation for the city, public wall, private inbox,
 * business registration and profile. Unread counts refresh on navigation,
 * city changes, tab focus, wall reads and a modest polling interval.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [city, setCity] = useState<LocalCity | null>(null);
  const [hash, setHash] = useState('');
  const [wallUnread, setWallUnread] = useState(0);
  const [privateUnread, setPrivateUnread] = useState(0);

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

  useEffect(() => {
    let active = true;
    let refreshing = false;

    const refreshUnread = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      if (!getTokens()) {
        setWallUnread(0);
        setPrivateUnread(0);
        return;
      }

      refreshing = true;
      try {
        const profile = await getProfile();
        const wallRequest = city
          ? getWallUnread(city.slug, getWallReadAt(profile.id, city.slug) ?? undefined)
          : Promise.resolve({ count: 0 });
        const [wallResult, conversationsResult] = await Promise.allSettled([
          wallRequest,
          getConversations(),
        ]);
        if (!active) return;
        if (wallResult.status === 'fulfilled') {
          setWallUnread(Math.max(0, wallResult.value.count));
        }
        if (conversationsResult.status === 'fulfilled') {
          setPrivateUnread(
            conversationsResult.value.reduce((total, conversation) => total + conversation.unreadCount, 0),
          );
        }
      } catch (error) {
        if (active && error instanceof ApiError && error.status === 401) {
          setWallUnread(0);
          setPrivateUnread(0);
        }
      } finally {
        refreshing = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== 'hidden') void refreshUnread();
    };
    void refreshUnread();
    const timer = window.setInterval(() => void refreshUnread(), 20_000);
    window.addEventListener(WALL_READ_EVENT, refreshUnread);
    window.addEventListener(PRIVATE_MESSAGES_READ_EVENT, refreshUnread);
    window.addEventListener(CITY_CHANGED_EVENT, refreshUnread);
    window.addEventListener('storage', refreshUnread);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(WALL_READ_EVENT, refreshUnread);
      window.removeEventListener(PRIVATE_MESSAGES_READ_EVENT, refreshUnread);
      window.removeEventListener(CITY_CHANGED_EVENT, refreshUnread);
      window.removeEventListener('storage', refreshUnread);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [city?.slug, pathname]);

  const cityBase = city ? `/city/${city.slug}` : '';
  const isNewsPage = pathname.startsWith('/city/') && pathname.endsWith('/news');
  const items: NavItem[] = [
    { id: 'home', href: '/', icon: '🏠', label: 'خانه' },
    { id: 'news', href: cityBase ? `${cityBase}/news` : '/', icon: '📰', label: 'اخبار' },
    { id: 'businesses', href: cityBase ? `${cityBase}#map` : '/', icon: '🗺️', label: 'نقشه' },
    { id: 'wall', href: '/wall', icon: '📣', label: 'دیوار' },
    { id: 'messages', href: '/messages', icon: '💬', label: 'پیام‌ها' },
    { id: 'register', href: '/business/register', icon: '🏪', label: 'ثبت کسب‌وکار', accent: true },
    { id: 'profile', href: '/profile', icon: '👤', label: 'پروفایل' },
  ];

  const isActive = (item: NavItem): boolean => {
    if (item.id === 'profile') return pathname.startsWith('/profile');
    if (item.id === 'news') return isNewsPage;
    if (item.id === 'businesses') return hash === '#map';
    if (item.id === 'wall') return pathname.startsWith('/wall');
    if (item.id === 'messages') return pathname.startsWith('/messages');
    if (item.id === 'register') return pathname.startsWith('/business/register');
    if (item.id === 'home') return (pathname === '/' || pathname.startsWith('/city/')) && !isNewsPage && !hash;
    return false;
  };

  return (
    <nav className="bottom-nav" aria-label="ناوبری سریع">
      {items.map((item) => {
        const count = item.id === 'wall' ? wallUnread : item.id === 'messages' ? privateUnread : 0;
        const countText = count > 0 ? faCount(count) : '';
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`bottom-nav__item${isActive(item) ? ' is-active' : ''}${item.accent ? ' bottom-nav__item--accent' : ''}`}
            data-testid={`bottom-nav-${item.id}`}
            aria-label={count > 0 ? `${item.label}، ${countText} پیام نخوانده` : item.label}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
              {count > 0 && (
                <span className="bottom-nav__badge" data-testid={`bottom-nav-${item.id}-count`}>
                  {countText}
                </span>
              )}
            </span>
            <span className="bottom-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
