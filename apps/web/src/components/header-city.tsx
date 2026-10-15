'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CITY_CHANGED_EVENT, getLocalCity } from '@/lib/api';
import type { LocalCity } from '@/lib/types';

/**
 * The first header slot (rightmost in RTL): the name of the city the visitor
 * is currently in.
 *
 * Deliberately a `<span>`, not a link — clicking it goes nowhere, because the
 * city is not a destination, it is context («الان کجایی»). Changing it is the
 * job of the «انتخاب شهر» pill right next to it, which opens the picker with
 * search. Until a city is chosen the slot falls back to the first-run selection
 * page so a new visitor is not left with an empty corner.
 *
 * The value is read after mount (and on the city-changed / storage events) so
 * SSR output stays deterministic — the same hydration rule every other city
 * reader in the app follows.
 */
export function HeaderCity() {
  const [city, setCity] = useState<LocalCity | null>(null);

  useEffect(() => {
    const sync = () => setCity(getLocalCity());
    sync();
    window.addEventListener(CITY_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CITY_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!city) {
    return (
      <Link href="/" className="brand" data-testid="header-city-none">
        <span className="brand-mark" aria-hidden>
          🏙
        </span>
        انتخاب شهر
      </Link>
    );
  }

  return (
    <span
      className="brand brand--city"
      title={`شهر شما: ${city.name}`}
      data-testid="header-city"
      aria-label={`شهر ${city.name}`}
    >
      <span className="brand-mark" aria-hidden>
        🏙
      </span>
      <span className="brand-cityname">{city.name}</span>
    </span>
  );
}
