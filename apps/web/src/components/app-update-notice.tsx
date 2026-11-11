'use client';

import { useEffect, useState } from 'react';

// Temporary floor: Bazaar currently serves 1.0.10. Raise this only after the
// newer APK is published there, otherwise current Bazaar users see a dead-end
// update prompt.
const MINIMUM_APP_VERSION = '1.0.10';
const BAZAAR_APP_URL = 'https://cafebazaar.ir/app/ir.shahrju.app';
const APP_VERSION_EVENT = 'shahrjo:app-version';

declare global {
  interface Window {
    __SHAHRJO_APP_VERSION__?: string;
  }
}

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function AppUpdateNotice() {
  const [needsUpdate, setNeedsUpdate] = useState(false);

  useEffect(() => {
    const syncVersion = () => {
      const userAgent = window.navigator.userAgent;
      const isAndroidWebView = /Android/i.test(userAgent) &&
        (/[;\s]wv\)/i.test(userAgent) || /Version\/4\.0/i.test(userAgent));
      const installedVersion = window.__SHAHRJO_APP_VERSION__ ??
        userAgent.match(/ShahrjoApp\/(\d+\.\d+\.\d+)/i)?.[1];
      // Do not treat a missing version as an old version. Older Bazaar builds
      // may not expose the native bridge; showing a prompt in that case sends
      // even the current installed release to a misleading update loop.
      setNeedsUpdate(
        isAndroidWebView && installedVersion !== undefined && compareVersions(installedVersion, MINIMUM_APP_VERSION) < 0,
      );
    };
    syncVersion();
    window.addEventListener(APP_VERSION_EVENT, syncVersion);
    return () => window.removeEventListener(APP_VERSION_EVENT, syncVersion);
  }, []);

  if (!needsUpdate) return null;

  return (
    <aside className="app-update-notice" role="status" data-testid="app-update-notice">
      <span className="app-update-notice__message">نسخهٔ جدید شهرجو آماده است.</span>
      <a href={BAZAAR_APP_URL} className="app-update-notice__link" data-testid="app-update-link">
        به‌روزرسانی اپ
      </a>
    </aside>
  );
}
