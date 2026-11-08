import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CityClassifieds } from '@/components/city-classifieds';

const mockGetAdCategories = jest.fn();
const mockGetCityAdNeighborhoods = jest.fn();
const mockGetCityAds = jest.fn();
const mockGetCityBusinesses = jest.fn();
const mockGetShowcase = jest.fn();
const mockGetTokens = jest.fn();
const mockGetProfile = jest.fn();
const mockDeleteAdminAd = jest.fn();

jest.mock('@/lib/api', () => ({
  getAdCategories: (...args: unknown[]) => mockGetAdCategories(...args),
  getCityAdNeighborhoods: (...args: unknown[]) => mockGetCityAdNeighborhoods(...args),
  getCityAds: (...args: unknown[]) => mockGetCityAds(...args),
  getCityBusinesses: (...args: unknown[]) => mockGetCityBusinesses(...args),
  getShowcase: (...args: unknown[]) => mockGetShowcase(...args),
  getTokens: () => mockGetTokens(),
  getProfile: () => mockGetProfile(),
  deleteAdminAd: (...args: unknown[]) => mockDeleteAdminAd(...args),
}));

const ad = (id: number, title: string) => ({
  id,
  title,
  price: id * 1_000_000,
  coverUrl: null,
  viewCount: 8,
  publishedAt: `2026-10-${String(id).padStart(2, '0')}`,
  neighborhood: 'مرکز شهر',
  category: { name: 'کالای دیجیتال', slug: 'digital', icon: '📱', color: '#2563eb' },
});

const promo = {
  id: 30,
  name: 'کافه محلی',
  slug: 'local-cafe',
  logoUrl: null,
  address: 'خیابان اصلی',
  rating: 4.8,
  ratingCount: 40,
  subscriptionTier: 'GOLD',
  category: { name: 'کافه و رستوران', slug: 'food', icon: '☕', color: '#a56d0b' },
};

const freeBusiness = { ...promo, id: 31, name: 'نانوایی محلی', subscriptionTier: 'FREE' };

describe('CityClassifieds (دیوار شهر)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdCategories.mockResolvedValue([]);
    mockGetCityAdNeighborhoods.mockResolvedValue([]);
    mockGetCityAds.mockResolvedValue([ad(1, 'دوچرخه شهری'), ad(2, 'گوشی سالم')]);
    mockGetCityBusinesses.mockResolvedValue([freeBusiness]);
    mockGetShowcase.mockResolvedValue([promo]);
    mockGetTokens.mockReturnValue(null);
    mockGetProfile.mockResolvedValue({ roles: ['USER'] });
    mockDeleteAdminAd.mockResolvedValue({ id: 1, status: 'DELETED', removedFiles: 1 });
  });

  it('lists the city ads as vertical rows and keeps ad posting at the bottom action', async () => {
    render(<CityClassifieds city={{ id: 1, slug: 'sample-city', name: 'شهر نمونه' }} />);

    expect(await screen.findByTestId('classified-card-1')).toHaveAttribute('href', '/ad/1');
    expect(screen.getByTestId('classified-card-2')).toHaveAttribute('href', '/ad/2');
    expect(screen.getByTestId('classifieds-grid').children).toHaveLength(3);
    expect(screen.getByTestId('daily-business-ad')).toHaveClass('classified-card');

    const postLink = screen.getByTestId('classifieds-new-ad');
    expect(postLink).toHaveAttribute('href', '/ads/new');
    expect(postLink).toHaveAttribute('aria-label', 'ثبت آگهی جدید در دیوار شهر');
    expect(postLink).toHaveTextContent('ثبت آگهی');
    expect(screen.queryByRole('link', { name: /^ثبت آگهی$/ })).not.toBeInTheDocument();
    const wall = screen.getByTestId('city-classifieds');
    expect(wall.children[0]).toHaveClass('classifieds__search');
    expect(wall.children[1]).toHaveClass('classifieds__category-panel');
    expect(screen.getByLabelText('جست‌وجو در آگهی‌ها')).toBeInTheDocument();
    expect(screen.getByLabelText('دسته‌بندی آگهی‌ها')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /دیوار شهر|آگهی‌های محلی/ })).not.toBeInTheDocument();
  });

  it('shows one compact sponsored business from this city on the daily wall', async () => {
    render(<CityClassifieds city={{ id: 1, slug: 'sample-city', name: 'شهر نمونه' }} />);

    const dailyPromo = await screen.findByTestId('classifieds-daily-promo');
    await waitFor(() => expect(mockGetShowcase).toHaveBeenCalledWith('sample-city', 100));
    expect(dailyPromo).toHaveAttribute('href', '/business/30');
    expect(dailyPromo).toHaveTextContent('تبلیغ امروز');
    expect(dailyPromo).toHaveTextContent('کافه محلی');
    expect(dailyPromo).toHaveTextContent('کافه و رستوران');
  });

  it('hides the sponsored slot when no eligible local business is available', async () => {
    mockGetCityBusinesses.mockResolvedValue([]);
    mockGetShowcase.mockResolvedValue([]);
    render(<CityClassifieds city={{ id: 1, slug: 'sample-city', name: 'شهر نمونه' }} />);

    await screen.findByTestId('classified-card-1');
    expect(screen.queryByTestId('classifieds-daily-promo')).not.toBeInTheDocument();
  });

  it('can choose any approved business in the city directory, not only a GOLD showcase item', async () => {
    mockGetCityBusinesses.mockResolvedValue([freeBusiness]);
    mockGetShowcase.mockResolvedValue([{ ...promo, subscriptionTier: 'SILVER' }]);
    render(<CityClassifieds city={{ id: 1, slug: 'sample-city', name: 'شهر نمونه' }} />);

    const dailyBusinessAd = await screen.findByTestId('daily-business-ad');
    expect(dailyBusinessAd).toHaveAttribute('href', '/business/31');
    expect(dailyBusinessAd).toHaveClass('classified-card');
    expect(dailyBusinessAd).toHaveTextContent('نانوایی محلی');
    expect(dailyBusinessAd).not.toHaveTextContent('تبلیغ امروز');
    expect(screen.queryByTestId('classifieds-daily-promo')).not.toBeInTheDocument();
  });

  it('shows a delete button beside each ad for managers and refreshes after confirmed deletion', async () => {
    mockGetTokens.mockReturnValue({ accessToken: 'admin-token', refreshToken: 'refresh-token' });
    mockGetProfile.mockResolvedValue({ roles: ['CITY_ADMIN'] });
    mockGetCityAds.mockResolvedValueOnce([ad(1, 'دوچرخه شهری')]).mockResolvedValueOnce([]);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CityClassifieds city={{ id: 1, slug: 'sample-city', name: 'شهر نمونه' }} />);

    const deleteButton = await screen.findByTestId('admin-delete-ad-1');
    expect(screen.getByTestId('classified-row-1')).toContainElement(deleteButton);
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('آگهی «دوچرخه شهری» حذف شود؟'));
    await waitFor(() => expect(mockDeleteAdminAd).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByTestId('admin-delete-ad-1')).not.toBeInTheDocument());
  });

  it('does not show the inline delete button to regular users', async () => {
    mockGetTokens.mockReturnValue({ accessToken: 'user-token', refreshToken: 'refresh-token' });
    mockGetProfile.mockResolvedValue({ roles: ['USER'] });
    render(<CityClassifieds city={{ id: 1, slug: 'sample-city', name: 'شهر نمونه' }} />);

    await screen.findByTestId('classified-card-1');
    expect(screen.queryByTestId('admin-delete-ad-1')).not.toBeInTheDocument();
  });
});
