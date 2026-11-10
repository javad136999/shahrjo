'use client';

import { useEffect, useState } from 'react';

const MINIMUM_APP_VERSION = '1.0.11';
const BAZAAR_APP_URL = 'https://cafebazaar.ir/app/ir.shahrju.app';

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
    const userAgent = window.navigator.userAgent;
    const isAndroidWebView = /Android.*;\s*wv\)/i.test(userAgent);
    const installedVersion = userAgent.match(/ShahrjoApp\/(\d+\.\d+\.\d+)/i)?.[1];
    setNeedsUpdate(isAndroidWebView && (!installedVersion || compareVersions(installedVersion, MINIMUM_APP_VERSION) < 0));
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
