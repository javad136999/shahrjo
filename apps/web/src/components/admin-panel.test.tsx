import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn(), refresh: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockGetTokens = jest.fn();
const mockGetProfile = jest.fn();
const mockGetAdminOverview = jest.fn();
const mockGetAdminAds = jest.fn();
const mockGetAdminBusinesses = jest.fn();
const mockGetAdminSubscriptions = jest.fn();
const mockApproveAdminAd = jest.fn();
const mockRejectAdminAd = jest.fn();
const mockApproveAdminBusiness = jest.fn();
const mockRejectAdminBusiness = jest.fn();
const mockApproveAdminSubscription = jest.fn();
const mockRejectAdminSubscription = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getTokens: () => mockGetTokens(),
  getProfile: () => mockGetProfile(),
  getAdminOverview: () => mockGetAdminOverview(),
  getAdminAds: (status: string) => mockGetAdminAds(status),
  getAdminBusinesses: (status: string) => mockGetAdminBusinesses(status),
  getAdminSubscriptions: (status: string) => mockGetAdminSubscriptions(status),
  approveAdminAd: (id: number) => mockApproveAdminAd(id),
  rejectAdminAd: (id: number, reason: string) => mockRejectAdminAd(id, reason),
  approveAdminBusiness: (id: number, body: unknown) => mockApproveAdminBusiness(id, body),
  rejectAdminBusiness: (id: number, reason: string) => mockRejectAdminBusiness(id, reason),
  approveAdminSubscription: (id: number) => mockApproveAdminSubscription(id),
  rejectAdminSubscription: (id: number, reason: string) => mockRejectAdminSubscription(id, reason),
}));

import { AdminPanel } from '@/components/admin-panel';
import { ApiError } from '@/lib/api';

const adminProfile = {
  id: 1,
  phone: '09174057031',
  fullName: null,
  avatarUrl: null,
  cityId: null,
  hasSelectedCity: false,
  status: 'ACTIVE',
  roles: ['SUPER_ADMIN'],
  createdAt: '2026-10-01T10:00:00.000Z',
};

const pendingAd = {
  id: 7,
  title: 'آگهی در انتظار',
  status: 'PENDING',
  rejectedReason: null,
  createdAt: '2026-10-02T10:00:00.000Z',
  viewCount: 0,
  city: { id: 1, name: 'شهر نمونه' },
  owner: { id: 5, phone: '09123456789', fullName: null },
  category: { name: 'املاک', icon: '🏠' },
  coverUrl: null,
  imageCount: 2,
};

const pendingSub = {
  id: 44,
  tier: 'GOLD',
  status: 'PENDING_REVIEW',
  createdAt: '2026-10-03T10:00:00.000Z',
  plan: { code: 'GOLD_1M', label: '۱ ماهه', tier: 'GOLD', durationDays: 30 },
  business: { id: 3, name: 'کسب‌وکار نمونه', city: { id: 1, name: 'شهر نمونه' } },
  payer: { id: 9, phone: '09120000000', fullName: null },
};

const overview = {
  pendingAds: 1,
  pendingBusinesses: 0,
  pendingSubscriptions: 1,
  approvedAds: 3,
  approvedBusinesses: 3,
  activeSubscriptions: 0,
};

