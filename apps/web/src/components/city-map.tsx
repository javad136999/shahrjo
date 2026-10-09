'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CityMapData } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

export interface CityMapProps {
  data: CityMapData;
  /**
   * Fires whenever the ✨ category filter changes so a sibling list can stay
   * in sync with what the map shows (filter/list parity).
   */
  onCategoryChange?: (categorySlug: string | null) => void;
}

/** Loose runtime check for admin-supplied GeoJSON city boundaries. */
type CityBoundary =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

function asBoundary(value: unknown): CityBoundary | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { type?: unknown; coordinates?: unknown; geometry?: unknown };
  const candidate = raw.type === 'Feature' ? raw.geometry : raw;
  if (!candidate || typeof candidate !== 'object') return null;
  const geometry = candidate as { type?: unknown; coordinates?: unknown };
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return null;
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates as number[][][] };
  }
  if (geometry.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geometry.coordinates as number[][][][] };
  }
  return null;
}

/** [[minLat, minLng], [maxLat, maxLng]] across every ring of a city boundary. */
function boundsOfBoundary(boundary: CityBoundary): [[number, number], [number, number]] | null {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  const polygons = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const point of ring) {
        const [lng, lat] = point;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (lat < minLat) minLat = lat;
        if (lng < minLng) minLng = lng;
        if (lat > maxLat) maxLat = lat;
        if (lng > maxLng) maxLng = lng;
      }
    }
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/** Minimal HTML escaping for popup/label content built from DB strings. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * City map (Phase 9 + JamCity restyle): Leaflet + OSM tiles (no API key).
 * The view frames the whole city (Polygon/MultiPolygon boundary when present,
 * otherwise a broad frame around the city center and any pins).
 * Every pin carries its category emoji; zooming in past level 15 reveals the
 * business name above the pin. Above the canvas sits the JamCity category bar
 * (top-right): picking a category shows only that category's pins and re-zooms
 * onto them. The library loads dynamically so SSR/jest never touch `window`.
 */
export function CityMap({ data, onCategoryChange }: CityMapProps) {
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
    onCategoryChange?.(slug);
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

      const boundary = asBoundary(city.boundary);
      // bounds of the admin outline, computed before the map exists
      const outline = boundary ? boundsOfBoundary(boundary) : null;

      // stay inside the city — no endless empty countryside
      const maxBounds: [[number, number], [number, number]] | undefined = outline
        ? [
            [outline[0][0] - 0.1, outline[0][1] - 0.1],
            [outline[1][0] + 0.1, outline[1][1] + 0.1],
          ]
        : center
          ? [
              [center[0] - 0.4, center[1] - 0.4],
              [center[0] + 0.4, center[1] + 0.4],
            ]
          : undefined;

      map = L.map(holder.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        maxBoundsViscosity: 0.6,
        ...(maxBounds ? { maxBounds } : {}),
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

      let outlineBounds: import('leaflet').LatLngBounds | null = null;
      if (boundary) {
        const drawn = L.geoJSON(boundary as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon, { style }).addTo(map);
        if (drawn.getBounds().isValid()) outlineBounds = drawn.getBounds();
      }
      // no boundary → no outline; fit logic below uses a broad city-level frame

      for (const b of shown) {
        const gold = b.subscriptionTier === 'GOLD';
        // category emoji instead of a plain dot — the pin says what it is
        const icon = L.divIcon({
          className: 'map-pin-wrap',
          html:
            `<span class="map-pin map-pin--cat${gold ? ' map-pin--gold' : ''}">` +
            `<span class="map-pin__icon">${esc(b.category.icon ?? '◆')}</span>` +
            `<span class="map-pin__name">${esc(b.name)}</span>` +
            `</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
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

      // deep zoom → the business names above their pins become visible
      const syncZoom = () => {
        holder.current?.classList.toggle('is-zoomed', map!.getZoom() >= 16);
      };
      map.on('zoomend', syncZoom);
      syncZoom();

      // ---- view fit: the whole city first; a category filter zooms to its pins ----
      const pins = shown.map((b) => [b.latitude, b.longitude] as [number, number]);
      if (activeCat) {
        if (shown.length === 1) {
          map.setView(pins[0], 17); // single (category) result: deep residential zoom
        } else if (shown.length > 1) {
          map.fitBounds(L.latLngBounds(pins), { padding: [26, 26], maxZoom: 15 });
        } else if (outlineBounds) {
          map.fitBounds(outlineBounds, { padding: [20, 20], maxZoom: 15 }); // category with no pins: the outline
        } else if (center) {
          const cityFrame = [
            [center[0] - 0.12, center[1] - 0.15],
            [center[0] + 0.12, center[1] + 0.15],
            ...pins,
          ] as [number, number][];
          map.fitBounds(L.latLngBounds(cityFrame), { padding: [24, 24], maxZoom: 12 });
        }
      } else if (outlineBounds) {
        // whole city boundary in frame
        map.fitBounds(outlineBounds, { padding: [24, 24], maxZoom: 15 });
      } else if (center) {
        // No boundary yet: frame a generous city-wide envelope, not just its business pins.
        const cityFrame = [
          [center[0] - 0.12, center[1] - 0.15],
          [center[0] + 0.12, center[1] + 0.15],
          ...pins,
        ] as [number, number][];
        map.fitBounds(L.latLngBounds(cityFrame), { padding: [24, 24], maxZoom: 12 });
      } else if (pins.length > 1) {
        map.fitBounds(L.latLngBounds(pins), { padding: [56, 56], maxZoom: 13 });
      } else if (pins.length === 1) {
        map.setView(pins[0], 14);
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
          <span className="map-pin map-pin--cat map-pin--gold map-pin--legend" aria-hidden>
            <span className="map-pin__icon">◆</span>
          </span>{' '}
          کسب‌وکار طلایی
        </span>
        <span className="city-map__legend-item">
          <span className="map-pin map-pin--cat map-pin--legend" aria-hidden>
            <span className="map-pin__icon">◆</span>
          </span>{' '}
          کسب‌وکار نقره‌ای/معمولی
        </span>
        <span className="city-map__legend-item city-map__legend-item--muted">🗺 نقشه: OpenStreetMap</span>
      </div>
    </div>
  );
}
