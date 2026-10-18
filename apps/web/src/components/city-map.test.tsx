import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CityMap } from '@/components/city-map';
import type { CityMapData } from '@/lib/types';

// Leaflet touches `window`/DOM APIs heavily — stub the pieces the component
// uses so the test only verifies wiring, popups and cleanup.
jest.mock('leaflet', () => {
  const makeLayer = () => {
    const layer: Record<string, unknown> = {};
    const element = document.createElement('div');
    const pin = document.createElement('span');
    pin.className = 'map-pin--cat map-pin--photo';
    const image = document.createElement('img');
    image.className = 'map-pin__photo';
    image.dataset.fullSrc = '/api/v1/files/businesses/40.webp';
    pin.append(image);
    element.append(pin);
    layer.addTo = jest.fn(() => layer);
    layer.bindPopup = jest.fn(() => layer);
    layer.getBounds = jest.fn(() => ({ isValid: () => false }));
    layer.getElement = jest.fn(() => element);
    // pin nudging + the tap-to-open card use these three
    layer.on = jest.fn(() => layer);
    layer.openPopup = jest.fn();
    layer.setLatLng = jest.fn(() => layer);
    return layer;
  };
  const mapInstance = {
    setView: jest.fn(),
    fitBounds: jest.fn(),
    invalidateSize: jest.fn(),
    remove: jest.fn(),
    on: jest.fn(),
    getZoom: jest.fn(() => 12),
    // screen-space projection: 1° ≈ 36k px is as good as any for a stub
    latLngToLayerPoint: jest.fn((ll: [number, number]) => ({ x: ll[1] * 36000, y: ll[0] * 36000 })),
    layerPointToLatLng: jest.fn((p: { x: number; y: number }) => [p.y / 36000, p.x / 36000]),
  };
  return {
    map: jest.fn(() => mapInstance),
    tileLayer: jest.fn(() => makeLayer()),
    geoJSON: jest.fn(() => makeLayer()),
    circle: jest.fn(() => makeLayer()),
    divIcon: jest.fn(() => ({})),
    marker: jest.fn(() => makeLayer()),
    latLngBounds: jest.fn(() => ({ isValid: () => true })),
    featureGroup: jest.fn(() => ({ getBounds: () => ({ isValid: () => false }) })),
  };
});

const data: CityMapData = {
  city: { id: 1, name: 'شهر نمونه', slug: 'sample-city', latitude: 27.83, longitude: 52.32, boundary: null },
  businesses: [
    {
      id: 40,
      name: 'رستوران ویترین',
      slug: 'showcase-rest',
      latitude: 27.831,
      longitude: 52.321,
      subscriptionTier: 'GOLD',
      logoUrl: null,
      category: { name: 'رستوران', slug: 'restaurants', icon: '🍽', color: '#0e7a5f' },
    },
    {
      id: 41,
      name: 'کافه <script>بد</script>',
      slug: 'cafe',
      latitude: 27.84,
      longitude: 52.3,
      subscriptionTier: 'SILVER',
      logoUrl: null,
      category: { name: 'کافه', slug: 'cafes', icon: '☕', color: null },
    },
  ],
};

/**
 * Bounds are re-centred to a minimum urban span, so the numbers come back with
 * float noise (50.89999999999999) — compare them at ~0.1 m precision.
 */
const roundBox = (box: number[][]): number[][] =>
  box.map((point) => point.map((value) => Number(value.toFixed(6))));

