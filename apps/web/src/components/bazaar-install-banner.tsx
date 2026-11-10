'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const BAZAAR_URL = 'https://cafebazaar.ir/app/?id=ir.shahrju.app&ref=share';
const DISMISS_KEY = 'shahrjo.bazaar-install-dismissed-until';
const INSTAGRAM_DISMISS_KEY = `${DISMISS_KEY}:instagram`;
const DISMISS_DAYS = 7;
const SHOW_AFTER_MS = 6_000;

function isInstalledExperience(isInstagramBrowser: boolean): boolean {
  const standalone =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  const isFullscreenApp = !isInstagramBrowser && typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: fullscreen)').matches;
  const userAgent = navigator.userAgent;
  const isInstalledAndroidWebView = /Android/i.test(userAgent) &&
    (/[;\s]wv\)/i.test(userAgent) || /Version\/4\.0/i.test(userAgent)) &&
    !isInstagramBrowser;

  return Boolean(standalone || isFullscreenApp || isInstalledAndroidWebView);
}

function wasDismissedRecently(key: string): boolean {
  try {
    const dismissedUntil = Number(window.localStorage.getItem(key));
    if (dismissedUntil > Date.now()) return true;
    if (dismissedUntil) window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; the install link should still work.
  }
  return false;
}

/** Bazaar install nudge for browser visitors; never shown in the installed app. */
export function BazaarInstallBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const isInstagramBrowser = /Instagram/i.test(navigator.userAgent);
    const isPrivatePage =
      pathname === '/messages' || pathname.startsWith('/messages/') ||
      pathname === '/admin' || pathname.startsWith('/admin/') ||
      pathname === '/profile';
    const isCityWall = pathname === '/wall' || pathname.startsWith('/wall/');
    if (
      isPrivatePage || (isCityWall && !isInstagramBrowser)
    ) return;
    const dismissKey = isInstagramBrowser ? INSTAGRAM_DISMISS_KEY : DISMISS_KEY;
    if (isInstalledExperience(isInstagramBrowser) || wasDismissedRecently(dismissKey)) return;

    if (isInstagramBrowser) {
      setVisible(true);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const dismiss = () => {
    try {
      const key = /Instagram/i.test(navigator.userAgent) ? INSTAGRAM_DISMISS_KEY : DISMISS_KEY;
      window.localStorage.setItem(key, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      // Dismissing remains effective for the current render if storage is disabled.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="bazaar-install-banner" aria-label="نصب اپلیکیشن شهرجو" data-testid="bazaar-install-banner">
      <span className="bazaar-install-banner__icon" aria-hidden="true">📲</span>
      <div className="bazaar-install-banner__copy">
        <b>کاربر عزیز، به سایت شهرجو خوش آمدید</b>
        <span>جهت دانلود اپلیکیشن از لینک زیر اقدام نمایید</span>
      </div>
      <a href={BAZAAR_URL} target="_blank" rel="noopener noreferrer" className="bazaar-install-banner__link">
        دانلود از بازار
      </a>
      <button type="button" className="bazaar-install-banner__close" aria-label="بستن معرفی نصب" onClick={dismiss}>
        ×
      </button>
    </aside>
  );
}