describe('AdminPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGetProfile.mockResolvedValue(adminProfile);
    mockGetAdminOverview.mockResolvedValue(overview);
    mockGetAdminAds.mockResolvedValue([pendingAd]);
    mockGetAdminBusinesses.mockResolvedValue([]);
    mockGetAdminSubscriptions.mockResolvedValue([pendingSub]);
    mockApproveAdminAd.mockResolvedValue({ id: 7, status: 'APPROVED' });
    mockRejectAdminAd.mockResolvedValue({ id: 7, status: 'REJECTED' });
    mockApproveAdminSubscription.mockResolvedValue({ id: 44, status: 'ACTIVE' });
    mockRejectAdminSubscription.mockResolvedValue({ id: 44, status: 'REJECTED' });
  });

  it('redirects to login when there is no session', () => {
    mockGetTokens.mockReturnValue(null);
    render(<AdminPanel />);
    expect(mockReplace).toHaveBeenCalledWith('/login?next=/admin');
    expect(mockGetAdminAds).not.toHaveBeenCalled();
  });

  it('locks out non-operators', async () => {
    mockGetProfile.mockResolvedValue({ ...adminProfile, roles: ['USER'] });
    render(<AdminPanel />);

    expect(await screen.findByText('دسترسی ندارید')).toBeInTheDocument();
    expect(mockGetAdminAds).not.toHaveBeenCalled();
    expect(mockGetAdminOverview).not.toHaveBeenCalled();
  });

  it('shows queue counters and the pending ad queue for operators', async () => {
    render(<AdminPanel />);

    expect(await screen.findByTestId('admin-panel')).toBeInTheDocument();
    expect(screen.getByTestId('admin-stats')).toHaveTextContent('آگهی در انتظار');
    expect(screen.getByTestId('row-7')).toHaveTextContent('آگهی در انتظار');
    expect(screen.getByTestId('row-7')).toHaveTextContent('شهر نمونه');
    expect(mockGetAdminAds).toHaveBeenCalledWith('PENDING');
  });

  it('approves an ad and refreshes the queue + counters', async () => {
    render(<AdminPanel />);
    await screen.findByTestId('approve-7');

    fireEvent.click(screen.getByTestId('approve-7'));

    await waitFor(() => expect(mockApproveAdminAd).toHaveBeenCalledWith(7));
    expect(await screen.findByRole('status')).toHaveTextContent('آگهی تأیید شد');
    // counters reloaded after the decision (initial load + post-action refresh)
    expect(mockGetAdminOverview.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockGetAdminAds).toHaveBeenLastCalledWith('PENDING');
  });

  it('rejects an ad only with a valid reason', async () => {
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('محتوای نامناسب');
    render(<AdminPanel />);
    await screen.findByTestId('reject-7');

    fireEvent.click(screen.getByTestId('reject-7'));

    await waitFor(() => expect(mockRejectAdminAd).toHaveBeenCalledWith(7, 'محتوای نامناسب'));
    expect(promptSpy).toHaveBeenCalled();
  });

  it('does nothing when the operator cancels the rejection reason', async () => {
    jest.spyOn(window, 'prompt').mockReturnValue(null);
    render(<AdminPanel />);
    await screen.findByTestId('reject-7');

    fireEvent.click(screen.getByTestId('reject-7'));
    await waitFor(() => expect(screen.getByTestId('reject-7')).toBeEnabled());

    expect(mockRejectAdminAd).not.toHaveBeenCalled();
  });

  it('switches to the subscriptions tab and activates a paid plan', async () => {
    render(<AdminPanel />);
    await screen.findByTestId('tab-subscriptions');

    fireEvent.click(screen.getByTestId('tab-subscriptions'));
    expect(await screen.findByTestId('row-44')).toHaveTextContent('اشتراک ۱ ماهه');
    expect(mockGetAdminSubscriptions).toHaveBeenCalledWith('PENDING_REVIEW');

    fireEvent.click(screen.getByTestId('approve-44'));
    await waitFor(() => expect(mockApproveAdminSubscription).toHaveBeenCalledWith(44));
    expect(await screen.findByRole('status')).toHaveTextContent('اشتراک فعال شد');
  });

  it('shows the empty state when a queue has no rows', async () => {
    mockGetAdminBusinesses.mockResolvedValue([]);
    render(<AdminPanel />);
    await screen.findByTestId('tab-businesses');

    fireEvent.click(screen.getByTestId('tab-businesses'));
    expect(await screen.findByTestId('empty-queue')).toHaveTextContent('در این فهرست موردی نیست');
  });

  it('surfaces API errors from a failed action', async () => {
    mockApproveAdminAd.mockRejectedValue(new ApiError(403, 'دسترسی کافی ندارید'));
    render(<AdminPanel />);
    await screen.findByTestId('approve-7');

    fireEvent.click(screen.getByTestId('approve-7'));

    expect(await screen.findByRole('alert')).toHaveTextContent('دسترسی کافی ندارید');
    expect(screen.getByTestId('approve-7')).toBeEnabled();
  });
});
