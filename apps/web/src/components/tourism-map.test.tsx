import { render, screen, waitFor } from '@testing-library/react';
import { TourismMap } from '@/components/tourism-map';
import type { TourismSpot } from '@/lib/tourism';

jest.mock('leaflet', () => {
  const makeLayer = () => {
    const layer: Record<string, unknown> = {};
    layer.addTo = jest.fn(() => layer);
    layer.bindPopup = jest.fn(() => layer);
    return layer;
  };
  const mapInstance = {
    fitBounds: jest.fn(),
    setView: jest.fn(),
    invalidateSize: jest.fn(),
    stop: jest.fn(),
    remove: jest.fn(),
    on: jest.fn(),
    closePopup: jest.fn(),
  };
  return {
    map: jest.fn(() => mapInstance),
    tileLayer: jest.fn(() => makeLayer()),
    divIcon: jest.fn(() => ({})),
    marker: jest.fn(() => makeLayer()),
    latLngBounds: jest.fn((points) => ({ points })),
  };
});

const makeSpot = (id: string, name: string, latitude: number, longitude: number): TourismSpot => ({
  id,
  name,
  category: 'تاریخی',
  description: 'مکان تاریخی برای آزمون نمایش نقشه.',
  latitude,
  longitude,
  icon: '🏛️',
  accent: '#92400e',
  duration: '۱ ساعت',
  tip: 'ساعت بازدید را بررسی کنید.',
  locationLabel: 'مرکز شهر',
  sourceUrl: 'https://example.com/tourism',
  sourceLabel: 'منبع آزمون',
  coordinateSourceUrl: 'https://www.openstreetmap.org/',
});

describe('TourismMap', () => {
  it('renders a marker and safe popup for each attraction and frames all locations', async () => {
    const leaflet = require('leaflet');
    const spots = [
      makeSpot('spot-one', 'ارگ نمونه', 38.07, 46.29),
      makeSpot('spot-two', '<script>بد</script>', 37.79, 46.25),
    ];
    render(<TourismMap spots={spots} />);

    expect(screen.getByTestId('tourism-map')).toHaveAttribute('data-pins', '2');
    expect(screen.getByRole('application', { name: 'نقشهٔ جاذبه‌های گردشگری' })).toBeInTheDocument();
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(2));
    expect(leaflet.latLngBounds).toHaveBeenCalledWith([[38.07, 46.29], [37.79, 46.25]]);
    expect(leaflet.map.mock.results[0].value.fitBounds).toHaveBeenCalled();

    const popup = leaflet.marker.mock.results[1].value.bindPopup.mock.calls[0][0] as string;
    expect(popup).toContain('&lt;script&gt;');
    expect(popup).not.toContain('<script>');
    expect(popup).toContain('https://www.google.com/maps/dir/?api=1&destination=37.79%2C46.25');
    expect(popup).toContain('مسیریابی با گوگل‌مپ');
    expect(popup).not.toContain('OpenStreetMap');

    const map = leaflet.map.mock.results[0].value;
    const popupOptions = leaflet.marker.mock.results[1].value.bindPopup.mock.calls[0][1];
    expect(popupOptions).toMatchObject({ maxWidth: 260, maxHeight: 168, closeOnClick: true });
    const mapClick = map.on.mock.calls.find(([event]: [string]) => event === 'click')?.[1];
    expect(mapClick).toEqual(expect.any(Function));
    mapClick();
    expect(map.closePopup).toHaveBeenCalledTimes(1);
    expect(map.remove).toHaveBeenCalledTimes(0);
  });
});
