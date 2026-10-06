'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getLocalCity } from '@/lib/api';
import type { LocalCity } from '@/lib/types';

/**
 * Header quick actions (JamCity-style pills): the city's news page and the
 * remembered city's name — clicking the city name opens the city picker so
 * the user can switch cities. The city is read client-side after mount so
 * SSR output stays deterministic (no hydration mismatch).
 */
export function HeaderPills() {
  const [city, setCity] = useState<LocalCity | null>(null);

  useEffect(() => {
    setCity(getLocalCity());
  }, []);

  return (
    <div className="header-pills">
      <Link
        href={city ? `/city/${city.slug}/news` : '/'}
        className="pill"
        title="اخبار شهر"
        data-testid="header-news-pill"
      >
        <span aria-hidden>📰</span>
        <span className="pill__label">اخبار</span>
      </Link>
      {city ? (
        // the city's name opens the picker: click → choose another city
        <Link href="/" className="pill" title="انتخاب شهر" data-testid="header-city-pill">
          <span aria-hidden>🏙</span>
          <span className="pill__label">{city.name}</span>
        </Link>
      ) : (
        <Link href="/" className="pill" data-testid="header-city-pill">
          <span aria-hidden>🏙</span>
          <span className="pill__label">انتخاب شهر</span>
        </Link>
      )}
      <Link href="/ads/new" className="pill pill--brand" data-testid="header-submit-pill">
        <span aria-hidden>📝</span>
        <span className="pill__label">ثبت آگهی</span>
      </Link>
      <Link href="/plans" className="pill pill--gold" data-testid="header-plans-pill">
        <span aria-hidden>👑</span>
        <span className="pill__label">اشتراک</span>
      </Link>
    </div>
  );
}
