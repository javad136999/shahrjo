'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Visible web-install action for supported browsers, with manual instructions as fallback. */
export function WebInstallButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowHelp(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!installEvent) {
      setShowHelp((visible) => !visible);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setInstallEvent(null);
    } else {
      setInstallEvent(null);
    }
  };

  return (
    <div className="web-install">
      <button type="button" className="web-install__button" onClick={() => void install()}>
        <span aria-hidden>📲</span>
        <span>نصب نسخه وب</span>
      </button>
      {showHelp && (
        <div className="web-install__help" role="status">
          <button type="button" className="web-install__close" aria-label="بستن راهنما" onClick={() => setShowHelp(false)}>×</button>
          <b>نصب شهرجو روی گوشی</b>
          <p>در مرورگر، منوی سه‌نقطه را باز کنید و «نصب برنامه» یا «افزودن به صفحه اصلی» را بزنید. اگر این گزینه را نمی‌بینید، صفحه را با Chrome باز کنید.</p>
        </div>
      )}
    </div>
  );
}
