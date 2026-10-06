import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CityMap } from '@/components/city-map';
import type { CityMapData } from '@/lib/types';

// Leaflet touches `window`/DOM APIs heavily — stub the pieces the component
// uses so the test only verifies wiring, popups and cleanup.
jest.mock('leaflet', () => {
  const makeLayer = () => {
    const layer: Record<string, unknown> = {};
    layer.addTo = jest.fn(() => layer);
    layer.bindPopup = jest.fn(() => layer);
    layer.getBounds = jest.fn(() => ({ isValid: () => false }));
    return layer;
  };
  const mapInstance = {
    setView: jest.fn(),
    fitBounds: jest.fn(),
    remove: jest.fn(),
    on: jest.fn(),
    getZoom: jest.fn(() => 12),
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
      category: { name: 'رستوران', slug: 'restaurants', icon: '🍽', color: '#0e7a5f' },
    },
    {
      id: 41,
      name: 'کافه <script>بد</script>',
      slug: 'cafe',
      latitude: 27.84,
      longitude: 52.3,
      subscriptionTier: 'SILVER',
      category: { name: 'کافه', slug: 'cafes', icon: '☕', color: null },
    },
  ],
};

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

  it('uses the admin boundary when present', async () => {
    const leaflet = require('leaflet');
    const bounded: CityMapData = {
      ...data,
      city: {
        ...data.city,
        boundary: { type: 'Polygon', coordinates: [[[52.2, 27.7], [52.5, 27.7], [52.5, 27.95], [52.2, 27.95], [52.2, 27.7]]] },
      },
    };
    render(<CityMap data={bounded} />);
    await waitFor(() => expect(leaflet.geoJSON).toHaveBeenCalledTimes(1));
    expect(leaflet.circle).not.toHaveBeenCalled();
    // whole boundary in frame
    await waitFor(() => expect(leaflet.map.mock.results[0].value.fitBounds).toHaveBeenCalled());
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

  it('gives every pin its category icon and a (hidden) business-name label', async () => {
    const leaflet = require('leaflet');
    render(<CityMap data={data} />);
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));
    const icon = leaflet.divIcon.mock.calls[1][0] as { html: string };
    expect(icon.html).toContain('map-pin--cat');
    expect(icon.html).toContain('☕'); // category emoji, not a plain dot
    expect(icon.html).toContain('map-pin__name');
    expect(icon.html).toContain('&lt;script&gt;'); // label escapes DB strings too
    expect(icon.html).not.toContain('<script>');
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

  it('shows the category bar above the map (JamCity-style, top-right)', async () => {
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
    // single result → deep residential zoom
    await waitFor(() => expect(leaflet.map.mock.results.at(-1).value.setView).toHaveBeenCalledWith([27.84, 52.3], 17));
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
});
