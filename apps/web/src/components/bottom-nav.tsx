'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocalCity } from '@/lib/api';
import type { LocalCity } from '@/lib/types';

interface NavItem {
  id: 'home' | 'news' | 'submit' | 'businesses' | 'profile';
  href: string;
  icon: string;
  label: string;
  accent?: boolean;
}

/**
 * Mobile bottom navigation (JamCity-style): home, city news, the primary
 * action (submit an ad) and city businesses. Section links deep-link into the
 * city dashboard via #news / #businesses anchors; without a remembered city
 * they fall back to the city picker.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [city, setCity] = useState<LocalCity | null>(null);
  const [hash, setHash] = useState('');

  useEffect(() => {
    setCity(getLocalCity());
  }, []);

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
  const items: NavItem[] = [
    { id: 'home', href: '/', icon: '🏠', label: 'خانه' },
    { id: 'news', href: cityBase ? `${cityBase}#news` : '/', icon: '📰', label: 'اخبار' },
    { id: 'submit', href: '/ads/new', icon: '📝', label: 'ثبت آگهی', accent: true },
    { id: 'businesses', href: cityBase ? `${cityBase}#businesses` : '/', icon: '🏬', label: 'کسب‌وکارها' },
    { id: 'profile', href: '/profile', icon: '👤', label: 'پروفایل' },
  ];

  const isActive = (item: NavItem): boolean => {
    if (item.accent) return pathname.startsWith('/ads');
    if (item.id === 'profile') return pathname.startsWith('/profile');
    if (item.id === 'home') return (pathname === '/' || pathname.startsWith('/city/')) && !hash;
    if (item.id === 'news') return hash === '#news';
    if (item.id === 'businesses') return hash === '#businesses';
    return false;
  };

  return (
    <nav className="bottom-nav" aria-label="ناوبری سریع">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`bottom-nav__item${item.accent ? ' bottom-nav__item--accent' : ''}${
            isActive(item) ? ' is-active' : ''
          }`}
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
