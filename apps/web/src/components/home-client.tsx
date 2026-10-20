'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CityGrid } from '@/components/city-grid';
import { api, getLocalCity, getTokens, setLocalCity } from '@/lib/api';
import type { City, MeResponse } from '@/lib/types';

/**
 * First-run city selection (Phase 3) — the interactive half of the landing
 * page. The city list arrives pre-rendered from the server (`initialCities`),
 * so every city link is present in the very first HTML response instead of
 * appearing only after JavaScript runs. When that server fetch failed (API
 * outage at render time) this client loads the list itself, as it always did.
 */
export interface HomeClientProps {
  /** cities already fetched server-side; `null` → fetch them in the browser */
  initialCities: City[] | null;
}

export function HomeClient({ initialCities }: HomeClientProps) {
  const router = useRouter();
  const [cities, setCities] = useState<City[] | null>(initialCities);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [restoringCity, setRestoringCity] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setCities(null);
    setRestoringCity(true);
    try {
      const list = await api.get<City[]>('/cities');
      setCities(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'دریافت فهرست شهرها ناموفق بود');
      setRestoringCity(false);
    }
  }, []);

  useEffect(() => {
    if (!initialCities) void load();
  }, [initialCities, load]);

  useEffect(() => {
    if (!cities) return;
    let alive = true;

    // The locally remembered choice is the visitor's latest explicit choice
    // (including while logged out), so it takes precedence over an older
    // profile value. Match by slug too, in case a city's numeric ID changed.
    const remembered = getLocalCity();
    const savedCity = remembered
      ? cities.find((city) => city.id === remembered.id || city.slug === remembered.slug)
      : undefined;
    if (savedCity) {
      setLocalCity({ id: savedCity.id, slug: savedCity.slug, name: savedCity.name });
      router.replace(`/city/${savedCity.slug}`);
      return () => {
        alive = false;
      };
    }

    // Older signed-in users may have a profile city but no local preference.
    // Restore it once, then remember it locally for future visits.
    if (getTokens()) {
      api
        .get<MeResponse>('/users/me')
        .then((profile) => {
          if (!alive) return;
          setMe(profile);
          const profileCity = profile.cityId ? cities.find((city) => city.id === profile.cityId) : undefined;
          if (profileCity) {
            setLocalCity({ id: profileCity.id, slug: profileCity.slug, name: profileCity.name });
            router.replace(`/city/${profileCity.slug}`);
            return;
          }
          setRestoringCity(false);
        })
        .catch(() => {
          if (!alive) return;
          setMe(null);
          setRestoringCity(false);
        });
    } else {
      setRestoringCity(false);
    }

    return () => {
      alive = false;
    };
  }, [cities, router]);

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

      {cities && restoringCity && (
        <p className="muted loading" aria-busy>
          در حال بازگرداندن شهر انتخاب‌شده…
        </p>
      )}

      {cities && !restoringCity && (
        <CityGrid cities={cities} onSelect={handleSelect} selectedCityId={me?.cityId ?? null} disabled={syncing} />
      )}
    </>
  );
}
