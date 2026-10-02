'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, getTokens, setLocalCity } from '@/lib/api';
import type { City, MeResponse } from '@/lib/types';

/**
 * City home (Phase 3 placeholder): resolves the slug, remembers the selection
 * locally and syncs `cityId` into the profile when the user is logged in.
 * The real dashboard arrives in Phase 4.
 */
export default function CityPage() {
  const { slug } = useParams<{ slug: string }>();
  const [city, setCity] = useState<City | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await api.get<City[]>('/cities');
        const found = list.find((c) => c.slug === slug) ?? null;
        if (!alive) return;
        setCity(found);
        if (!found) return;

        setLocalCity({ id: found.id, slug: found.slug, name: found.name });
        if (getTokens()) {
          // URL is the source of truth: keep the profile in sync (best-effort).
          api
            .get<MeResponse>('/users/me')
            .then((me) => {
              if (me.cityId !== found.id) {
                void api.patch<MeResponse>('/users/me', { cityId: found.id }).catch(() => {});
              }
            })
            .catch(() => {});
        }
      } catch {
        if (alive) setCity(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (city === undefined) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری…
      </p>
    );
  }

  if (city === null) {
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
    <article className="city-home">
      <p className="city-home__province">
        استان {city.province.name} {city.isFeatured && <span className="badge">ویژه</span>}
      </p>
      <h1>{city.name}</h1>
      <p className="muted">
        فضای شهر <strong>{city.name}</strong> انتخاب شد. داشبورد شهر (اخبار، آگهی‌ها، کسب‌وکارها و نقشه)
        در فازهای بعد ساخته می‌شود.
      </p>
      <div className="city-home__actions">
        <Link href="/" className="btn btn-primary">
          تغییر شهر
        </Link>
        <Link href="/login" className="btn btn-ghost">
          ورود با موبایل
        </Link>
      </div>
    </article>
  );
}
