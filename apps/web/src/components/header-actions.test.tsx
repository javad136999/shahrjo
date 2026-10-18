import { render, screen, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
const mockPathname = { current: '/' };
const mockTokens = jest.fn();
const mockGet = jest.fn();
const mockLogout = jest.fn();
const mockGetUnread = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => mockPathname.current,
}));

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  getTokens: () => mockTokens(),
  getNotificationUnreadCount: () => mockGetUnread(),
  NOTIFICATIONS_CHANGED_EVENT: 'shahrjo:notifications-changed',
  api: { get: (path: string) => mockGet(path) },
  logoutServer: () => mockLogout(),
}));

import { HeaderActions } from '@/components/header-actions';

const profile = {
  id: 1,
  phone: '09123456789',
  fullName: 'جواد احمدی',
  avatarUrl: null,
  cityId: 7,
  hasSelectedCity: true,
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('HeaderActions (سمت چپ هدر)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.current = '/';
    mockTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGet.mockResolvedValue(profile);
    mockGetUnread.mockResolvedValue({ total: 0 });
  });

  it('shows the plain login button to guests', () => {
    mockTokens.mockReturnValue(null);
    render(<HeaderActions />);
    const login = screen.getByRole('link', { name: 'ورود' });
    expect(login).toHaveAttribute('href', '/login');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('greets the signed-in user by NAME on the top-left slot', async () => {
    render(<HeaderActions />);

    const slot = await screen.findByTestId('header-profile');
    expect(slot).toHaveTextContent('جواد احمدی');
    expect(slot).toHaveAttribute('href', '/profile');
    expect(screen.getByTestId('header-logout')).toBeInTheDocument();
    // no login button while signed in
    expect(screen.queryByRole('link', { name: 'ورود' })).not.toBeInTheDocument();
  });

  it('falls back to the phone when no display name is set', async () => {
    mockGet.mockResolvedValue({ ...profile, fullName: null });
    render(<HeaderActions />);

    const slot = await screen.findByTestId('header-profile');
    expect(slot).toHaveTextContent('09123456789');
  });

  it('re-reads the profile after a login lands back in the app (new pathname)', async () => {
    mockTokens.mockReturnValue(null);
    const { rerender } = render(<HeaderActions />);
    await screen.findByRole('link', { name: 'ورود' });
    expect(mockGet).not.toHaveBeenCalled();

    // login happened in another tab/route: session now exists
    mockTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockPathname.current = '/city/sample-city';
    rerender(<HeaderActions />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/users/me'));
    expect(await screen.findByTestId('header-profile')).toHaveTextContent('جواد احمدی');
  });
});
