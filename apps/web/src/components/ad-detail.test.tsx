import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
}));

const mockGetAdDetail = jest.fn();
const mockToggleAdFavorite = jest.fn();
const mockGetTokens = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getAdDetail: (id: number) => mockGetAdDetail(id),
  toggleAdFavorite: (id: number) => mockToggleAdFavorite(id),
  getTokens: () => mockGetTokens(),
}));

import { AdDetail } from '@/components/ad-detail';
import { ApiError } from '@/lib/api';

const adFixture = (over: Record<string, unknown> = {}) => ({
  id: 42,
  title: 'کولر گازی نو',
  description: 'توضیحات کامل آگهی برای نمایش در صفحه جزئیات',
  price: 15000000,
  phone: '09123456789',
  address: 'خیابان اصلی',
  status: 'APPROVED',
  viewCount: 12,
  publishedAt: '2026-10-01T10:00:00.000Z',
  createdAt: '2026-10-01T10:00:00.000Z',
  expiresAt: null,
  rejectedReason: null,
  images: ['/api/v1/files/ads/a.png'],
  category: { id: 3, name: 'لوازم', slug: 'goods', icon: '🛍️', color: null },
  city: { id: 7, name: 'شهر نمونه', slug: 'sample-city' },
  isOwner: false,
  favorited: false,
  ...over,
});

describe('AdDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGetAdDetail.mockResolvedValue(adFixture());
  });

  it('renders the ad with gallery, price and contact action', async () => {
    render(<AdDetail id={42} />);

    expect(await screen.findByTestId('ad-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'کولر گازی نو' })).toBeInTheDocument();
    expect(screen.getByTestId('ad-detail-price')).toHaveTextContent('ریال');
    expect(screen.getByTestId('ad-call')).toHaveAttribute('href', 'tel:09123456789');
    expect(screen.getByTestId('ad-gallery-main')).toHaveAttribute(
      'src',
      '/api/v1/files/ads/a.png',
    );
    expect(screen.getByRole('link', { name: /بازگشت به شهر نمونه/ })).toHaveAttribute(
      'href',
      '/city/sample-city',
    );
  });

  it('shows a not-found message when the API answers 404', async () => {
    mockGetAdDetail.mockRejectedValue(new ApiError(404, 'آگهی یافت نشد'));
    render(<AdDetail id={404} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('چنین آگهی‌ای پیدا نشد');
    expect(screen.queryByTestId('ad-detail')).not.toBeInTheDocument();
  });

  it('sends guests to the login page instead of favoriting', async () => {
    mockGetTokens.mockReturnValue(null);
    render(<AdDetail id={42} />);
    await screen.findByTestId('ad-detail');

    fireEvent.click(screen.getByTestId('ad-favorite'));

    expect(mockPush).toHaveBeenCalledWith('/login?next=/ad/42');
    expect(mockToggleAdFavorite).not.toHaveBeenCalled();
  });

  it('toggles the favorite for a signed-in user', async () => {
    mockToggleAdFavorite.mockResolvedValue({ favorited: true });
    render(<AdDetail id={42} />);
    await screen.findByTestId('ad-detail');

    fireEvent.click(screen.getByTestId('ad-favorite'));

    await waitFor(() => expect(mockToggleAdFavorite).toHaveBeenCalledWith(42));
    expect(await screen.findByTestId('ad-favorite')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('ad-favorite')).toHaveTextContent('ذخیره شده');
  });

  it('explains the moderation state to the owner of a PENDING ad', async () => {
    mockGetAdDetail.mockResolvedValue(adFixture({ status: 'PENDING', isOwner: true }));
    render(<AdDetail id={42} />);

    expect(await screen.findByRole('status')).toHaveTextContent('در انتظار تأیید ناظر');
    expect(screen.getByText('در انتظار تأیید')).toBeInTheDocument(); // owner status chip
  });
});
