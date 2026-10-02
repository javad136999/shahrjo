'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CityGrid } from '@/components/city-grid';
import { api, getLocalCity, getTokens, setLocalCity } from '@/lib/api';
import type { City, MeResponse } from '@/lib/types';

/** First-run city selection (Phase 3): the landing page of the platform. */
export default function HomePage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[] | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setCities(null);
    try {
      const list = await api.get<City[]>('/cities');
      setCities(list);
      if (getTokens()) {
        // profile sync is optional here; never block city browsing on it
        api.get<MeResponse>('/users/me').then(setMe).catch(() => setMe(null));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'دریافت فهرست شهرها ناموفق بود');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = async (city: City) => {
    setLocalCity({ id: city.id, slug: city.slug, name: city.name });
    if (getTokens()) {
      setSyncing(true);
      try {
        const updated = await api.patch<MeResponse>('/users/me', { cityId: city.id });
        setMe(updated);
      } catch {
        // best-effort: local selection already saved; profile will sync on next visit
      } finally {
        setSyncing(false);
      }
    }
    router.push(`/city/${city.slug}`);
  };

  const serverCity = me?.cityId ? cities?.find((c) => c.id === me.cityId) : undefined;
  const localCity = getLocalCity();
  const current = serverCity ?? (localCity && cities?.find((c) => c.id === localCity.id) ? localCity : null);

  return (
    <>
      <section className="hero">
        <h1>شهر خودت را انتخاب کن</h1>
        <p className="muted">
          شهرجو برای هر شهر یک فضای جداگانه دارد؛ اخبار، آگهی‌ها و کسب‌وکارهای همان شهر.
        </p>
        {current && (
          <p className="current-city">
            شهر انتخابی شما:{' '}
            <Link href={`/city/${current.slug}`} className="current-city__link">
              {current.name}
            </Link>{' '}
            — <Link href="/">تغییر شهر</Link>
          </p>
        )}
        {syncing && <p className="muted">در حال ذخیره شهر در پروفایل…</p>}
      </section>

      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}

      {!cities && !error && (
        <p className="muted loading" aria-busy>
          در حال بارگذاری شهرها…
        </p>
      )}

      {cities && <CityGrid cities={cities} onSelect={handleSelect} selectedCityId={me?.cityId ?? null} disabled={syncing} />}
    </>
  );
}
