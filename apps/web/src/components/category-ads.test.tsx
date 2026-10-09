import { render, screen } from '@testing-library/react';
import { CategoryAds } from '@/components/category-ads';

const mockCats = jest.fn();
const mockAds = jest.fn();
const mockCity = jest.fn();

jest.mock('@/lib/api', () => ({
  getAdCategories: (...args: unknown[]) => mockCats(...args),
  getCityAds: (...args: unknown[]) => mockAds(...args),
  getLocalCity: () => mockCity(),
}));

const CATS = [
  { id: 1, name: 'املاک', slug: 'real-estate', icon: '🏠', color: '#16a34a' },
  { id: 2, name: 'وسایل نقلیه', slug: 'car', icon: '🚗', color: '#2563eb' },
  { id: 3, name: 'موبایل', slug: 'mobile', icon: '📱', color: '#7c3aed' },
  { id: 4, name: 'لوازم خانه', slug: 'home-appliances', icon: '🛋️', color: '#ea580c' },
  { id: 5, name: 'استخدام', slug: 'jobs', icon: '💼', color: '#0891b2' },
  { id: 6, name: 'خدمات', slug: 'services', icon: '🛠️', color: '#ca8a04' },
];

describe('CategoryAds (میانبر دسته‌بندی چت روم)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows six shortcuts and the filtered ads of the chosen city', async () => {
    mockCity.mockReturnValue({ id: 1, slug: 'jam', name: 'جم' });
    mockCats.mockResolvedValue(CATS);
    mockAds.mockResolvedValue([
      {
        id: 9,
        title: 'آپارتمان دو خوابه',
        price: 1_000_000_000,
        coverUrl: null,
        viewCount: 3,
        publishedAt: null,
        category: { name: 'املاک', slug: 'real-estate', icon: '🏠', color: '#16a34a' },
      },
    ]);

    render(<CategoryAds category="real-estate" />);

    expect(await screen.findByTestId('category-ads')).toBeTruthy();
    expect(mockAds).toHaveBeenCalledWith('jam', 40, 'real-estate');
    expect(screen.getByTestId('catad-cat-real-estate')).toHaveAttribute('href', '/ads?category=real-estate');
    expect(screen.getByTestId('catad-cat-services')).toHaveAttribute('href', '/ads?category=services');
    expect(screen.getByTestId('catad-card-9')).toHaveAttribute('href', '/ad/9');
    expect(screen.getByText('آپارتمان دو خوابه')).toBeTruthy();
    expect(screen.getByTestId('catad-back')).toHaveAttribute('href', '/wall');
  });

  it('asks for a city when none is chosen', async () => {
    mockCity.mockReturnValue(null);
    render(<CategoryAds />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'انتخاب شهر' })).toHaveAttribute('href', '/');
    expect(mockAds).not.toHaveBeenCalled();
  });
});
