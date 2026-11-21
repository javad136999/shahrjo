'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSiteVisitStats } from '@/lib/api';
import { CityPicker } from '@/components/city-picker';

function HeaderIcon({ type }: { type: 'store' | 'city' }) {
  if (type === 'store') {
    return (
      <svg className="header-icon header-icon--store" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 10.5V20h16v-9.5M3 10.5 5 5h14l2 5.5" />
        <path d="M3 10.5c.5 1.1 1.5 1.7 2.8 1.7s2.3-.6 2.8-1.7c.5 1.1 1.5 1.7 2.8 1.7s2.3-.6 2.8-1.7c.5 1.1 1.5 1.7 2.8 1.7s2.3-.6 2.8-1.7M8.5 20v-5h5v5M17.5 14.5v4m-2-2h4" />
      </svg>
    );
  }
  return (
    <svg className="header-icon header-icon--city" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m3.5 6 5.2-2 6.6 2 5.2-2v14l-5.2 2-6.6-2-5.2 2z" />
      <path d="M8.7 4v14m6.6-12v14" />
      <path d="M12.2 14s-2.1-2.1-2.1-4a2.1 2.1 0 1 1 4.2 0c0 1.9-2.1 4-2.1 4Z" />
      <circle cx="12.2" cy="10" r=".55" />
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
