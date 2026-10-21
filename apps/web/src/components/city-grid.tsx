'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { City } from '@/lib/types';

interface CityGridProps {
  cities: City[];
  onSelect: (city: City) => void;
  selectedCityId?: number | null;
  disabled?: boolean;
}

const cityCollator = new Intl.Collator('fa-IR', { sensitivity: 'base', ignorePunctuation: true });

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
}

/** Searchable, alphabetically ordered city list for the first-run selection screen. */
export function CityGrid({ cities, onSelect, selectedCityId, disabled }: CityGridProps) {
  const [query, setQuery] = useState('');

  const sortedCities = useMemo(
    () => [...cities].sort((a, b) => cityCollator.compare(a.name, b.name) || cityCollator.compare(a.province.name, b.province.name)),
    [cities],
  );

  const filtered = useMemo(() => {
    const needle = normalizeSearchText(query);
    if (!needle) return sortedCities;
    return sortedCities.filter((city) =>
      [city.name, city.province.name, city.slug, city.province.slug]
        .map(normalizeSearchText)
        .some((value) => value.includes(needle)),
    );
  }, [sortedCities, query]);

  return (
    <div className="city-selection">
      <div className="city-selection__toolbar">
        <div className="city-selection__search" role="search">
          <svg className="city-selection__search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.6" />
            <path d="m16 16 4.4 4.4" />
          </svg>
          <input
            id="city-selection-search"
            type="search"
            className="city-selection__input"
            placeholder="نام شهر یا استان را جستجو کن"
            aria-label="جستجوی شهر"
            aria-controls="city-selection-results"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className="city-selection__clear"
              aria-label="پاک‌کردن جستجو"
              onClick={() => setQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="city-selection__summary" role="status" aria-live="polite">
          <span className="city-selection__count" data-testid="city-results-count">
            {filtered.length.toLocaleString('fa-IR')} شهر
          </span>
          <span className="city-selection__sort">
            {query.trim() ? 'نتیجهٔ جستجو' : 'مرتب‌شده به‌ترتیب الفبا'}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="city-selection__empty" role="status">
          <span className="city-selection__empty-mark" aria-hidden="true">
            ؟
          </span>
          <p>شهری با این نام یافت نشد.</p>
          <small>نام شهر یا استان را دوباره بررسی کن.</small>
        </div>
      ) : (
        <ul className="city-grid" id="city-selection-results" data-testid="city-grid" aria-label="شهرهای قابل انتخاب">
          {filtered.map((city) => {
            const isSelected = selectedCityId === city.id;
            return (
              <li key={city.id}>
                {/* A real href keeps /city/<slug> discoverable. Selection still
                    saves the city before the client-side navigation. */}
                <Link
                  href={`/city/${city.slug}`}
                  className={`city-card${isSelected ? ' city-card--selected' : ''}`}
                  aria-disabled={disabled ? true : undefined}
                  onClick={(event) => {
                    if (disabled) {
                      event.preventDefault();
                      return;
                    }
                    event.preventDefault();
                    onSelect(city);
                  }}
                  data-testid={`city-${city.slug}`}
                >
                  <span className="city-card__detail">
                    <span className="city-card__name">{city.name}</span>
                    <span className="city-card__subline">
                      <span className="city-card__province">{city.province.name}</span>
                      {city.isFeatured && <span className="city-card__featured">ویژه</span>}
                    </span>
                  </span>
                  <span className="city-card__meta">
                    {isSelected && <span className="city-card__check">✓ انتخاب‌شده</span>}
                    <svg className="city-card__arrow" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M12.7 4.5 7.2 10l5.5 5.5" />
                    </svg>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
