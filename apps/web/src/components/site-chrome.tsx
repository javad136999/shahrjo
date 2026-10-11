'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Routes that run as full-screen rooms: no public site header, no footer and
 * no bottom navigation — the room brings its own top bar and composer.
 */
const FULLSCREEN_ROUTES = ['/wall'];

/**
 * Chrome gate for the root layout. The city wall is a chat room (Telegram
 * style), so the site frame steps aside there; `body.wall-screen` also frees
 * the page padding and scroll height those bars were occupying. Rendered per
 * route, so the wall HTML ships without the chrome (no flash, nothing to hide
 * after hydration).
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullscreen = FULLSCREEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    document.body.classList.toggle('wall-screen', fullscreen);
    return () => document.body.classList.remove('wall-screen');
  }, [fullscreen]);

  if (fullscreen) return null;
  return <>{children}</>;
}
