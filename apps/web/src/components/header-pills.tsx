'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CITY_CHANGED_EVENT, getLocalCity, getSiteVisitStats, getTokens } from '@/lib/api';
import { CityPicker } from '@/components/city-picker';
import type { LocalCity } from '@/lib/types';

function HeaderIcon({ type }: { type: 'compass' | 'eye' | 'city' }) {
  if (type === 'compass') {
    return (
      <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8.5" />
        <path d="m14.8 9.2-2.1 4.5-4.5 2.1 2.1-4.5 4.5-2.1Z" />
      </svg>
    );
  }
  if (type === 'eye') {
    return (
      <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3.5 12s3.1-5 8.5-5 8.5 5 8.5 5-3.1 5-8.5 5-8.5-5-8.5-5Z" />
        <circle cx="12" cy="12" r="2.2" />
      </svg>
    );
  }
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h16M6 20V7.5L12 4l6 3.5V20M9 20v-5h6v5M8 9h1M12 9h1M16 9h1" />
    </svg>
  );
}

/**
 * Header quick actions: the city's tourism guide and the «انتخاب شهر» pill.
 * The pill opens the in-place city picker (search + suggestions) instead of
 * navigating — it is the single entry point for changing city, since the
 * header's first slot only displays where you are. The «ثبت آگهی» entry no
 * longer lives here: it moved to the composer of the city wall.
 */
export function HeaderPills() {
  const [city, setCity] = useState<LocalCity | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [yearlyVisits, setYearlyVisits] = useState<number | null>(null);
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

  useEffect(() => {
    let alive = true;
    if (!getTokens()) {
      setYearlyVisits(null);
      return () => { alive = false; };
    }
    getSiteVisitStats()
      .then((stats) => alive && setYearlyVisits(stats.yearly.total))
      .catch(() => alive && setYearlyVisits(null));
    return () => { alive = false; };
  }, [pathname]);

  return (
    <div className="header-pills">
      <Link
        href={city ? `/city/${city.slug}/tourism` : '/'}
        className="pill"
        title="گردشگری شهر"
        aria-label="گردشگری شهر"
        data-testid="header-news-pill"
      >
        <HeaderIcon type="compass" />
        <span className="pill__label">گردشگری شهر</span>
      </Link>
      {yearlyVisits !== null && (
        <Link
          href="/profile"
          className="pill header-annual-visits"
          title="بازدید از سایت در سال جاری"
          aria-label={`بازدید سایت امسال: ${yearlyVisits.toLocaleString('fa-IR')}`}
          data-testid="header-annual-visits"
        >
          <HeaderIcon type="eye" />
          <span className="header-annual-visits__count">{yearlyVisits.toLocaleString('fa-IR')}</span>
          <span className="header-annual-visits__label">بازدید از سایت</span>
        </Link>
      )}
      {/* This is the ONLY way to change the city: it opens the picker with
          search in place — no page jump. It always reads «انتخاب شهر» rather
          than the current city, because the adjacent header slot already
          shows where you are. */}
      <button
        type="button"
        className="pill header-citybtn"
        title="انتخاب شهر"
        data-testid="header-city-pill"
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        onClick={() => setPickerOpen((open) => !open)}
      >
        <HeaderIcon type="city" />
        <span className="pill__label">انتخاب شهر</span>
      </button>
      <CityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
