'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { recordVisit } from '@/lib/api';

/**
 * Counts one site visit per page view (the admin panel shows daily /
 * monthly / yearly totals). Runs client-side after mount, never throws and
 * never blocks rendering — analytics must not affect the experience.
 */
export function VisitBeacon() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // the root layout stays mounted: count each distinct page view once
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void recordVisit();
  }, [pathname]);

  return null;
}
