'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CITY_CHANGED_EVENT, getLocalCity } from '@/lib/api';
import { CityPicker } from '@/components/city-picker';
import type { LocalCity } from '@/lib/types';

/**
 * Header quick actions: the city's tourism guide and the «انتخاب شهر» pill.
 * The pill opens the in-place city picker (search + suggestions) instead of
 * navigating — it is the single entry point for changing city, since the
 * header's first slot only displays where you are. The «ثبت آگهی» entry no
 * longer lives here: it moved to the composer of the city wall.
 */
export function HeaderPills() {
  const [city, setCity] = useState<LocalCity | null>(null);
  // Web pages and the PWA must show the Bazaar CTA immediately. It is hidden
  // only after the Android WebView marker is positively detected; starting at
  // false made the CTA disappear on some cached/hydrated city pages.
  const [showInstall, setShowInstall] = useState(true);
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

  useEffect(() => {
    // The published Android app is an Android System WebView. Its UA contains
    // `; wv)` (and the legacy `Version/4.0` marker), unlike normal Chrome.
    // This keeps the Bazaar install CTA in the browser only, without requiring
    // a new Android APK just to hide a web-rendered header item.
    const userAgent = navigator.userAgent;
    const isAndroidWebView = /Android/i.test(userAgent) && (/[;\s]wv\)/i.test(userAgent) || /Version\/4\.0/i.test(userAgent));
    setShowInstall(!isAndroidWebView);
  }, []);

  return (
    <div className="header-pills">
      <Link
        href={city ? `/city/${city.slug}/tourism` : '/'}
        className="pill"
        title="گردشگری شهر"
        aria-label="گردشگری شهر"
        data-testid="header-news-pill"
      >
        <span aria-hidden>🧭</span>
        <span className="pill__label">گردشگری شهر</span>
      </Link>
      {showInstall && (
        <a
          href="http://cafebazaar.ir/app/?id=ir.shahrju.app&ref=share"
          className="pill header-install-pill"
          title="نصب اپلیکیشن شهرجو"
          aria-label="نصب اپلیکیشن شهرجو از بازار"
          data-testid="header-install-pill"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden>📲</span>
          <span className="pill__label">نصب</span>
        </a>
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
        <span aria-hidden>🏙</span>
        <span className="pill__label">انتخاب شهر</span>
      </button>
      <CityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
