'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CityDashboard } from '@/components/dashboard';
import { api, getCityAds, getCityBusinesses, getCityMap, getCityNews, getShowcase, getTokens, setLocalCity } from '@/lib/api';
import type { AdItem, BusinessItem, City, CityMapData, MeResponse, NewsItem, ShowcaseItem } from '@/lib/types';

interface DashboardState {
  city: City | null | undefined; // undefined = loading, null = not found
  news: NewsItem[];
  ads: AdItem[];
  businesses: BusinessItem[];
  showcase: ShowcaseItem[];
  mapData: CityMapData | null;
  loading: boolean;
  feedError: string | null;
}

const INITIAL: DashboardState = {
  city: undefined,
  news: [],
  ads: [],
  businesses: [],
  showcase: [],
  mapData: null,
  loading: true,
  feedError: null,
};

/**
 * City dashboard (Phase 4): resolves the slug, remembers the selection,
 * syncs `cityId` into the profile when logged in, then loads the three
 * public feeds (news / ads / businesses) of that city.
 */
export default function CityPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<DashboardState>(INITIAL);

  useEffect(() => {
    let alive = true;
    setState(INITIAL);

    (async () => {
      // 1) resolve the city from the public list
      let city: City | null;
      try {
        const list = await api.get<City[]>('/cities');
        city = list.find((c) => c.slug === slug) ?? null;
      } catch {
        if (alive) setState((s) => ({ ...s, city: null, loading: false, feedError: 'دریافت اطلاعات شهر ناموفق بود' }));
        return;
      }
      if (!alive) return;

      if (!city) {
        setState((s) => ({ ...s, city: null, loading: false }));
        return;
      }

      setState((s) => ({ ...s, city }));
      setLocalCity({ id: city!.id, slug: city!.slug, name: city!.name });

      // 2) keep the profile in sync when logged in (best-effort)
      if (getTokens()) {
        api
          .get<MeResponse>('/users/me')
          .then((me) => {
            if (me.cityId !== city!.id) {
              void api.patch<MeResponse>('/users/me', { cityId: city!.id }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      // 3) feeds + golden showcase + map (Phase 9) — header still renders on failure
      try {
        const [news, ads, businesses, showcase, mapData] = await Promise.all([
          getCityNews(city.slug),
          getCityAds(city.slug),
          getCityBusinesses(city.slug),
          getShowcase(city.slug),
          getCityMap(city.slug),
        ]);
        if (alive) setState((s) => ({ ...s, news, ads, businesses, showcase, mapData, loading: false }));
      } catch (err) {
        if (alive) {
          setState((s) => ({
            ...s,
            loading: false,
            feedError: err instanceof Error ? err.message : 'دریافت محتوای شهر ناموفق بود',
          }));
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  if (state.city === undefined) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری…
      </p>
    );
  }

  if (state.city === null) {
    return (
      <div className="banner banner--error" role="alert">
        <span>چنین شهری پیدا نشد.</span>
        <Link href="/" className="btn btn-ghost">
          بازگشت به فهرست شهرها
        </Link>
      </div>
    );
  }

  return (
    <CityDashboard
      city={state.city}
      news={state.news}
      ads={state.ads}
      businesses={state.businesses}
      showcase={state.showcase}
      mapData={state.mapData}
      loading={state.loading}
      feedError={state.feedError}
    />
  );
}
