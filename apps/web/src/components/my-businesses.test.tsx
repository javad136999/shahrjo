import { render, screen } from '@testing-library/react';
import { MyBusinesses } from '@/components/my-businesses';

const mockList = jest.fn();
const mockTokens = jest.fn();
const mockReplace = jest.fn();
const mockRouterObject = { replace: (...args: unknown[]) => mockReplace(...args) };

jest.mock('next/navigation', () => ({ useRouter: () => mockRouterObject }));

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  getMyBusinesses: () => mockList(),
  getTokens: () => mockTokens(),
}));

const BUSINESSES = [
  {
    id: 4,
    name: 'کافه آزمون',
    slug: 'cafe-1',
    status: 'PENDING',
    subscriptionTier: 'FREE',
    logoUrl: null,
    rating: 4.5,
    ratingCount: 2,
    productCount: 3,
    pinned: true,
    category: { id: 3, name: 'کافه', icon: '☕' },
  },
  {
    id: 9,
    name: 'فروشگاه بدون منو',
    slug: 'shop-1',
    status: 'APPROVED',
    subscriptionTier: 'GOLD',
    logoUrl: '/api/v1/files/media/x.webp',
    rating: 0,
    ratingCount: 0,
    productCount: 0,
    pinned: false,
    category: { id: 5, name: 'فروشگاه', icon: '🛍️' },
  },
];

describe('MyBusinesses («کسب‌وکارهای من»)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
  });

  it('lists the owner businesses with status, product count and manage links', async () => {
    mockList.mockResolvedValue(BUSINESSES);
    render(<MyBusinesses />);

    expect(await screen.findByTestId('my-business-4')).toBeInTheDocument();
    expect(screen.getByTestId('my-business-4')).toHaveTextContent('کافه آزمون');
    expect(screen.getByTestId('my-business-4')).toHaveTextContent('در انتظار تأیید');
    expect(screen.getByTestId('my-business-4')).toHaveTextContent('۳ محصول');
    expect(screen.getByTestId('my-business-4')).toHaveTextContent('📍 روی نقشه');
    expect(screen.getByTestId('my-business-manage-4')).toHaveAttribute('href', '/business/4/manage');
    expect(screen.getByTestId('my-business-9')).toHaveTextContent('👑 طلایی');
    expect(screen.getByTestId('my-business-9')).toHaveTextContent('بدون موقعیت روی نقشه');
    expect(screen.getByTestId('my-businesses-new')).toHaveAttribute('href', '/business/new');
  });

  it('shows an empty state when the owner registered nothing', async () => {
    mockList.mockResolvedValue([]);
    render(<MyBusinesses />);
    expect(await screen.findByTestId('my-businesses-empty')).toBeInTheDocument();
  });

  it('sends a guest to the login page with a next back to this list', () => {
    mockTokens.mockReturnValue(null);
    render(<MyBusinesses />);
    expect(mockReplace).toHaveBeenCalledWith('/login?next=/businesses');
    expect(mockList).not.toHaveBeenCalled();
  });
});
