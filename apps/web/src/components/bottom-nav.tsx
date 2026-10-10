'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CITY_CHANGED_EVENT, getLocalCity } from '@/lib/api';
import type { LocalCity } from '@/lib/types';

interface NavItem {
  id: 'home' | 'news' | 'register-business' | 'profile';
  href: string;
  icon: string;
  label: string;
}

/**
 * Mobile bottom navigation (JamCity-style): home, city news and the city
 * map (business pins). News has its own page (`/city/<slug>/news`); without
 * a remembered city the entries fall back to the city picker. The «ثبت آگهی»
 * action moved into the city-wall composer (Phase 10), so it is gone here.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [city, setCity] = useState<LocalCity | null>(null);
  const [hash, setHash] = useState('');

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

  const cityBase = city ? `/city/${city.slug}` : '';
  const isNewsPage = pathname.startsWith('/city/') && pathname.endsWith('/news');
  const items: NavItem[] = [
    { id: 'home', href: '/', icon: '🏠', label: 'خانه' },
    { id: 'news', href: cityBase ? `${cityBase}/news` : '/', icon: '📰', label: 'اخبار' },
    { id: 'register-business', href: '/business/new', icon: '🏪', label: 'ثبت کسب‌وکار' },
    { id: 'profile', href: '/profile', icon: '👤', label: 'پروفایل' },
  ];

  const isActive = (item: NavItem): boolean => {
    if (item.id === 'profile') return pathname.startsWith('/profile');
    if (item.id === 'news') return isNewsPage;
    if (item.id === 'register-business') return pathname.startsWith('/business/new');
    if (item.id === 'home') return (pathname === '/' || pathname.startsWith('/city/')) && !isNewsPage && !hash;
    return false;
  };

  return (
    <nav className="bottom-nav" aria-label="ناوبری سریع">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`bottom-nav__item${isActive(item) ? ' is-active' : ''}`}
          data-testid={`bottom-nav-${item.id}`}
        >
          <span className="bottom-nav__icon" aria-hidden>
            {item.icon}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
