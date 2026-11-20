'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSiteVisitStats } from '@/lib/api';
import { CityPicker } from '@/components/city-picker';

function HeaderIcon({ type }: { type: 'store' | 'city' }) {
  if (type === 'store') {
    return (
      <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 10.5 5.8 5h12.4l1.8 5.5M4 10.5c.7 1 1.8 1.5 3 1.5s2.3-.5 3-1.5c.7 1 1.8 1.5 3 1.5s2.3-.5 3-1.5c.7 1 1.8 1.5 3 1.5s2.3-.5 3-1.5M5 11.5V19h14v-7.5M9 19v-4.5h6V19M17.5 7.5h.01" />
        <path d="M17 15.5v4M15 17.5h4" />
      </svg>
    );
  }
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" />
      <path d="M9.2 14.5h5.6V9.2H9.2v5.3ZM11 9.2V7.8h2v1.4M11.2 11.2h.01M13 11.2h.01" />
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
