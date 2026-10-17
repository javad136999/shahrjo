'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { thumbUrlFor } from '@/lib/format';
import type { CityMapData } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

export interface CityMapProps {
  data: CityMapData;
}

/** Loose runtime check for admin-supplied GeoJSON city boundaries. */
type CityBoundary =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

function asBoundary(value: unknown): CityBoundary | null {
  // Raw coordinate rings (exactly what prisma/seed stores): [[[…lng,lat…]]]
  // is a Polygon, one level deeper is a MultiPolygon — wrap into GeoJSON.
  // Without this every seeded boundary was silently dropped and the view
  // fell back to pin-based framing — foreign pins could win and drag the
  // camera to a completely different city.
  if (Array.isArray(value)) {
    const ring = Array.isArray(value[0]) ? value[0] : null;
    const cell = ring && Array.isArray(ring[0]) ? ring[0] : null;
    if (cell && cell.length > 0) {
      if (typeof cell[0] === 'number') return { type: 'Polygon', coordinates: value as number[][][] };
      if (Array.isArray(cell[0]) && typeof (cell[0] as unknown[])[0] === 'number') {
        return { type: 'MultiPolygon', coordinates: value as number[][][][] };
      }
    }
    return null;
  }
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


type LatLngBox = [[number, number], [number, number]];

/** An urban-scale view never shows less than ~4.5 km, however small the box. */
const MIN_HALF_LAT = 0.02;
const MIN_HALF_LNG = 0.025;
/** Widest zoom we ever force: a town/city overview, never a single street. */
const URBAN_MAX_ZOOM = 14;
const FILTER_MAX_ZOOM = 15;
/** How far past the city outline the pan frame reaches (degrees). */
const SLACK_LAT = 0.02;
const SLACK_LNG = 0.02;

function growBox(box: LatLngBox, lat: number, lng: number): LatLngBox {
  return [
    [Math.min(box[0][0], lat), Math.min(box[0][1], lng)],
    [Math.max(box[1][0], lat), Math.max(box[1][1], lng)],
  ];
}

/** Pad a box (about its centre) so it spans at least the minimum urban extent. */
function withMinSpan(box: LatLngBox): LatLngBox {
  const cLat = (box[0][0] + box[1][0]) / 2;
  const cLng = (box[0][1] + box[1][1]) / 2;
  const halfLat = Math.max((box[1][0] - box[0][0]) / 2, MIN_HALF_LAT);
  const halfLng = Math.max((box[1][1] - box[0][1]) / 2, MIN_HALF_LNG);
  return [
    [cLat - halfLat, cLng - halfLng],
    [cLat + halfLat, cLng + halfLng],
  ];
}

function boxOfPoints(points: [number, number][]): LatLngBox | null {
  if (points.length === 0) return null;
  let box: LatLngBox = [
    [points[0][0], points[0][1]],
    [points[0][0], points[0][1]],
  ];
  for (const [lat, lng] of points) box = growBox(box, lat, lng);
  return box;
}

/**
 * City map (Phase 9 + JamCity restyle): Leaflet + OSM tiles (no API key).
 * The view frames the urban area (Polygon/MultiPolygon boundary when present,
 * otherwise a town-sized window around the city center stretched to any pins)
 * without drawing that boundary on the canvas;
 * it never zooms past street-overview level, even for a single business.
 * Every pin carries its category emoji; zooming in past level 15 reveals the
 * business name above the pin. Above the canvas sits the JamCity category bar
 * (top-right): picking a category shows only that category's pins and re-zooms
 * onto them. The library loads dynamically so SSR/jest never touch `window`.
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
    let resizeObserver: ResizeObserver | null = null;

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

      // stay inside the city — no endless empty countryside (but every pin stays
      // reachable). The slack around the outline is thin on purpose: the frame
      // hugs the urban area instead of showing a ring of desert (Shiraz used to
      // open with ~15 km of empty land around it).
      const pinPoints = businesses.map((b) => [b.latitude, b.longitude] as [number, number]);
      const baseBox: LatLngBox | undefined = outline
        ? [
            [outline[0][0] - SLACK_LAT, outline[0][1] - SLACK_LNG],
            [outline[1][0] + SLACK_LAT, outline[1][1] + SLACK_LNG],
          ]
        : center
          ? [
              [center[0] - 0.25, center[1] - 0.25],
              [center[0] + 0.25, center[1] + 0.25],
            ]
          : undefined;
      let maxBounds: LatLngBox | undefined = baseBox;
      for (const [lat, lng] of pinPoints) {
        if (maxBounds) maxBounds = growBox(maxBounds, lat - SLACK_LAT, lng - SLACK_LNG);
        if (maxBounds) maxBounds = growBox(maxBounds, lat + SLACK_LAT, lng + SLACK_LNG);
      }

      // maxBounds + full viscosity = a hard frame: panning into the surrounding
      // countryside simply bounces back, so the canvas never leaves the city.
      // Wheel zoom stays on — zooming is exactly what a visitor does inside it.
      map = L.map(holder.current, {
        scrollWheelZoom: true,
        zoomControl: true,
        maxBoundsViscosity: 1.0,
        ...(maxBounds ? { maxBounds } : {}),
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // The boundary is framing data only (view + pan limit). It used to be
      // drawn as a dashed gold outline; for the seeded bounding boxes that made
      // a square frame around the city, so the canvas now stays clean.

      // True coordinates of every pin — the declutter below only ever nudges
      // a pin around this anchor, so geography is never lost.
      const placedPins: { marker: import('leaflet').Marker; anchor: [number, number] }[] = [];

      for (const b of shown) {
        const gold = b.subscriptionTier === 'GOLD';
        // The owner's logo is the business-specific map icon. If the thumbnail
        // is unavailable, retry the original upload before falling back to the
        // category glyph, so the pin never becomes an empty/broken image.
        const photo = thumbUrlFor(b.logoUrl);
        const fallbackGlyph = esc(b.category.icon || b.name.trim().slice(0, 1) || '◆');
        const icon = L.divIcon({
          className: 'map-pin-wrap',
          html:
            `<span class="map-pin map-pin--cat${gold ? ' map-pin--gold' : ''}${photo ? ' map-pin--photo' : ''}">` +
            `<span class="map-pin__icon" aria-hidden="true">${fallbackGlyph}</span>` +
            (photo
              ? `<img class="map-pin__photo" src="${esc(photo)}" data-full-src="${esc(b.logoUrl ?? '')}" alt="${esc(b.name)}" loading="lazy" />`
              : '') +
            `<span class="map-pin__name">${esc(b.name)}</span>` +
            `</span>`,
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        });
        const popup =
          `<div class="map-popup">` +
          `<strong>${esc(b.name)}</strong>` +
          `<span class="map-popup__cat">${esc(b.category.icon ?? '◆')} ${esc(b.category.name)}</span>` +
          `<a href="/business/${b.id}">مشاهده صفحه</a>` +
          `</div>`;
        const marker = L.marker([b.latitude, b.longitude], { icon, title: b.name, alt: b.name })
          .addTo(map)
          .bindPopup(popup, { autoPanPadding: [24, 48] });
        placedPins.push({ marker, anchor: [b.latitude, b.longitude] });
        if (photo) {
          const markerElement = marker.getElement();
          const image = markerElement?.querySelector<HTMLImageElement>('.map-pin__photo');
          image?.addEventListener('error', () => {
            const fullUrl = image.dataset.fullSrc;
            if (fullUrl && image.dataset.fullTried !== '1' && image.src !== fullUrl) {
              image.dataset.fullTried = '1';
              image.src = fullUrl;
              return;
            }
            image.remove();
            markerElement?.querySelector('.map-pin--photo')?.classList.remove('map-pin--photo');
          });
        }
        // Hit a pin (tap, or a pinch/zoom straight onto it) → that business's
        // info card opens. bindPopup already binds a click; this keeps it
        // explicit so a name label layered over the pin never swallows it.
        if (typeof marker.on === 'function') {
          marker.on('click', () => marker.openPopup());
        }
      }

      // deep zoom → the business names above their pins become visible
      const syncZoom = () => {
        holder.current?.classList.toggle('is-zoomed', map!.getZoom() >= 16);
      };
      map.on('zoomend', syncZoom);
      syncZoom();

      // ---- pin declutter: many pins must never sit on top of each other ----
      /** clear air (px) two pins have to keep between them */
      const PIN_GAP = 34;
      /** a pin never drifts further than this (px) from its real coordinate */
      const PIN_NUDGE_MAX = 120;
      const RELAX_STEPS = 24;

      /** Zoom changed → every pin drops back onto its true coordinate first. */
      const restorePins = () => {
        for (const pin of placedPins) {
          if (typeof pin.marker.setLatLng === 'function') pin.marker.setLatLng(pin.anchor);
        }
      };

      /**
       * Separate overlapping pins in screen space (high zoom leaves room to
       * spread), then write the result back as coordinates. The displacement is
       * capped, so a pin only ever floats a little off a truthful position and
       * snapping back on the next zoom costs nothing.
       */
      const spreadPins = () => {
        const m = map;
        if (!m || placedPins.length === 0) return;
        if (typeof m.latLngToLayerPoint !== 'function' || typeof m.layerPointToLatLng !== 'function') return;

        const home = placedPins.map((pin) => {
          const point = m.latLngToLayerPoint(pin.anchor);
          return { x: point.x, y: point.y };
        });
        const spots = home.map((point) => ({ x: point.x, y: point.y }));

        for (let step = 0; step < RELAX_STEPS; step += 1) {
          let touched = false;
          for (let i = 0; i < spots.length; i += 1) {
            for (let j = i + 1; j < spots.length; j += 1) {
              let dx = spots[j].x - spots[i].x;
              let dy = spots[j].y - spots[i].y;
              let dist = Math.hypot(dx, dy);
              if (dist === 0) {
                // Two businesses on the same metre: agree on a direction, or the
                // push below cancels out and they stay stacked.
                const angle = ((i * 60 + j * 25) * Math.PI) / 180;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
                dist = 1;
              } else if (dist >= PIN_GAP) {
                continue;
              }
              const push = (PIN_GAP - dist) / 2;
              const ux = dx / dist;
              const uy = dy / dist;
              spots[i].x -= ux * push;
              spots[i].y -= uy * push;
              spots[j].x += ux * push;
              spots[j].y += uy * push;
              touched = true;
            }
          }
          if (!touched) break;
        }

        for (let i = 0; i < placedPins.length; i += 1) {
          const pin = placedPins[i];
          if (typeof pin.marker.setLatLng !== 'function') continue;
          const offX = spots[i].x - home[i].x;
          const offY = spots[i].y - home[i].y;
          const moved = Math.hypot(offX, offY);
          if (moved < 0.5) continue; // never moved → keep the exact coordinate
          const scale = moved > PIN_NUDGE_MAX ? PIN_NUDGE_MAX / moved : 1;
          pin.marker.setLatLng(
            m.layerPointToLatLng({
              x: home[i].x + offX * scale,
              y: home[i].y + offY * scale,
            } as unknown as import('leaflet').Point),
          );
        }
      };

      // Zoom changed: pins go home at the start of the animation, then the
      // new viewport spreads them apart again (a shared zoomstart handler first,
      // so the `is-zoomed` name-label rule keeps owning the first zoomend).
      map.on('zoomstart', restorePins);
      map.on('zoomend', spreadPins);
      spreadPins();

      // ---- view fit: always the URBAN area first; a category filter narrows to its pins ----
      const pins = shown.map((b) => [b.latitude, b.longitude] as [number, number]);
      const allPins = pinPoints;
      // Urban frame: the admin outline when present; otherwise a town-sized window around the
      // centre (never the whole countryside), always stretched to include the real pins.
      let urban: LatLngBox | null = outline
        ? [
            [outline[0][0], outline[0][1]],
            [outline[1][0], outline[1][1]],
          ]
        : center
          ? [
              [center[0] - 0.035, center[1] - 0.045],
              [center[0] + 0.035, center[1] + 0.045],
            ]
          : null;
      if (!outline) {
        const pinBox = boxOfPoints(allPins);
        if (pinBox) {
          // A stored centre far from every real pin is bad data (it would frame empty countryside):
          // trust the pins then; otherwise stretch the centre window to include them.
          const centreNearPins =
            center !== null &&
            center[0] > pinBox[0][0] - 0.15 &&
            center[0] < pinBox[1][0] + 0.15 &&
            center[1] > pinBox[0][1] - 0.15 &&
            center[1] < pinBox[1][1] + 0.15;
          if (centreNearPins && urban) {
            for (const [lat, lng] of allPins) urban = growBox(urban, lat, lng);
          } else {
            urban = pinBox;
          }
        }
      }

      const frameMap = () => {
        if (!map) return;
        if (activeCat && pins.length > 0) {
          // Never a street-level view: at least a neighbourhood-sized window, max level 15.
          const focus = withMinSpan(boxOfPoints(pins) as LatLngBox);
          map.fitBounds(focus, { padding: [26, 26], maxZoom: FILTER_MAX_ZOOM });
        } else if (urban) {
          map.fitBounds(withMinSpan(urban), { padding: [24, 24], maxZoom: URBAN_MAX_ZOOM });
        } else if (pins.length > 0) {
          map.fitBounds(withMinSpan(boxOfPoints(pins) as LatLngBox), { padding: [56, 56], maxZoom: URBAN_MAX_ZOOM });
        }
      };

      // The canvas often gets its final size AFTER the first fit (fonts, banners,
      // layout settling) — the map then sits a zoom-level out and opens on the
      // countryside instead of the city. Re-fit whenever the frame resizes, but
      // only until the visitor takes over (their first drag/own zoom).
      let selfFitting = false;
      let userTookOver = false;
      const refit = () => {
        if (!map || userTookOver) return;
        selfFitting = true;
        try {
          frameMap();
        } finally {
          selfFitting = false;
        }
      };
      map.on('dragstart', () => {
        userTookOver = true;
      });
      map.on('zoomstart', () => {
        if (!selfFitting) userTookOver = true;
      });

      refit();
      if (typeof ResizeObserver !== 'undefined' && holder.current) {
        resizeObserver = new ResizeObserver(() => {
          if (!map || userTookOver) return;
          map.invalidateSize({ animate: false });
          refit();
        });
        resizeObserver.observe(holder.current);
      }
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      map?.remove();
      map = null;
    };
  }, [data, activeCat]);

  return (
    <div className="city-map" data-testid="city-map">
      {/* JamCity-style category bar — top-right of the map frame */}
      <div className="city-map__frame">
        {/* Floating on the map's top corner — the old full-width bar above the
            canvas is gone, so the map itself sits higher on the page. */}
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
      </div>
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
