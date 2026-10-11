import { render, screen } from '@testing-library/react';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockGetPublicProfile = jest.fn();

jest.mock('@/lib/api', () => ({
  getPublicProfile: (id: number) => mockGetPublicProfile(id),
}));

import { UserProfileModal } from '@/components/user-profile-modal';

const baseProfile = {
  id: 9,
  fullName: 'مرضیه مرادی',
  avatarUrl: null as string | null,
  cityName: 'شهر نمونه',
  memberSince: '2026-01-15T10:00:00.000Z',
  isSelf: false,
};

describe('UserProfileModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPublicProfile.mockResolvedValue(baseProfile);
  });

  it('renders the public card and starts a private chat on the action', async () => {
    const onClose = jest.fn();
    render(<UserProfileModal userId={9} onClose={onClose} />);

    expect(await screen.findByTestId('profile-card-name')).toHaveTextContent('مرضیه مرادی');
    expect(screen.getByTestId('user-profile-card')).toHaveTextContent('شهر نمونه');

    const start = screen.getByTestId('profile-start-chat');
    start.click();
    expect(mockPush).toHaveBeenCalledWith('/messages?peer=9');
    expect(onClose).toHaveBeenCalled();
  });

  it('hides the chat action for your own account', async () => {
    mockGetPublicProfile.mockResolvedValue({ ...baseProfile, isSelf: true });
    render(<UserProfileModal userId={9} onClose={jest.fn()} />);

    expect(await screen.findByTestId('profile-card-name')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-start-chat')).not.toBeInTheDocument();
    expect(screen.getByText('این حساب، حساب خود شماست.')).toBeInTheDocument();
  });

  it('shows a not-found state when the profile fails to load', async () => {
    mockGetPublicProfile.mockRejectedValue(new Error('404'));
    render(<UserProfileModal userId={9} onClose={jest.fn()} />);

    expect(await screen.findByText('کاربر یافت نشد.')).toBeInTheDocument();
  });
});
