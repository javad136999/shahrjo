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
      <Link href={city ? `/city/${city.slug}` : '/'} className="pill" data-testid="header-city-pill">
        <span aria-hidden>🏙</span>
        <span className="pill__label">{city ? city.name : 'انتخاب شهر'}</span>
      </Link>
      <Link href="/ads/new" className="pill pill--brand" data-testid="header-submit-pill">
        <span aria-hidden>📝</span>
        <span className="pill__label">ثبت آگهی</span>
      </Link>
    </div>
  );
}
