'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CityClassifieds } from '@/components/city-classifieds';
import { api, getLocalCity, getTokens, setLocalCity } from '@/lib/api';
import type { City, LocalCity, MeResponse } from '@/lib/types';

type State = { city: LocalCity | null | undefined }; // undefined = loading, null = no city chosen

/** دیوار شهر: شهر ذخیره‌شده را فوری نشان می‌دهد و پروفایل را در پس‌زمینه تطبیق می‌دهد. */
export default function WallPage() {
  const [state, setState] = useState<State>({ city: undefined });

  useEffect(() => {
    let alive = true;
    const local = getLocalCity();

    // A remembered city already contains the room's id/slug/name. Render it now;
    // do not wait for /users/me and the full /cities list before fetching the wall.
    if (local?.name) {
      setState({ city: local });
      if (getTokens()) {
        void api
          .get<MeResponse>('/users/me')
          .then(async (me) => {
            if (!alive || !me.cityId || me.cityId === local.id) return;
            const list = await api.get<City[]>('/cities');
            const city = list.find((item) => item.id === me.cityId);
            if (!city || !alive) return;
            const remembered = { id: city.id, slug: city.slug, name: city.name };
            setLocalCity(remembered);
            setState({ city: remembered });
          })
          .catch(() => {
            // Keep the cached city if profile revalidation is offline/unavailable.
          });
      }
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        // Older local-city records without a name need the directory lookup.
        if (local) {
          const list = await api.get<City[]>('/cities');
          const city = list.find((item) => item.id === local.id) ?? null;
          if (alive) setState({ city: city ? { id: city.id, slug: city.slug, name: city.name } : null });
          return;
        }

        // No local city: try the profile city (logged in) before showing the picker.
        if (getTokens()) {
          const me = await api.get<MeResponse>('/users/me');
          if (me.cityId) {
            const list = await api.get<City[]>('/cities');
            const city = list.find((item) => item.id === me.cityId);
            if (city) {
              const remembered = { id: city.id, slug: city.slug, name: city.name };
              setLocalCity(remembered);
              if (alive) setState({ city: remembered });
              return;
            }
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

  // دیوار شهر اکنون بازار آگهی است؛ کاربران در این صفحه چت نمی‌کنند.
  return <CityClassifieds city={{ id: state.city.id, slug: state.city.slug, name: state.city.name }} />;
}
