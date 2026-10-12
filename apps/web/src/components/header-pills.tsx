'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CITY_CHANGED_EVENT, getLocalCity } from '@/lib/api';
import { CityPicker } from '@/components/city-picker';
import type { LocalCity } from '@/lib/types';

/**
 * Header quick actions (JamCity-style pills): the city's news page and the
 * remembered city's name — clicking the city name opens the in-place city
 * picker (search + suggestions) instead of navigating to another page. The «ثبت آگهی» entry no longer lives here: it
 * moved to the composer of the city wall (Phase 10). The city is re-read
 * after mount, on navigation and whenever another part of the page stores a
 * new city, so SSR output stays deterministic (no hydration mismatch) and
 * the pill never goes stale.
 */
export function HeaderPills() {
  const [city, setCity] = useState<LocalCity | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pathname = usePathname();

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

  return (
    <div className="header-pills">
      <Link
        href={city ? `/city/${city.slug}/news` : '/'}
        className="pill"
        title="اخبار شهر"
        aria-label="اخبار شهر"
        data-testid="header-news-pill"
      >
        <span aria-hidden>📰</span>
        <span className="pill__label">اخبار شهر</span>
      </Link>
      {/* the city pill opens the picker in place — no page jump */}
      <button
        type="button"
        className="pill header-citybtn"
        title="انتخاب شهر"
        data-testid="header-city-pill"
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        onClick={() => setPickerOpen((open) => !open)}
      >
        <span aria-hidden>🏙</span>
        <span className="pill__label">{city ? city.name : 'انتخاب شهر'}</span>
      </button>
      <CityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
