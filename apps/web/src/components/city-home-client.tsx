'use client';

import { useEffect } from 'react';
import { CityDashboard } from '@/components/dashboard';
import { api, getTokens, setLocalCity } from '@/lib/api';
import type { City, CityMapData, MeResponse, ShowcaseItem } from '@/lib/types';

/**
 * Browser half of the city home page. The dashboard itself (welcome card, the
 * two service tiles, the golden showcase and every map pin) is rendered on the
 * server from the props below — the HTML a crawler receives already contains
 * the city-specific welcome text, business names and their links. Only the
 * side-effects that need a browser run here: remembering the selected city and
 * syncing it into the profile when the visitor is logged in.
 */
export interface CityHomeClientProps {
  city: City;
  showcase: ShowcaseItem[];
  mapData: CityMapData | null;
  /** non-fatal feed error (banner), when showcase/map could not be read */
  feedError: string | null;
}

export function CityHomeClient({ city, showcase, mapData, feedError }: CityHomeClientProps) {
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

  return (
    <CityDashboard city={city} showcase={showcase} mapData={mapData} loading={false} feedError={feedError} />
  );
}
