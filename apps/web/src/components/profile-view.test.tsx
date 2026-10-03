import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, refresh: jest.fn() }),
}));

const mockGetTokens = jest.fn();
const mockGetProfile = jest.fn();
const mockGetMyAds = jest.fn();
const mockGetMyFavorites = jest.fn();
const mockUpdateProfile = jest.fn();
const mockApiGet = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  api: { get: (path: string) => mockApiGet(path) },
  getTokens: () => mockGetTokens(),
  getProfile: () => mockGetProfile(),
  getMyAds: () => mockGetMyAds(),
  getMyFavorites: () => mockGetMyFavorites(),
  updateProfile: (patch: unknown) => mockUpdateProfile(patch),
  logoutServer: () => Promise.resolve(),
}));

import { ProfileView } from '@/components/profile-view';

const profile = {
  id: 1,
  phone: '09123456789',
  fullName: 'کاربر نمونه',
  avatarUrl: null,
  cityId: 7,
  hasSelectedCity: true,
  status: 'ACTIVE',
  roles: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const adFixture = (id: number, title: string) => ({
  id,
  title,
  status: 'PENDING',
  price: null,
  coverUrl: null,
  imageCount: 1,
  rejectedReason: null,
  createdAt: '2026-10-02T10:00:00.000Z',
  expiresAt: null,
});

describe('ProfileView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGetProfile.mockResolvedValue(profile);
    mockGetMyAds.mockResolvedValue([adFixture(3, 'آگهی من')]);
    mockGetMyFavorites.mockResolvedValue([adFixture(9, 'آگهی ذخیره‌شده')]);
    mockApiGet.mockResolvedValue([{ id: 7, name: 'شهر نمونه', slug: 'sample-city' }]);
  });

  it('redirects to the login page when there is no session', () => {
    mockGetTokens.mockReturnValue(null);
    render(<ProfileView />);
    expect(mockReplace).toHaveBeenCalledWith('/login?next=/profile');
  });

  it('renders account info with the resolved city name', async () => {
    render(<ProfileView />);

    expect(await screen.findByTestId('profile-card')).toBeInTheDocument();
    expect(screen.getByText(/09123456789/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('کاربر نمونه')).toBeInTheDocument();
    expect(await screen.findByText(/شهر نمونه/)).toBeInTheDocument();
  });

  it('lists my ads and favorites as separate sections', async () => {
    render(<ProfileView />);

    expect(await screen.findByRole('region', { name: 'آگهی‌های من' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'علاقه‌مندی‌ها' })).toBeInTheDocument();
    expect(screen.getByTestId('my-ad-3')).toHaveTextContent('آگهی من');
    expect(screen.getByTestId('my-ad-9')).toHaveTextContent('آگهی ذخیره‌شده');
    // both link into the ad detail page
    expect(screen.getByTestId('my-ad-3').querySelector('a')).toHaveAttribute('href', '/ad/3');
    expect(screen.getByTestId('my-ad-9').querySelector('a')).toHaveAttribute('href', '/ad/9');
  });

  it('saves an edited display name', async () => {
    mockUpdateProfile.mockResolvedValue({ ...profile, fullName: 'نام جدید' });
    render(<ProfileView />);
    await screen.findByTestId('profile-card');

    fireEvent.change(screen.getByLabelText('نام نمایشی'), { target: { value: 'نام جدید' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره نام' }));

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ fullName: 'نام جدید' }));
    expect(await screen.findByRole('button', { name: 'ذخیره شد ✓' })).toBeInTheDocument();
  });
});
