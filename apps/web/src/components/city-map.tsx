'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CityMapData } from '@/lib/types';
import { isMapCoordinateInCity, normalizeCityBoundary, type CityBoundary } from '@/lib/map-boundary';
import 'leaflet/dist/leaflet.css';

export interface CityMapProps {
  data: CityMapData;
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
/** Share of a big outline (half-width) that the opening view keeps around the centre. */
const CORE_SHARE = 0.2;
/** Outlines wider than this (degrees, ~33 km) are mostly empty land around the town. */
const BIG_OUTLINE_SPAN = 0.3;
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

  // The city-wall shortcut opens the city map with the auto-gallery filter.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('businessCategory');
    if (requested === 'car_dealer') setActiveCat(requested);
  }, []);

  // Reject broken or out-of-city legacy pins before they can affect bounds,
  // markers, category counts or the initial city frame.
  const validBusinesses = useMemo(
    () => data.businesses.filter((business) => isMapCoordinateInCity(data.city, business.latitude, business.longitude)),
    [data.businesses, data.city],
  );

  const categories = useMemo(() => {
    const bySlug = new Map<string, { slug: string; name: string; icon: string | null }>();
    for (const b of validBusinesses) {
      if (!bySlug.has(b.category.slug)) {
        bySlug.set(b.category.slug, {
          slug: b.category.slug,
          name: b.category.name,
          icon: b.category.icon,
        });
      }
    }
    return [...bySlug.values()];
  }, [validBusinesses]);

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

      const { city } = data;
      const businesses = validBusinesses;
      const shown = activeCat ? businesses.filter((b) => b.category.slug === activeCat) : businesses;
      const center: [number, number] | null =
        city.latitude !== null && city.longitude !== null ? [city.latitude, city.longitude] : null;
      if (!center && businesses.length === 0) return; // nowhere to look — handled by parent

      const boundary = normalizeCityBoundary(city.boundary);
      // bounds of the admin outline, computed before the map exists
      const outline = boundary ? boundsOfBoundary(boundary) : null;
      const initialCenter: [number, number] | null =
        center && isMapCoordinateInCity(city, center[0], center[1])
          ? center
          : businesses.length > 0
            ? [businesses[0].latitude, businesses[0].longitude]
            : outline
              ? [(outline[0][0] + outline[1][0]) / 2, (outline[0][1] + outline[1][1]) / 2]
              : null;
      if (!initialCenter) return;

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
      // Leaflet requires a valid center/zoom before any tile or marker layer is
      // added. Without this, the first newly approved pin can leave a blank map
      // because tileLayer throws "Set map center and zoom first" before fitBounds.
      map.setView(initialCenter, 10, { animate: false });

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
        const tier = (b.subscriptionTier || '').toUpperCase();
        const categoryName = b.category.name || '';
        const categorySlug = b.category.slug || '';
        const theme =
          tier === 'GOLD'
            ? { main: '#c58a28', soft: '#fff3ca', ring: '#e5b84f' }
            : tier === 'SILVER'
              ? { main: '#718092', soft: '#eef2f6', ring: '#aeb9c7' }
              : /cafe|restaurant|food|coffee|کافه|رستوران|غذا|قهوه/i.test(categoryName + ' ' + categorySlug)
                ? { main: '#c46a40', soft: '#fff0e7', ring: '#e9a27d' }
                : /car|auto|vehicle|خودرو|اتومبیل|تعمیرگاه/i.test(categoryName + ' ' + categorySlug)
                  ? { main: '#4777a8', soft: '#eaf4ff', ring: '#9fc5e6' }
                  : /sport|gym|ورزش|باشگاه/i.test(categoryName + ' ' + categorySlug)
                    ? { main: '#7a62a7', soft: '#f3edff', ring: '#c5b6e7' }
                    : /health|medical|doctor|پزشک|درمان|دارو/i.test(categoryName + ' ' + categorySlug)
                      ? { main: '#2f8d7d', soft: '#e7f8f3', ring: '#94d6c8' }
                      : { main: '#2f7657', soft: '#e8f5ed', ring: '#99cdb0' };
        const glyph = esc(b.category.icon || '📍');
        // Match JamApp's compact, category-first marker: a coloured emoji pin,
        // with tier-specific accents. Business logos stay in business cards/popups.
        const icon = L.divIcon({
          className: 'shahrjo-jam-marker',
          html:
            `<span class="jam-map-marker" style="--marker-main:${theme.main};--marker-soft:${theme.soft};--marker-ring:${theme.ring}">` +
            `<span class="jam-map-marker__pulse"></span>` +
            `<span class="jam-map-marker__body" aria-hidden="true">${glyph}</span>` +
            `</span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
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
      const PIN_GAP = 30;
      /** At street-level zoom, show every marker at its exact saved coordinate. */
      const EXACT_POSITION_ZOOM = 16;
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

      // At neighborhood scale, gently separate overlapping markers. Once the
      // visitor zooms in, restore every marker to its exact saved coordinates.
      map.on('zoomstart', restorePins);
      map.on('zoomend', () => {
        if (map && map.getZoom() >= EXACT_POSITION_ZOOM) restorePins();
        else spreadPins();
      });
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
            center[0] >= pinBox[0][0] - 0.15 &&
            center[0] <= pinBox[1][0] + 0.15 &&
            center[1] >= pinBox[0][1] - 0.15 &&
            center[1] <= pinBox[1][1] + 0.15;
          if (centreNearPins && urban) {
            for (const [lat, lng] of allPins) urban = growBox(urban, lat, lng);
          } else {
            urban = pinBox;
          }
        }
      }

      // The admin outline of a big city (Shiraz is a ~30 km box) is mostly desert.
      // The first frame hugs the built-up core instead: the pins' extent when
      // there are enough of them, else the central part of the outline. The pan
      // frame (maxBounds) stays the full outline, so everything is still reachable.
      const bigOutline =
        outline !== null && Math.max(outline[1][0] - outline[0][0], outline[1][1] - outline[0][1]) > BIG_OUTLINE_SPAN;
      if (outline && urban && bigOutline) {
        const inside = allPins.filter(
          ([lat, lng]) => lat >= outline[0][0] && lat <= outline[1][0] && lng >= outline[0][1] && lng <= outline[1][1],
        );
        const pinBox = inside.length >= 3 ? boxOfPoints(inside) : null;
        if (pinBox) {
          urban = pinBox;
        } else {
          const centreInside =
            center !== null &&
            center[0] >= outline[0][0] &&
            center[0] <= outline[1][0] &&
            center[1] >= outline[0][1] &&
            center[1] <= outline[1][1];
          const cLat = center && centreInside ? center[0] : (outline[0][0] + outline[1][0]) / 2;
          const cLng = center && centreInside ? center[1] : (outline[0][1] + outline[1][1]) / 2;
          const halfLat = Math.min((outline[1][0] - outline[0][0]) / 2, Math.max((outline[1][0] - outline[0][0]) * CORE_SHARE, MIN_HALF_LAT));
          const halfLng = Math.min((outline[1][1] - outline[0][1]) / 2, Math.max((outline[1][1] - outline[0][1]) * CORE_SHARE, MIN_HALF_LNG));
          urban = [
            [cLat - halfLat, cLng - halfLng],
            [cLat + halfLat, cLng + halfLng],
          ];
        }
      }

      const frameMap = () => {
        if (!map) return;
        // ResizeObserver can fire several times while the page settles. Stop
        // any pending zoom transition before applying a deterministic frame;
        // a stale transition callback must not outlive this map instance.
        if (typeof map.stop === 'function') map.stop();
        if (activeCat && pins.length > 0) {
          // Never a street-level view: at least a neighbourhood-sized window, max level 15.
          const focus = withMinSpan(boxOfPoints(pins) as LatLngBox);
          map.fitBounds(focus, { padding: [26, 26], maxZoom: FILTER_MAX_ZOOM, animate: false });
        } else if (urban) {
          map.fitBounds(withMinSpan(urban), { padding: [24, 24], maxZoom: URBAN_MAX_ZOOM, animate: false });
        } else if (pins.length > 0) {
          map.fitBounds(withMinSpan(boxOfPoints(pins) as LatLngBox), {
            padding: [56, 56],
            maxZoom: URBAN_MAX_ZOOM,
            animate: false,
          });
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
      if (map && typeof map.stop === 'function') map.stop();
      map?.remove();
      map = null;
    };
  }, [data, activeCat, validBusinesses]);

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
