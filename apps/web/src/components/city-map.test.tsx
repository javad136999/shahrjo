import { render, screen, waitFor } from '@testing-library/react';
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
  const mapInstance = { setView: jest.fn(), fitBounds: jest.fn(), remove: jest.fn() };
  return {
    map: jest.fn(() => mapInstance),
    tileLayer: jest.fn(() => makeLayer()),
    geoJSON: jest.fn(() => makeLayer()),
    circle: jest.fn(() => makeLayer()),
    divIcon: jest.fn(() => ({})),
    marker: jest.fn(() => makeLayer()),
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
      category: { name: 'رستوران', icon: '🍽', color: '#0e7a5f' },
    },
    {
      id: 41,
      name: 'کافه <script>بد</script>',
      slug: 'cafe',
      latitude: 27.84,
      longitude: 52.3,
      subscriptionTier: 'SILVER',
      category: { name: 'کافه', icon: '☕', color: null },
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
    // city center fallback (no boundary) draws the circle preview
    expect(leaflet.circle).toHaveBeenCalledTimes(1);
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
});
