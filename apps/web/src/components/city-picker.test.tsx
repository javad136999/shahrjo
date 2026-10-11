import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockGetCities = jest.fn();
const mockPatch = jest.fn();
const mockSetLocalCity = jest.fn();
const mockGetTokens = jest.fn();
const mockGetLocalCity = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: () => mockGetCities(),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
  getLocalCity: () => mockGetLocalCity(),
  getTokens: () => mockGetTokens(),
  setLocalCity: (city: unknown) => mockSetLocalCity(city),
}));

import { CityPicker } from '@/components/city-picker';

// Fixture data only — the multi-city rule forbids real city names in web src.
const cities = [
  {
    id: 5,
    name: 'شهر نمونه',
    slug: 'sample-city',
    isFeatured: true,
    latitude: 27.83,
    longitude: 52.32,
    province: { id: 1, name: 'استان نمونه', slug: 'sample-province' },
  },
  {
    id: 1,
    name: 'شهر همسایه',
    slug: 'neighbour-city',
    isFeatured: true,
    latitude: 27.9,
    longitude: 52.4,
    province: { id: 1, name: 'استان نمونه', slug: 'sample-province' },
  },
  {
    id: 6,
    name: 'شهر دور',
    slug: 'far-city',
    isFeatured: false,
    latitude: 29.6,
    longitude: 52.53,
    province: { id: 2, name: 'استان دیگر', slug: 'other-province' },
  },
];

describe('CityPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCities.mockResolvedValue(cities);
    mockGetTokens.mockReturnValue(null);
    mockGetLocalCity.mockReturnValue({ id: 5, slug: 'sample-city', name: 'شهر نمونه' });
  });

  it('renders nothing while closed', () => {
    render(<CityPicker open={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('city-picker')).toBeNull();
    expect(mockGetCities).not.toHaveBeenCalled();
  });

  it('opens with a search box, suggestions and the rest of the cities', async () => {
    render(<CityPicker open onClose={jest.fn()} />);
    expect(await screen.findByTestId('city-picker')).toBeInTheDocument();
    expect(screen.getByTestId('city-picker-search')).toHaveAttribute('aria-label', 'جستجوی شهر');

    // the remembered city + its neighbours are suggested, the far one waits below
    await waitFor(() => expect(screen.getByTestId('city-picker-suggested')).toBeInTheDocument());
    expect(screen.getByTestId('city-picker-suggested')).toHaveTextContent('شهر نمونه');
    expect(screen.getByTestId('city-picker-suggested')).toHaveTextContent('شهر همسایه');
    expect(screen.getByTestId('city-picker-sample-city')).toHaveTextContent('فعلی');
    expect(screen.getByTestId('city-picker-far-city')).toHaveTextContent('استان دیگر');
  });

  it('filters by name (and province) as the user types', async () => {
    render(<CityPicker open onClose={jest.fn()} />);
    await screen.findByTestId('city-picker-search');
    fireEvent.change(screen.getByTestId('city-picker-search'), { target: { value: 'دور' } });

    const results = await screen.findByTestId('city-picker-results');
    expect(results).toHaveTextContent('شهر دور');
    expect(screen.queryByTestId('city-picker-neighbour-city')).toBeNull();

    fireEvent.change(screen.getByTestId('city-picker-search'), { target: { value: 'ناموجود' } });
    expect(await screen.findByText('شهری با این نام پیدا نشد.')).toBeInTheDocument();
  });

  it('picks a city: stores it, syncs the profile and goes to that city', async () => {
    const onClose = jest.fn();
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockPatch.mockResolvedValue({});
    render(<CityPicker open onClose={onClose} />);
    fireEvent.click(await screen.findByTestId('city-picker-far-city'));

    expect(mockSetLocalCity).toHaveBeenCalledWith({ id: 6, slug: 'far-city', name: 'شهر دور' });
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/users/me', { cityId: 6 }));
    expect(mockPush).toHaveBeenCalledWith('/city/far-city');
    expect(onClose).toHaveBeenCalled();
  });

  it('picks the first match with Enter (search-only flow)', async () => {
    render(<CityPicker open onClose={jest.fn()} />);
    const search = await screen.findByTestId('city-picker-search');
    fireEvent.change(search, { target: { value: 'همسایه' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(mockSetLocalCity).toHaveBeenCalledWith({ id: 1, slug: 'neighbour-city', name: 'شهر همسایه' });
    expect(mockPush).toHaveBeenCalledWith('/city/neighbour-city');
  });

  it('closes on Escape and on a backdrop click', async () => {
    const onClose = jest.fn();
    render(<CityPicker open onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('city-picker-overlay'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
