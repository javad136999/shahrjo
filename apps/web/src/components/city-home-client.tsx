'use client';

import { useEffect, useState } from 'react';
import { CityDashboard } from '@/components/dashboard';
import { api, getCityMap, getTokens, setLocalCity } from '@/lib/api';
import type { City, CityMapData, MeResponse, ShowcaseItem } from '@/lib/types';

/**
 * Browser half of the city home page. The initial dashboard is server-rendered
 * for SEO; the map is then refreshed from the uncached public API so a business
 * just published by an operator is visible without waiting for the server's
 * page/data revalidation window.
 */
export interface CityHomeClientProps {
  city: City;
  showcase: ShowcaseItem[];
  mapData: CityMapData | null;
  /** non-fatal feed error (banner), when showcase/map could not be read */
  feedError: string | null;
}

export function CityHomeClient({ city, showcase, mapData, feedError }: CityHomeClientProps) {
  const [freshMapData, setFreshMapData] = useState(mapData);
  const [mapLoading, setMapLoading] = useState(mapData === null);

  useEffect(() => {
    setLocalCity({ id: city.id, slug: city.slug, name: city.name });
    if (!getTokens()) return;
    // best-effort profile sync — never blocks the page
    api.get<MeResponse>('/users/me')
      .then((me) => {
        if (me.cityId !== city.id) void api.patch<MeResponse>('/users/me', { cityId: city.id }).catch(() => {});
      })
      .catch(() => {});
  }, [city.id, city.slug, city.name]);

  useEffect(() => {
    let alive = true;
    let latestRequest = 0;

    const refreshMap = async () => {
      const requestId = ++latestRequest;
      try {
        const fresh = await getCityMap(city.slug);
        if (alive && requestId === latestRequest) setFreshMapData(fresh);
      } catch {
        // Keep the server-rendered map if the live refresh is temporarily unavailable.
      } finally {
        if (alive && requestId === latestRequest) setMapLoading(false);
      }
    };

    void refreshMap();
    const onFocus = () => void refreshMap();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshMap();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [city.slug]);

  return (
    <CityDashboard
      city={city}
      showcase={showcase}
      mapData={freshMapData}
      loading={mapLoading}
      feedError={feedError}
    />
  );
}
