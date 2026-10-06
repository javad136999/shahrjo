'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WallView } from '@/components/wall-view';
import { api, getLocalCity, getTokens, setLocalCity } from '@/lib/api';
import type { City, MeResponse } from '@/lib/types';

type State = { city: City | null | undefined } ; // undefined = loading, null = no city chosen

/** دیوار شهر (Phase 8b): resolves the active city, then renders its wall. */
export default function WallPage() {
  const [state, setState] = useState<State>({ city: undefined });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // local selection first (instant), profile second (authoritative)
        const local = getLocalCity();
        if (local && getTokens()) {
          try {
            const me = await api.get<MeResponse>('/users/me');
            if (me.cityId && me.cityId !== local.id) {
              const list = await api.get<City[]>('/cities');
              const city = list.find((c) => c.id === me.cityId);
              if (city) {
                setLocalCity({ id: city.id, slug: city.slug, name: city.name });
                if (alive) setState({ city });
                return;
              }
            }
          } catch {
            // keep the local selection
          }
        }
        if (local) {
          const list = await api.get<City[]>('/cities');
          const city = list.find((c) => c.id === local.id) ?? null;
          if (alive) setState({ city });
          return;
        }
        // no local city: try the profile city (logged in) before giving up
        if (getTokens()) {
          try {
            const me = await api.get<MeResponse>('/users/me');
            if (me.cityId) {
              const list = await api.get<City[]>('/cities');
              const city = list.find((c) => c.id === me.cityId);
              if (city) {
                setLocalCity({ id: city.id, slug: city.slug, name: city.name });
                if (alive) setState({ city });
                return;
              }
            }
          } catch {
            // fall through to the picker
          }
        }
        if (alive) setState({ city: null });
      } catch {
        if (alive) setState({ city: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.city === undefined) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری دیوار…
      </p>
    );
  }

  if (state.city === null) {
    return (
      <div className="banner banner--error" role="alert">
        <span>برای دیدن دیوار شهر ابتدا شهر خود را انتخاب کنید.</span>
        <Link href="/" className="btn btn-ghost">
          انتخاب شهر
        </Link>
      </div>
    );
  }

  return (
    <div className="wall-page">
      <header className="wall-page__head">
        <h1 data-testid="wall-title">دیوار شهر {state.city.name}</h1>
        <div className="wall-page__actions">
          <Link href={`/city/${state.city.slug}`} className="pill">
            🏙 بازگشت به شهر
          </Link>
          <Link href="/" className="pill">
            🔄 تغییر شهر
          </Link>
        </div>
      </header>
      <WallView city={{ id: state.city.id, slug: state.city.slug, name: state.city.name }} />
    </div>
  );
}
