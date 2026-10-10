'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

export interface BusinessPoint {
  latitude: number;
  longitude: number;
}

export function BusinessLocationPicker({
  center,
  onChange,
}: {
  center: { latitude: number; longitude: number };
  onChange: (point: BusinessPoint) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [mapError, setMapError] = useState(false);
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;
    let map: import('leaflet').Map | null = null;

    void (async () => {
      try {
        const L = await import('leaflet');
        if (disposed || !holder.current) return;
        map = L.map(holder.current, { center: [center.latitude, center.longitude], zoom: 13, scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        let marker: import('leaflet').Marker | null = null;
        const icon = L.divIcon({
          className: 'location-picker__marker',
          html: '<span aria-hidden="true">📍</span>',
          iconSize: [40, 40],
          iconAnchor: [20, 36],
        });
        const report = (latitude: number, longitude: number) => {
          onChangeRef.current({ latitude, longitude });
          if (!map) return;
          if (marker) marker.setLatLng([latitude, longitude]);
          else {
            marker = L.marker([latitude, longitude], { icon, draggable: true }).addTo(map);
            marker.on('dragend', () => {
              const point = marker?.getLatLng();
              if (point) onChangeRef.current({ latitude: point.lat, longitude: point.lng });
            });
          }
        };
        map.on('click', (event: import('leaflet').LeafletMouseEvent) => report(event.latlng.lat, event.latlng.lng));
        window.setTimeout(() => map?.invalidateSize(), 0);
      } catch {
        if (!disposed) setMapError(true);
      }
    })();

    return () => {
      disposed = true;
      map?.remove();
      map = null;
    };
  }, [center.latitude, center.longitude]);

  return (
    <div className="business-location-picker">
      <div className="business-location-picker__map" ref={holder} role="application" aria-label="انتخاب موقعیت کسب‌وکار روی نقشه" />
      {mapError && <p className="banner banner--error">بارگذاری نقشه ممکن نشد؛ اتصال اینترنت را بررسی کنید.</p>}
      <p className="muted small">برای ثبت موقعیت، روی نقشه بزنید یا نشانگر را جابه‌جا کنید.</p>
    </div>
  );
}
