'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSiteVisitStats, getTokens } from '@/lib/api';
import { CityPicker } from '@/components/city-picker';

function HeaderIcon({ type }: { type: 'store' | 'eye' | 'city' }) {
  if (type === 'store') {
    return (
      <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 10v9h16v-9M3 10l2-5h14l2 5M3 10c.7 1.1 1.8 1.7 3 1.7S8.3 11.1 9 10c.7 1.1 1.8 1.7 3 1.7s2.3-.6 3-1.7c.7 1.1 1.8 1.7 3 1.7s2.3-.6 3-1.7M9 19v-5h6v5" />
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
 * Header quick actions: business signup and the «انتخاب شهر» pill.
 * The pill opens the in-place city picker (search + suggestions) instead of
 * navigating — it is the single entry point for changing city, since the
 * header's first slot only displays where you are. The «ثبت آگهی» entry no
 * longer lives here: it moved to the composer of the city wall.
 */
export function HeaderPills() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [yearlyVisits, setYearlyVisits] = useState<number | null>(null);
  const pathname = usePathname();

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
        href="/business/new"
        className="pill header-register-business"
        title="ثبت کسب‌وکار"
        aria-label="ثبت کسب‌وکار"
        data-testid="header-register-business-pill"
      >
        <HeaderIcon type="store" />
        <span className="pill__label">ثبت کسب‌وکار</span>
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
      <Link
        href="/business/new"
        className="pill header-register-business"
        title="ثبت کسب‌وکار"
        aria-label="ثبت کسب‌وکار"
        data-testid="header-register-business"
      >
        <span className="header-register-business__icon" aria-hidden="true">🏪</span>
        <span className="pill__label header-register-business__label">ثبت کسب‌وکار</span>
      </Link>
      <CityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
