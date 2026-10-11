'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { api, getLocalCity, getTokens, setLocalCity } from '@/lib/api';
import type { City, MeResponse } from '@/lib/types';

/** Suggested cities offered before the full list. */
const SUGGESTED_LIMIT = 8;

function sameCity(cities: City[], id: number | undefined): City | undefined {
  return id === undefined ? undefined : cities.find((c) => c.id === id);
}

function unique(cities: City[]): City[] {
  const seen = new Set<number>();
  return cities.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/**
 * In-place city picker (the header's 🏙 pill). Replaces the old jump to the
 * first-run selection page: a small card opens over the page with a search box
 * and suggested cities (featured ones plus the neighbours of the remembered
 * city), and picking any city stores it locally, syncs the profile
 * (best-effort) and goes straight to that city's home.
 *
 * Rendered through a portal so the sticky/blurred header can never clip it;
 * closes on Esc, on the backdrop and after a pick. The list is fetched once,
 * on first open (SSR ships nothing — the card only exists after a click).
 */
export function CityPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [cities, setCities] = useState<City[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const current = getLocalCity();

  // one fetch per session, on first open
  useEffect(() => {
    if (!open || cities) return;
    let alive = true;
    setError(null);
    api
      .get<City[]>('/cities')
      .then((list) => {
        if (alive) setCities(list);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'دریافت فهرست شهرها ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [open, cities]);

  // opening: fresh query, focused search, Esc to close, page behind stays put
  useEffect(() => {
    if (!open) return;
    setQuery('');
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const { suggested, others, matches } = useMemo(() => {
    const list = cities ?? [];
    const q = query.trim();
    if (q) {
      const latin = q.toLowerCase();
      const found = list.filter(
        (c) => c.name.includes(q) || c.province.name.includes(q) || c.slug.includes(latin),
      );
      return { suggested: [] as City[], others: [] as City[], matches: found };
    }
    const mine = sameCity(list, current?.id);
    const promoted = unique([
      ...list.filter((c) => c.isFeatured),
      ...(mine ? list.filter((c) => c.province.id === mine.province.id) : []),
    ]);
    const suggestedCities = promoted.slice(0, SUGGESTED_LIMIT);
    const suggestedIds = new Set(suggestedCities.map((c) => c.id));
    return {
      suggested: suggestedCities,
      others: list.filter((c) => !suggestedIds.has(c.id)),
      matches: [] as City[],
    };
  }, [cities, current?.id, query]);

  if (!open || typeof document === 'undefined') return null;

  const select = (city: City) => {
    setLocalCity({ id: city.id, slug: city.slug, name: city.name });
    if (getTokens()) {
      // same sync the first-run screen does — the profile is the source of truth
      void api.patch<MeResponse>('/users/me', { cityId: city.id }).catch(() => undefined);
    }
    onClose();
    router.push(`/city/${city.slug}`);
  };

  const firstMatch = query.trim() ? matches[0] : suggested[0];

  const cityButton = (city: City) => (
    <li key={city.id}>
      <button
        type="button"
        className="city-picker__item"
        data-testid={`city-picker-${city.slug}`}
        onClick={() => select(city)}
      >
        <span className="city-picker__itemmain">
          <b>{city.name}</b>
          <small>{city.province.name}</small>
        </span>
        {city.isFeatured && <span className="city-picker__tag">ویژه</span>}
        {current?.id === city.id && <span className="city-picker__now">فعلی</span>}
      </button>
    </li>
  );

  return createPortal(
    <div className="city-picker-overlay" data-testid="city-picker-overlay" onClick={onClose}>
      <div
        className="city-picker"
        role="dialog"
        aria-modal="true"
        aria-label="انتخاب شهر"
        data-testid="city-picker"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="city-picker__head">
          <span className="city-picker__mark" aria-hidden>
            🏙
          </span>
          <h2>انتخاب شهر</h2>
          <button
            type="button"
            className="city-picker__close"
            aria-label="بستن"
            data-testid="city-picker-close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="city-picker__search">
          <span aria-hidden>🔍</span>
          <input
            ref={inputRef}
            type="search"
            className="search-input"
            placeholder="نام شهر را بنویسید…"
            aria-label="جستجوی شهر"
            data-testid="city-picker-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && firstMatch) {
                e.preventDefault();
                select(firstMatch);
              }
            }}
          />
        </div>

        <div className="city-picker__body">
          {error && (
            <div className="banner banner--error" role="alert">
              <span>{error}</span>
            </div>
          )}

          {cities === null && !error && (
            <p className="muted loading" aria-busy>
              در حال بارگذاری شهرها…
            </p>
          )}

          {query.trim() ? (
            matches.length === 0 ? (
              <p className="empty-state">شهری با این نام پیدا نشد.</p>
            ) : (
              <ul className="city-picker__list" data-testid="city-picker-results">
                {matches.map(cityButton)}
              </ul>
            )
          ) : (
            cities !== null && (
              <>
                {suggested.length > 0 && (
                  <section className="city-picker__section">
                    <h3 className="city-picker__title">پیشنهادی برای تو</h3>
                    <ul className="city-picker__list" data-testid="city-picker-suggested">
                      {suggested.map(cityButton)}
                    </ul>
                  </section>
                )}
                {others.length > 0 && (
                  <section className="city-picker__section">
                    <h3 className="city-picker__title">شهرهای دیگر</h3>
                    <ul className="city-picker__list">{others.map(cityButton)}</ul>
                  </section>
                )}
              </>
            )
          )}
        </div>

        <p className="city-picker__foot">
          با انتخاب شهر، دیوار، آگهی‌ها و اخبار همان شهر را می‌بینی.
        </p>
      </div>
    </div>,
    document.body,
  );
}
