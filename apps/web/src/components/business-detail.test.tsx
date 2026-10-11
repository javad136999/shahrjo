import { render, screen } from '@testing-library/react';
import { BusinessDetail } from '@/components/business-detail';

const mockDetail = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
  },
  getBusinessDetail: (id: number) => mockDetail(id),
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
  ...overrides,
});

describe('BusinessDetail — منو و محصولات', () => {
  beforeEach(() => jest.clearAllMocks());

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
    // «توافقی» when the owner left the price empty
    expect(screen.getByTestId('menu-product-2')).toHaveTextContent('توافقی');
    // sold-out rows are flagged
    expect(screen.getByTestId('menu-product-3')).toHaveTextContent('ناموجود');
    // thumbnails never fetch the full-size file
    const img = screen.getByTestId('menu-product-2').querySelector('img');
    expect(img).toHaveAttribute('src', '/api/v1/files/media/dogh.thumb.webp');
  });

  it('hides the menu block entirely when no products are registered', async () => {
    mockDetail.mockResolvedValue(detail());
    render(<BusinessDetail id={30} />);
    await screen.findByTestId('business-detail');
    expect(screen.queryByTestId('business-menu')).toBeNull();
  });
});