describe('CityMap', () => {
  beforeEach(() => {
    // the leaflet mock is module-level — reset call history per test
    jest.clearAllMocks();
  });

  it('renders the canvas and legend', async () => {
    render(<CityMap data={data} />);
    expect(screen.getByTestId('city-map')).toBeInTheDocument();
    expect(screen.getByRole('application', { name: 'نقشه شهر' })).toBeInTheDocument();
    expect(screen.getByText(/کسب‌وکار طلایی/)).toBeInTheDocument();
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument();
    await waitFor(() => expect(require('leaflet').map).toHaveBeenCalled());
  });

  it('initializes one map with a marker per pinned business, then removes it on unmount', async () => {
    const leaflet = require('leaflet');
    const { unmount } = render(<CityMap data={data} />);
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));
    // no decorative circle without a boundary — the pins define the view
    expect(leaflet.circle).not.toHaveBeenCalled();
    unmount();
    expect(leaflet.map.mock.results[0].value.remove).toHaveBeenCalled();
  });

  it('uses the admin boundary for framing but never draws it on the canvas', async () => {
    const leaflet = require('leaflet');
    const bounded: CityMapData = {
      ...data,
      city: {
        ...data.city,
        boundary: { type: 'Polygon', coordinates: [[[52.2, 27.7], [52.5, 27.7], [52.5, 27.95], [52.2, 27.95], [52.2, 27.7]]] },
      },
    };
    render(<CityMap data={bounded} />);
    // no dashed square around the city (the seeded boxes made the map look boxed)
    expect(leaflet.geoJSON).not.toHaveBeenCalled();
    expect(leaflet.circle).not.toHaveBeenCalled();
    // …but the whole boundary is still in frame
    await waitFor(() => expect(leaflet.map.mock.results[0].value.fitBounds).toHaveBeenCalled());
    const [box] = leaflet.map.mock.results[0].value.fitBounds.mock.calls[0];
    expect(roundBox(box)).toEqual([[27.7, 52.2], [27.95, 52.5]]);
  });

  it('renders boundaries stored as raw coordinate rings (the seed format)', async () => {
    const leaflet = require('leaflet');
    const seeded: CityMapData = {
      ...data,
      city: {
        ...data.city,
        // exactly what prisma/seed writes — no { type, coordinates } wrapper
        boundary: [[[50.8, 28.85], [50.8, 29.0], [50.9, 29.0], [50.9, 28.85], [50.8, 28.85]]],
      },
    };
    render(<CityMap data={seeded} />);
    await waitFor(() => expect(leaflet.map.mock.results[0].value.fitBounds).toHaveBeenCalled());
    // the seeded box frames the view without being painted as an outline
    const [box] = leaflet.map.mock.results[0].value.fitBounds.mock.calls[0];
    expect(roundBox(box)).toEqual([[28.85, 50.8], [29.0, 50.9]]);
    expect(leaflet.geoJSON).not.toHaveBeenCalled();
    expect(leaflet.circle).not.toHaveBeenCalled();
  });

  it('supports MultiPolygon boundaries such as coastal or island-shaped cities', async () => {
    const leaflet = require('leaflet');
    const multipart: CityMapData = {
      ...data,
      city: {
        ...data.city,
        boundary: {
          type: 'MultiPolygon',
          coordinates: [
            [[[52.2, 27.7], [52.5, 27.7], [52.5, 27.95], [52.2, 27.95], [52.2, 27.7]]],
            [[[52.6, 27.8], [52.7, 27.8], [52.7, 27.9], [52.6, 27.9], [52.6, 27.8]]],
          ],
        },
      },
    };
    render(<CityMap data={multipart} />);
    await waitFor(() => expect(leaflet.map.mock.results[0].value.fitBounds).toHaveBeenCalled());
    const [box] = leaflet.map.mock.results[0].value.fitBounds.mock.calls[0];
    expect(roundBox(box)).toEqual([[27.7, 52.2], [27.95, 52.7]]); // every part of the city stays in frame
    expect(leaflet.geoJSON).not.toHaveBeenCalled();
  });

  it('frames the whole city when its boundary and businesses are not available', async () => {
    const leaflet = require('leaflet');
    render(<CityMap data={{ ...data, businesses: [] }} />);
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1));
    expect(leaflet.map.mock.results[0].value.fitBounds).toHaveBeenCalled();
    expect(leaflet.map.mock.results[0].value.setView).not.toHaveBeenCalled();
  });

  it('escapes HTML in popup content', async () => {
    const leaflet = require('leaflet');
    render(<CityMap data={data} />);
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));
    const second = leaflet.marker.mock.calls[1][0];
    expect(second).toEqual([27.84, 52.3]);
    const popup = leaflet.marker.mock.results[1].value.bindPopup.mock.calls[0][0] as string;
    expect(popup).toContain('&lt;script&gt;');
    expect(popup).not.toContain('<script>');
  });

  it('renders compact JamApp-style category markers without business-name labels', async () => {
    const leaflet = require('leaflet');
    render(<CityMap data={data} />);
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));
    const iconOptions = leaflet.divIcon.mock.calls[1][0] as { html: string; className: string; iconSize: number[] };
    expect(iconOptions.className).toBe('shahrjo-jam-marker');
    expect(iconOptions.html).toContain('jam-map-marker__body');
    expect(iconOptions.html).toContain('☕'); // category emoji, not a plain dot
    expect(iconOptions.html).toContain('--marker-main:');
    expect(iconOptions.html).toContain('jam-map-marker__pulse');
    expect(iconOptions.html).not.toContain('map-pin__name');
    expect(iconOptions.html).not.toContain('<script>');
    expect(iconOptions.iconSize).toEqual([38, 38]);
  });

  it('keeps business logos out of compact map markers while retaining business title and popup', async () => {
    const leaflet = require('leaflet');
    const withLogo: CityMapData = {
      ...data,
      businesses: data.businesses.map((business, index) =>
        index === 0 ? { ...business, logoUrl: '/api/v1/files/businesses/40.webp' } : business,
      ),
    };
    render(<CityMap data={withLogo} />);
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));

    const iconOptions = leaflet.divIcon.mock.calls[0][0] as { html: string; iconSize: number[] };
    expect(iconOptions.html).not.toContain('/api/v1/files/businesses/40.webp');
    expect(iconOptions.html).toContain('jam-map-marker__body');
    expect(iconOptions.html).toContain('👑'); // gold tier accent is shown via marker colour
    expect(leaflet.marker.mock.calls[0][1]).toMatchObject({ title: 'رستوران ویترین', alt: 'رستوران ویترین' });
    expect(iconOptions.iconSize).toEqual([38, 38]);
    const popup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as string;
    expect(popup).toContain('رستوران ویترین');
    expect(popup).toContain('/business/');
  });

  it('reveals the business names only once the user zooms in', async () => {
    const leaflet = require('leaflet');
    const { container } = render(<CityMap data={data} />);
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1));
    const canvas = container.querySelector('.city-map__canvas') as HTMLElement;
    const instance = leaflet.map.mock.results[0].value;
    const zoomHandler = instance.on.mock.calls.find((c: unknown[]) => c[0] === 'zoomend')[1] as () => void;

    expect(canvas.classList.contains('is-zoomed')).toBe(false);
    instance.getZoom.mockReturnValue(16);
    zoomHandler();
    expect(canvas.classList.contains('is-zoomed')).toBe(true);
    instance.getZoom.mockReturnValue(14);
    zoomHandler();
    expect(canvas.classList.contains('is-zoomed')).toBe(false);
  });

  it('docks the category filter on the map corner instead of a bar above it', () => {
    const { container } = render(<CityMap data={data} />);
    const frame = container.querySelector('.city-map__frame');
    expect(frame).not.toBeNull();
    // both the canvas and the dock live inside the frame → the dock floats on
    // the map and no full-width row sits above it any more
    expect(frame!.querySelector('.city-map__canvas')).not.toBeNull();
    expect(frame!.querySelector('.map-catbar')).not.toBeNull();
    expect(frame!.querySelector('.map-catbtn')).not.toBeNull();
  });

  it('shows the category filter with its menu (JamCity-style)', async () => {
    render(<CityMap data={data} />);
    const btn = screen.getByTestId('map-catbtn');
    expect(btn).toHaveAttribute('aria-label', 'دسته‌بندی کسب‌وکارها');
    expect(btn).toHaveTextContent('دسته‌بندی کسب‌وکارها');
    // menu closed initially
    expect(screen.queryByTestId('map-catmenu')).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByTestId('map-catmenu')).toBeInTheDocument();
    expect(screen.getByTestId('map-cat-option-all')).toBeInTheDocument();
    expect(screen.getByTestId('map-cat-option-restaurants')).toHaveTextContent('رستوران');
    expect(screen.getByTestId('map-cat-option-cafes')).toHaveTextContent('کافه');
  });

  it('filters markers to the chosen category and re-zooms onto them', async () => {
    const leaflet = require('leaflet');
    render(<CityMap data={data} />);
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTestId('map-catbtn'));
    fireEvent.click(screen.getByTestId('map-cat-option-cafes'));

    // menu closes and only the cafe pin remains
    await waitFor(() => expect(screen.queryByTestId('map-catmenu')).not.toBeInTheDocument());
    expect(screen.getByTestId('map-catbtn')).toHaveTextContent('کافه');
    await waitFor(() => {
      const positions = leaflet.marker.mock.calls.map((c: unknown[][][]) => c[0]);
      expect(positions[positions.length - 1]).toEqual([27.84, 52.3]);
    });
    // single result → still an urban-scale view (never street level / zoom 17)
    await waitFor(() => {
      const last = leaflet.map.mock.results.at(-1).value;
      expect(last.fitBounds).toHaveBeenCalled();
      const [box, opts] = last.fitBounds.mock.calls.at(-1);
      expect(opts.maxZoom).toBeLessThanOrEqual(15);
      // at least ~4.5 km across so the neighbourhood stays visible
      expect(box[1][0] - box[0][0]).toBeGreaterThanOrEqual(0.039);
      expect(box[1][1] - box[0][1]).toBeGreaterThanOrEqual(0.049);
      expect(last.setView).not.toHaveBeenCalled();
    });
  });

  it('frames the urban area (not the countryside) and caps the zoom when there is no boundary', async () => {
    const leaflet = require('leaflet');
    render(<CityMap data={{ ...data, businesses: [] }} />);
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1));
    const [box, opts] = leaflet.map.mock.results[0].value.fitBounds.mock.calls[0];
    expect(opts.maxZoom).toBeLessThanOrEqual(14);
    expect(box[1][0] - box[0][0]).toBeLessThan(0.2); // town-sized, not a 27 km countryside frame
    expect(box[0][0]).toBeLessThan(27.83);
    expect(box[1][0]).toBeGreaterThan(27.83);
  });

  it('ignores a stored centre that is far from every business (bad data) and frames the pins', async () => {
    const leaflet = require('leaflet');
    const badCentre = { ...data, city: { ...data.city, latitude: 27.89, longitude: 52.49 } }; // ~17 km from the pins
    render(<CityMap data={badCentre} />);
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1));
    const [box] = leaflet.map.mock.results[0].value.fitBounds.mock.calls[0];
    expect(box[1][1]).toBeLessThan(52.4); // the empty countryside around the bad centre is not framed
  });

  it('pads a tiny city outline up to a readable urban extent', async () => {
    const leaflet = require('leaflet');
    const tiny = { type: 'Polygon', coordinates: [[[52.3, 27.83], [52.301, 27.83], [52.301, 27.831], [52.3, 27.831], [52.3, 27.83]]] };
    render(<CityMap data={{ ...data, city: { ...data.city, boundary: tiny }, businesses: [] }} />);
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1));
    const [box] = leaflet.map.mock.results[0].value.fitBounds.mock.calls[0];
    expect(box[1][0] - box[0][0]).toBeGreaterThanOrEqual(0.039);
  });

  it('«همه کسب‌وکارها» restores every pin', async () => {
    const leaflet = require('leaflet');
    render(<CityMap data={data} />);
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTestId('map-catbtn'));
    fireEvent.click(screen.getByTestId('map-cat-option-restaurants'));
    fireEvent.click(screen.getByTestId('map-catbtn'));
    fireEvent.click(screen.getByTestId('map-cat-option-all'));

    await waitFor(() => {
      const lastCalls = leaflet.marker.mock.calls.slice(-2);
      expect(lastCalls).toHaveLength(2);
    });
    expect(screen.getByTestId('map-catbtn')).toHaveTextContent('دسته‌بندی کسب‌وکارها');
  });

  it('locks the frame: hard maxBounds hugging the outline + wheel zoom inside it', async () => {
    const leaflet = require('leaflet');
    render(
      <CityMap
        data={{
          ...data,
          city: {
            ...data.city,
            boundary: { type: 'Polygon', coordinates: [[[52.2, 27.7], [52.5, 27.7], [52.5, 27.95], [52.2, 27.95], [52.2, 27.7]]] },
          },
        }}
      />,
    );
    await waitFor(() => expect(leaflet.map).toHaveBeenCalled());

    const options = leaflet.map.mock.calls[0][1] as {
      maxBoundsViscosity: number;
      scrollWheelZoom: boolean;
      maxBounds: [[number, number], [number, number]];
    };
    // 1.0 = full viscosity: dragging past the frame bounces straight back —
    // the visitor never ends up in the countryside around the city
    expect(options.maxBoundsViscosity).toBe(1.0);
    // zooming/scrolling INSIDE the frame stays allowed
    expect(options.scrollWheelZoom).toBe(true);
    // and the frame itself hugs the urban outline (thin 0.02° slack only)
    expect(options.maxBounds[0][0]).toBeCloseTo(27.7 - 0.02, 5);
    expect(options.maxBounds[0][1]).toBeCloseTo(52.2 - 0.02, 5);
    expect(options.maxBounds[1][0]).toBeCloseTo(27.95 + 0.02, 5);
    expect(options.maxBounds[1][1]).toBeCloseTo(52.5 + 0.02, 5);
  });

  it('re-fits when the canvas settles its size (the map opened one zoom-level out)', async () => {
    // Controllable ResizeObserver — jsdom does not ship one
    const callbacks: ResizeObserverCallback[] = [];
    class TestRO {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (global as unknown as { ResizeObserver: unknown }).ResizeObserver = TestRO;

    try {
      const leaflet = require('leaflet');
      render(<CityMap data={data} />);
      await waitFor(() => expect(leaflet.map).toHaveBeenCalled());
      const instance = leaflet.map.mock.results[0].value;
      expect(instance.fitBounds).toHaveBeenCalledTimes(1);

      // fonts/banners/layout finish → the canvas changes size after the first fit
      callbacks.forEach((cb) => cb([], {} as ResizeObserver));

      expect(instance.invalidateSize).toHaveBeenCalledWith({ animate: false });
      // …and the view is framed again instead of staying a zoom-level out
      expect(instance.fitBounds.mock.calls.length).toBeGreaterThan(1);
    } finally {
      delete (global as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });

  it('pulls stacked pins apart and sends them home when the user zooms', async () => {
    const leaflet = require('leaflet');
    // two businesses registered on the very same metre
    const stacked: CityMapData = {
      ...data,
      businesses: [
        data.businesses[0],
        { ...data.businesses[1], latitude: data.businesses[0].latitude, longitude: data.businesses[0].longitude },
      ],
    };
    render(<CityMap data={stacked} />);
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));

    const instance = leaflet.map.mock.results[0].value;
    const zoomStarts = instance.on.mock.calls.filter((c: unknown[]) => c[0] === 'zoomstart');
    const zoomEnds = instance.on.mock.calls.filter((c: unknown[]) => c[0] === 'zoomend');
    const restorePins = zoomStarts[0][1] as () => void;
    const spreadPins = zoomEnds[1][1] as () => void; // zoomend #1 = the is-zoomed label

    const created = leaflet.marker.mock.results.slice(0, 2) as unknown as Array<{
      value: { setLatLng: jest.Mock; on: jest.Mock; openPopup: jest.Mock; bindPopup: jest.Mock };
    }>;
    const first = created[0].value;
    const second = created[1].value;

    spreadPins();
    expect(first.setLatLng).toHaveBeenCalled();
    expect(second.setLatLng).toHaveBeenCalled();
    const apartA = first.setLatLng.mock.calls.at(-1)[0];
    const apartB = second.setLatLng.mock.calls.at(-1)[0];
    expect(apartA).not.toEqual(apartB); // they no longer cover each other
    expect(apartA).not.toEqual([27.831, 52.321]); // nudged away from the shared spot

    restorePins();
    expect(first.setLatLng).toHaveBeenLastCalledWith([27.831, 52.321]);
    expect(second.setLatLng).toHaveBeenLastCalledWith([27.831, 52.321]);
  });

  it('opens that business’s info card when its pin is hit', async () => {
    const leaflet = require('leaflet');
    render(<CityMap data={data} />);
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));

    const marker = leaflet.marker.mock.results[0].value;
    expect(marker.bindPopup).toHaveBeenCalled();
    expect(marker.on).toHaveBeenCalledWith('click', expect.any(Function));
    marker.on.mock.calls[0][1]();
    expect(marker.openPopup).toHaveBeenCalled();
  });
});
