'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  lat: number;
  lng: number;
}

interface BusinessMapPickerProps {
  /** Map center — the user's own city (never hard-coded). */
  center: MapPoint;
  /** Current pin; falls back to the city center until the user moves it. */
  value: MapPoint | null;
  onChange: (point: MapPoint) => void;
}

/**
 * Pin picker for business location: click anywhere on the map or drag the
 * marker. Uses the project's existing Leaflet + OSM stack (same dynamic
 * import pattern as city-map) — no new map dependency.
 */
export function BusinessMapPicker({ center, value, onChange }: BusinessMapPickerProps) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const emitRef = useRef(onChange);
  emitRef.current = onChange;

  // Build (or rebuild on city change) the map once the container exists.
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = await import('leaflet');
      if (disposed || !holder.current || mapRef.current) return;
      const start = value ?? center;
      const map = L.map(holder.current, { scrollWheelZoom: true, zoomControl: true });
      map.setView([start.lat, start.lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      const marker = L.marker([start.lat, start.lng], {
        draggable: true,
        keyboard: true,
        title: 'جابه‌جایی موقعیت کسب‌وکار',
      }).addTo(map);
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        emitRef.current({ lat: ll.lat, lng: ll.lng });
      });
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        emitRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      mapRef.current = map;
      markerRef.current = marker;
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Rebuilding when the city (center) changes is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  // External value changes (e.g. «استفاده از موقعیت شهر») move the marker.
  useEffect(() => {
    if (!value || !markerRef.current) return;
    const ll = markerRef.current.getLatLng();
    if (Math.abs(ll.lat - value.lat) > 1e-9 || Math.abs(ll.lng - value.lng) > 1e-9) {
      markerRef.current.setLatLng([value.lat, value.lng]);
      mapRef.current?.panTo([value.lat, value.lng]);
    }
  }, [value]);

  return (
    <div
      ref={holder}
      className="biz-map"
      data-testid="business-map"
      role="application"
      aria-label="نقشه انتخاب موقعیت کسب‌وکار — با کلیک یا جابه‌جایی پین"
    />
  );
}
