'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CityMapData } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

export interface CityMapProps {
  data: CityMapData;
}

/** Loose runtime check for the admin-supplied GeoJSON Polygon. */
type Polygon = { type: 'Polygon'; coordinates: number[][][] };
function asPolygon(value: unknown): Polygon | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as { type?: unknown; coordinates?: unknown };
  if (v.type !== 'Polygon' || !Array.isArray(v.coordinates) || v.coordinates.length === 0) return null;
  return { type: 'Polygon', coordinates: v.coordinates as number[][][] };
}

/** Minimal HTML escaping for popup content built from DB strings. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * City map (Phase 9 + JamCity restyle): Leaflet + OSM tiles (no API key),
 * showing only the built-up area of the city — the admin boundary fits the
 * view at high zoom (residential outline), falling back to the marker cluster
 * and finally a circle around the center. Above the canvas sits the JamCity
 * category bar (top-right): picking a category shows only that category's
 * pins and re-zooms onto them. The library loads dynamically so SSR/jest
 * never touch `window`.
 */
export function CityMap({ data }: CityMapProps) {
  const holder = useRef<HTMLDivElement>(null);
  const catWrapRef = useRef<HTMLDivElement>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null); // category slug

  const categories = useMemo(() => {
    const bySlug = new Map<string, { slug: string; name: string; icon: string | null }>();
    for (const b of data.businesses) {
      if (!bySlug.has(b.category.slug)) {
        bySlug.set(b.category.slug, {
          slug: b.category.slug,
          name: b.category.name,
          icon: b.category.icon,
        });
      }
    }
    return [...bySlug.values()];
  }, [data.businesses]);

  const activeMeta = categories.find((c) => c.slug === activeCat) ?? null;

  // close the menu on Escape (same as the JamCity reference)
  useEffect(() => {
    if (!catOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [catOpen]);

  // close when clicking outside the menu
  useEffect(() => {
    if (!catOpen) return;
    const onDown = (e: MouseEvent) => {
      if (catWrapRef.current && !catWrapRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [catOpen]);

  const choose = (slug: string | null) => {
    setActiveCat(slug);
    setCatOpen(false);
  };

  useEffect(() => {
    let disposed = false;
    let map: import('leaflet').Map | null = null;

    (async () => {
      const L = await import('leaflet');
      if (disposed || !holder.current) return;

      const { city, businesses } = data;
      const shown = activeCat ? businesses.filter((b) => b.category.slug === activeCat) : businesses;
      const center: [number, number] | null =
        city.latitude !== null && city.longitude !== null ? [city.latitude, city.longitude] : null;
      if (!center && businesses.length === 0) return; // nowhere to look — handled by parent

      map = L.map(holder.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        // stay inside the city — no endless empty countryside
        maxBoundsViscosity: 0.6,
        ...(center
          ? {
              maxBounds: [
                [center[0] - 0.3, center[1] - 0.3],
                [center[0] + 0.3, center[1] + 0.3],
              ] as [[number, number], [number, number]],
            }
          : {}),
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const style = {
        color: '#c9971f',
        weight: 2.5,
        fillColor: '#f2c94c',
        fillOpacity: 0.12,
        dashArray: '6 5',
      } as const;

      const polygon = asPolygon(city.boundary);
      let outlineBounds: import('leaflet').LatLngBounds | null = null;
      if (polygon) {
        const outline = L.geoJSON(polygon as unknown as GeoJSON.Polygon, { style }).addTo(map);
        if (outline.getBounds().isValid()) outlineBounds = outline.getBounds();
      } else if (center) {
        L.circle(center, { radius: 3500, ...style }).addTo(map);
      }

      for (const b of shown) {
        const gold = b.subscriptionTier === 'GOLD';
        const icon = L.divIcon({
          className: 'map-pin-wrap',
          html: `<span class="map-pin${gold ? ' map-pin--gold' : ''}"><span class="map-pin__dot"></span></span>`,
          iconSize: [24, 30],
          iconAnchor: [12, 26],
        });
        const popup =
          `<div class="map-popup">` +
          `<strong>${esc(b.name)}</strong>` +
          `<span class="map-popup__cat">${esc(b.category.icon ?? '◆')} ${esc(b.category.name)}</span>` +
          `<a href="/business/${b.id}">مشاهده صفحه</a>` +
          `</div>`;
        L.marker([b.latitude, b.longitude], { icon })
          .addTo(map)
          .bindPopup(popup);
      }

      // ---- view fit: zoom into the built-up area, not the whole region ----
      if (shown.length === 1) {
        // a single (category) result: deep residential zoom onto it
        map.setView([shown[0].latitude, shown[0].longitude], 17);
      } else if (shown.length > 1) {
        const bounds = L.latLngBounds(shown.map((b) => [b.latitude, b.longitude] as [number, number]));
        map.fitBounds(bounds, { padding: [26, 26], maxZoom: 16 });
      } else if (outlineBounds) {
        // category with no pins still shows the residential outline
        map.fitBounds(outlineBounds, { padding: [20, 20], maxZoom: 16 });
      } else if (center) {
        map.setView(center, 13); // circle fallback: town-scale zoom
      }
    })();

    return () => {
      disposed = true;
      map?.remove();
      map = null;
    };
  }, [data, activeCat]);

  return (
    <div className="city-map" data-testid="city-map">
      {/* JamCity-style category bar — top-right of the map frame */}
      <div className="map-catbar" dir="rtl">
        <div className="map-catwrap" ref={catWrapRef}>
          <button
            type="button"
            className={`map-catbtn${catOpen ? ' is-open' : ''}`}
            aria-label="دسته‌بندی کسب‌وکارها"
            aria-expanded={catOpen}
            data-testid="map-catbtn"
            onClick={() => setCatOpen((v) => !v)}
          >
            <span className="map-catbtn__icon" aria-hidden>
              ✨
            </span>
            <span className="map-catbtn__copy">
              <b>{activeMeta ? activeMeta.name : 'دسته‌بندی کسب‌وکارها'}</b>
              <small>{activeMeta ? 'فیلتر فعال است' : 'کافه، رستوران، باشگاه و…'}</small>
            </span>
            <span className="map-catbtn__chev" aria-hidden>
              ⌄
            </span>
          </button>
          {catOpen && (
            <div className="map-catmenu" role="listbox" aria-label="دسته‌بندی کسب‌وکارها" data-testid="map-catmenu">
              <button
                type="button"
                role="option"
                aria-selected={!activeCat}
                className={`map-catitem${!activeCat ? ' active' : ''}`}
                data-testid="map-cat-option-all"
                onClick={() => choose(null)}
              >
                <span aria-hidden>✨</span>
                <b>همه کسب‌وکارها</b>
              </button>
              {categories.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  role="option"
                  aria-selected={activeCat === c.slug}
                  className={`map-catitem${activeCat === c.slug ? ' active' : ''}`}
                  data-testid={`map-cat-option-${c.slug}`}
                  onClick={() => choose(c.slug)}
                >
                  <span aria-hidden>{c.icon ?? '◆'}</span>
                  <b>{c.name}</b>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="city-map__canvas" ref={holder} role="application" aria-label="نقشه شهر" />
      <div className="city-map__legend">
        <span className="city-map__legend-item">
          <span className="map-pin map-pin--gold map-pin--inline" aria-hidden /> کسب‌وکار طلایی
        </span>
        <span className="city-map__legend-item">
          <span className="map-pin map-pin--inline" aria-hidden /> کسب‌وکار نقره‌ای/معمولی
        </span>
        <span className="city-map__legend-item city-map__legend-item--muted">🗺 نقشه: OpenStreetMap</span>
      </div>
    </div>
  );
}
