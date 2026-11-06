import { render, screen, waitFor } from '@testing-library/react';
import WallPage from './page';

const mockApiGet = jest.fn();
const mockGetLocalCity = jest.fn();
const mockGetTokens = jest.fn();
const mockSetLocalCity = jest.fn();
const mockGetCityAds = jest.fn();
const mockGetAdCategories = jest.fn();

jest.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
  getLocalCity: () => mockGetLocalCity(),
  getTokens: () => mockGetTokens(),
  setLocalCity: (...args: unknown[]) => mockSetLocalCity(...args),
  getCityAds: (...args: unknown[]) => mockGetCityAds(...args),
  getAdCategories: (...args: unknown[]) => mockGetAdCategories(...args),
}));

jest.mock('@/components/city-classifieds', () => ({
  CityClassifieds: ({ city }: { city: { name: string } }) => <div data-testid="city-classifieds">{city.name}</div>,
}));

const localCity = { id: 1, slug: 'sample-city', name: 'شهر ذخیره‌شده' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetLocalCity.mockReturnValue(localCity);
  mockGetTokens.mockReturnValue(null);
});

describe('WallPage', () => {
  it('renders the remembered city without waiting for the city directory', async () => {
    mockGetTokens.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
    // Simulate a slow profile endpoint: the cached wall must still render.
    mockApiGet.mockReturnValue(new Promise(() => undefined));

    render(<WallPage />);

    expect(screen.getByTestId('city-classifieds')).toHaveTextContent('شهر ذخیره‌شده');
    expect(mockApiGet).toHaveBeenCalledWith('/users/me');
    expect(mockApiGet).not.toHaveBeenCalledWith('/cities');
  });

  it('reconciles a stale remembered city in the background', async () => {
    const profileCity = { id: 2, slug: 'profile-city', name: 'شهر پروفایل' };
    mockGetTokens.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/users/me') return Promise.resolve({ cityId: profileCity.id });
      if (path === '/cities') return Promise.resolve([profileCity]);
      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });

    render(<WallPage />);

    expect(screen.getByTestId('city-classifieds')).toHaveTextContent('شهر ذخیره‌شده');
    await waitFor(() => expect(screen.getByTestId('city-classifieds')).toHaveTextContent('شهر پروفایل'));
    expect(mockSetLocalCity).toHaveBeenCalledWith(profileCity);
  });
});
