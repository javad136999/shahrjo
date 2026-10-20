import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CityHomeClient } from '@/components/city-home-client';
import type { City, CityMapData } from '@/lib/types';

const mockGetCityMap = jest.fn();

jest.mock('@/components/dashboard', () => ({
  CityDashboard: ({ city, mapData, loading }: { city: City; mapData: CityMapData | null; loading: boolean }) => (
    <div
      data-testid="city-dashboard"
      data-city={city.slug}
      data-pins={mapData?.businesses.length ?? 0}
      data-loading={String(loading)}
    />
  ),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
  getCityMap: (slug: string) => mockGetCityMap(slug),
  getTokens: () => null,
  setLocalCity: jest.fn(),
}));

const city: City = {
  id: 5,
  name: 'شهر آزمایشی',
  slug: 'test-city',
  isFeatured: true,
  latitude: 29.59,
  longitude: 52.58,
  province: { id: 1, name: 'استان آزمایشی', slug: 'test-province' },
};

const oldMap: CityMapData = {
  city: { id: 5, name: city.name, slug: city.slug, latitude: city.latitude, longitude: city.longitude, boundary: null },
  businesses: [],
};

const freshMap: CityMapData = {
  ...oldMap,
  businesses: [
    {
      id: 91,
      name: 'کسب‌وکار تازه',
      slug: 'fresh-business',
      latitude: 29.6,
      longitude: 52.5,
      subscriptionTier: 'FREE',
      logoUrl: null,
      category: { name: 'فروشگاه', slug: 'shop', icon: '🏪', color: null },
    },
  ],
};

describe('CityHomeClient map freshness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replaces the server snapshot with the latest map data after mount', async () => {
    mockGetCityMap.mockResolvedValue(freshMap);

    render(<CityHomeClient city={city} showcase={[]} mapData={oldMap} feedError={null} />);

    expect(screen.getByTestId('city-dashboard')).toHaveAttribute('data-pins', '0');
    await waitFor(() => expect(screen.getByTestId('city-dashboard')).toHaveAttribute('data-pins', '1'));
    expect(mockGetCityMap).toHaveBeenCalledWith('test-city');
  });

  it('refreshes the map again when the page regains focus after leaving for admin', async () => {
    mockGetCityMap.mockResolvedValueOnce(oldMap).mockResolvedValueOnce(freshMap);

    render(<CityHomeClient city={city} showcase={[]} mapData={oldMap} feedError={null} />);
    await waitFor(() => expect(mockGetCityMap).toHaveBeenCalledTimes(1));
    fireEvent.focus(window);

    await waitFor(() => expect(mockGetCityMap).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('city-dashboard')).toHaveAttribute('data-pins', '1'));
  });
});
