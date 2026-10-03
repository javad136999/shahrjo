'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getLocalCity } from '@/lib/api';
import type { LocalCity } from '@/lib/types';

/**
 * Header quick actions (JamCity-style pills): the remembered city and the ad
 * submission entry. The city is read client-side after mount so SSR output
 * stays deterministic (no hydration mismatch).
 */
export function HeaderPills() {
  const [city, setCity] = useState<LocalCity | null>(null);

  useEffect(() => {
    setCity(getLocalCity());
  }, []);

  return (
    <div className="header-pills">
      {city ? (
        // a city is chosen: a dedicated icon back to the city picker + a link to its dashboard
        <>
          <Link
            href="/"
            className="pill pill--icon"
            aria-label="انتخاب شهر"
            title="انتخاب شهر"
            data-testid="header-city-select"
          >
            <span aria-hidden>📍</span>
          </Link>
          <Link href={`/city/${city.slug}`} className="pill" data-testid="header-city-pill">
            <span aria-hidden>🏙</span>
            <span className="pill__label">{city.name}</span>
          </Link>
        </>
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
    </div>
  );
}
