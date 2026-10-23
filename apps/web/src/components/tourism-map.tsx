'use client';

import { useEffect, useRef } from 'react';
import type { TourismSpot } from '@/lib/tourism';
import 'leaflet/dist/leaflet.css';

export interface TourismMapProps {
  spots: TourismSpot[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function TourismMap({ spots }: TourismMapProps) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let map: import('leaflet').Map | null = null;

    (async () => {
      const L = await import('leaflet');
      if (disposed || !holder.current || spots.length === 0) return;

      map = L.map(holder.current, { scrollWheelZoom: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const points: [number, number][] = [];
      for (const spot of spots) {
        const point: [number, number] = [spot.latitude, spot.longitude];
        points.push(point);
        const icon = L.divIcon({
          className: 'tourism-map-marker-root',
          html:
            `<span class="tourism-map-marker" style="--tourism-marker-accent:${escapeHtml(spot.accent)}">` +
            `<span class="tourism-map-marker__glyph" aria-hidden="true">${escapeHtml(spot.icon)}</span>` +
            '</span>',
          iconSize: [36, 40],
          iconAnchor: [18, 36],
        });
        const openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${spot.latitude}&mlon=${spot.longitude}#map=16/${spot.latitude}/${spot.longitude}`;
        const popup =
          `<div class="tourism-map-popup" dir="rtl">` +
          `<strong>${escapeHtml(spot.name)}</strong>` +
          `<span>${escapeHtml(spot.category)} · ${escapeHtml(spot.locationLabel)}</span>` +
          `<p>${escapeHtml(spot.description)}</p>` +
          `<a href="${openStreetMapUrl}" target="_blank" rel="noreferrer">بازکردن در OpenStreetMap ↗</a>` +
          '</div>';
        L.marker(point, { icon, title: spot.name, alt: spot.name })
          .addTo(map)
          .bindPopup(popup, { autoPanPadding: [24, 48], maxWidth: 300 });
      }

      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 13, animate: false });
      } else if (points.length === 1) {
        map.setView(points[0], 13, { animate: false });
      }
      map.invalidateSize({ animate: false });
    })();

    return () => {
      disposed = true;
      if (map && typeof map.stop === 'function') map.stop();
      map?.remove();
      map = null;
    };
  }, [spots]);

  return (
    <div className="tourism-map" data-testid="tourism-map" data-pins={spots.length}>
      <div
        className="tourism-map__canvas"
        ref={holder}
        role="application"
        aria-label="نقشهٔ جاذبه‌های گردشگری"
      />
    </div>
  );
}
