import { render, screen, waitFor } from '@testing-library/react';
import { HomeClient } from '@/components/home-client';
import type { City } from '@/lib/types';

const mockReplace = jest.fn();
const mockApiGet = jest.fn();
const mockGetLocalCity = jest.fn();
const mockGetTokens = jest.fn();
const mockSetLocalCity = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: jest.fn(),
  },
  getLocalCity: () => mockGetLocalCity(),
  getTokens: () => mockGetTokens(),
  setLocalCity: (...args: unknown[]) => mockSetLocalCity(...args),
}));

const cities: City[] = [
  {
    id: 7,
    name: 'شیراز',
    slug: 'shiraz',
    isFeatured: false,
    latitude: null,
    longitude: null,
    province: { id: 1, name: 'فارس', slug: 'fars' },
  },
];

describe('HomeClient city restoration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocalCity.mockReturnValue(null);
    mockGetTokens.mockReturnValue(false);
  });

  it('returns to the locally remembered city instead of showing city selection', async () => {
    mockGetLocalCity.mockReturnValue({ id: 7, slug: 'shiraz', name: 'شیراز' });
    render(<HomeClient initialCities={cities} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/city/shiraz'));
    expect(mockSetLocalCity).toHaveBeenCalledWith({ id: 7, slug: 'shiraz', name: 'شیراز' });
    expect(screen.queryByTestId('city-shiraz')).not.toBeInTheDocument();
  });

  it('restores a profile city when there is no locally remembered choice', async () => {
    mockGetTokens.mockReturnValue(true);
    mockApiGet.mockResolvedValue({ cityId: 7 });
    render(<HomeClient initialCities={cities} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/city/shiraz'));
    expect(mockApiGet).toHaveBeenCalledWith('/users/me');
    expect(mockSetLocalCity).toHaveBeenCalledWith({ id: 7, slug: 'shiraz', name: 'شیراز' });
  });

  it('shows city selection only when the visitor has no saved city', async () => {
    render(<HomeClient initialCities={cities} />);

    expect(await screen.findByTestId('city-shiraz')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
