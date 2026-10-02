'use client';

import { useMemo, useState } from 'react';
import type { City } from '@/lib/types';

interface CityGridProps {
  cities: City[];
  onSelect: (city: City) => void;
  selectedCityId?: number | null;
  disabled?: boolean;
}

/** Searchable, province-grouped city list for the first-run selection screen. */
export function CityGrid({ cities, onSelect, selectedCityId, disabled }: CityGridProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return cities;
    const latin = q.toLowerCase();
    return cities.filter(
      (c) => c.name.includes(q) || c.province.name.includes(q) || c.slug.includes(latin),
    );
  }, [cities, query]);

  const groups = useMemo(() => {
    const map = new Map<string, City[]>();
    for (const city of filtered) {
      const list = map.get(city.province.name) ?? [];
      list.push(city);
      map.set(city.province.name, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="city-selection">
      <input
        type="search"
        className="search-input"
        placeholder="جستجوی شهر…"
        aria-label="جستجوی شهر"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {groups.length === 0 ? (
        <p className="empty-state">شهری با این نام یافت نشد.</p>
      ) : (
        groups.map(([province, list]) => (
          <section key={province} className="province-group">
            <h2 className="province-title">{province}</h2>
            <ul className="city-grid">
              {list.map((city) => {
                const isSelected = selectedCityId === city.id;
                return (
                  <li key={city.id}>
                    <button
                      type="button"
                      className={`city-card${isSelected ? ' city-card--selected' : ''}`}
                      disabled={disabled}
                      onClick={() => onSelect(city)}
                      data-testid={`city-${city.slug}`}
                    >
                      <span className="city-card__name">{city.name}</span>
                      {city.isFeatured && <span className="badge">ویژه</span>}
                      {isSelected && <span className="city-card__check">✓ انتخاب‌شده</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
