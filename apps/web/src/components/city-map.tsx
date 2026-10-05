'use client';

import { useEffect, useRef } from 'react';
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
 * City map (Phase 9): Leaflet + OSM tiles (no API key, no server cost),
 * drawn inside the city panel — the admin-approved boundary (GeoJSON) as a
 * golden outline (circle fallback around the city center when none is set),
 * and one styled pin per APPROVED business that has coordinates.
 * The library is imported dynamically so SSR/jest never touch `window`.
 */
export function CityMap({ data }: CityMapProps) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let map: import('leaflet').Map | null = null;

    (async () => {
      const L = await import('leaflet');
      if (disposed || !holder.current) return;

      const { city, businesses } = data;
      const center: [number, number] | null =
        city.latitude !== null && city.longitude !== null ? [city.latitude, city.longitude] : null;
      if (!center && businesses.length === 0) return; // nowhere to look — handled by parent

      map = L.map(holder.current, {
        scrollWheelZoom: false,
        zoomControl: true,
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
      if (polygon) {
        const outline = L.geoJSON(polygon as unknown as GeoJSON.Polygon, { style }).addTo(map);
        if (outline.getBounds().isValid()) {
          map.fitBounds(outline.getBounds(), { padding: [26, 26], maxZoom: 15 });
        } else if (center) {
          map.setView(center, 12);
        }
      } else if (center) {
        L.circle(center, { radius: 3500, ...style }).addTo(map);
        map.setView(center, 12);
      }

      for (const b of businesses) {
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

      if (businesses.length > 0 && !polygon && !center) {
        const group = L.featureGroup(businesses.map((b) => L.marker([b.latitude, b.longitude])));
        map.fitBounds(group.getBounds(), { padding: [26, 26], maxZoom: 14 });
      }
    })();

    return () => {
      disposed = true;
      map?.remove();
      map = null;
    };
  }, [data]);

  return (
    <div className="city-map" data-testid="city-map">
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
