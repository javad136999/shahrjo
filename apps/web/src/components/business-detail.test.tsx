import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BusinessDetail } from '@/components/business-detail';

const mockDetail = jest.fn();
const mockGetMyReview = jest.fn();
const mockSaveReview = jest.fn();
const mockTokens = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
  },
  getBusinessDetail: (id: number) => mockDetail(id),
  getMyBusinessReview: (id: number) => mockGetMyReview(id),
  saveBusinessReview: (id: number, body: unknown) => mockSaveReview(id, body),
  getTokens: () => mockTokens(),
}));

const detail = (overrides: Record<string, unknown> = {}) => ({
  id: 30,
  name: 'رستوران دریا',
  slug: 'sea',
  description: 'غذای دریایی تازه',
  logoUrl: null,
  coverUrl: null,
  phone: '09120000000',
  address: 'خیابان اصلی',
  latitude: 27.1,
  longitude: 56.2,
  workingHours: null,
  socialLinks: null,
  rating: 4.2,
  ratingCount: 8,
  viewCount: 12,
  subscriptionTier: 'GOLD',
  createdAt: '2026-01-01T00:00:00.000Z',
  city: { name: 'شهر نمونه', slug: 'sample-city' },
  category: { name: 'رستوران', slug: 'restaurants', icon: '🍽️', color: null },
  products: [],
  reviews: [],
  ...overrides,
});

describe('BusinessDetail — منو و نظرات', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockReturnValue(null);
    mockGetMyReview.mockResolvedValue(null);
  });

  it('renders the menu grouped by section with prices (map → business entry)', async () => {
    mockDetail.mockResolvedValue(
      detail({
        products: [
          {
            id: 1,
            name: 'قیمه',
            description: 'با برنج ایرانی',
            price: 320_000,
            imageUrl: null,
            section: 'غذاهای اصلی',
            isAvailable: true,
          },
          {
            id: 2,
            name: 'دوغ',
            description: null,
            price: null,
            imageUrl: '/api/v1/files/media/dogh.webp',
            section: 'نوشیدنی',
            isAvailable: true,
          },
          {
            id: 3,
            name: 'ماهی',
            description: null,
            price: 900_000,
            imageUrl: null,
            section: 'غذاهای اصلی',
            isAvailable: false,
          },
        ],
      }),
    );
    render(<BusinessDetail id={30} />);

    expect(await screen.findByTestId('business-menu')).toBeInTheDocument();
    expect(screen.getByTestId('menu-group-غذاهای اصلی')).toHaveTextContent('قیمه');
    expect(screen.getByTestId('menu-group-غذاهای اصلی')).toHaveTextContent('ماهی');
    expect(screen.getByTestId('menu-group-نوشیدنی')).toHaveTextContent('دوغ');
    expect(screen.getByTestId('menu-product-1')).toHaveTextContent('۳۲۰٬۰۰۰ ریال');
    expect(screen.getByTestId('menu-product-2')).toHaveTextContent('توافقی');
    expect(screen.getByTestId('menu-product-3')).toHaveTextContent('ناموجود');
    const img = screen.getByTestId('menu-product-2').querySelector('img');
    expect(img).toHaveAttribute('src', '/api/v1/files/media/dogh.thumb.webp');
  });

  it('shows a login link for guests and does not load or submit a private review', async () => {
    mockDetail.mockResolvedValue(detail());
    render(<BusinessDetail id={30} />);

    expect(await screen.findByTestId('business-reviews')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ورود و ثبت نظر' })).toHaveAttribute(
      'href',
      '/login?next=/business/30',
    );
    expect(mockGetMyReview).not.toHaveBeenCalled();
    expect(mockSaveReview).not.toHaveBeenCalled();
  });

  it('lets a signed-in user choose stars, write a review, and updates the summary', async () => {
    mockTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockDetail.mockResolvedValue(detail());
    mockGetMyReview.mockResolvedValue(null);
    mockSaveReview.mockResolvedValue({
      review: {
        id: 9,
        rating: 5,
        body: 'تجربه عالی بود',
        updatedAt: '2026-10-24T00:00:00.000Z',
        userName: 'مریم',
      },
      rating: 4.3,
      ratingCount: 9,
    });
    render(<BusinessDetail id={30} />);

    expect(await screen.findByTestId('business-reviews')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '۵ ستاره' }));
    fireEvent.change(screen.getByLabelText(/متن نظر/), { target: { value: 'تجربه عالی بود' } });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نظر' }));

    await waitFor(() => expect(mockSaveReview).toHaveBeenCalledWith(30, { rating: 5, body: 'تجربه عالی بود' }));
    expect(await screen.findByRole('status')).toHaveTextContent('نظر شما ثبت شد');
    expect(screen.getByText('مریم')).toBeInTheDocument();
    expect(screen.getByTestId('business-reviews').querySelector('.business-review-item__body'))
      .toHaveTextContent('تجربه عالی بود');
    expect(screen.getAllByText(/4\.3 از 5/)).toHaveLength(2);
  });

  it("prefills the current user's review so the same review can be edited", async () => {
    mockTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockDetail.mockResolvedValue(detail());
    mockGetMyReview.mockResolvedValue({
      id: 8,
      rating: 3,
      body: 'قابل قبول',
      updatedAt: '2026-10-22T00:00:00.000Z',
      userName: 'کاربر شهرجو',
    });
    render(<BusinessDetail id={30} />);

    const textarea = await screen.findByLabelText(/متن نظر/);
    await waitFor(() => expect(textarea).toHaveValue('قابل قبول'));
    expect(screen.getByRole('button', { name: 'به‌روزرسانی نظر' })).toBeInTheDocument();
  });

  it('hides the menu block entirely when no products are registered', async () => {
    mockDetail.mockResolvedValue(detail());
    render(<BusinessDetail id={30} />);
    await screen.findByTestId('business-detail');
    expect(screen.queryByTestId('business-menu')).toBeNull();
  });
});
