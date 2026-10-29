import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@/lib/api';
import { CityServices } from '@/components/city-services';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  getTokens: jest.fn(),
  getServiceCategories: jest.fn(),
  getCityServiceListings: jest.fn(),
  getCityServiceListingCount: jest.fn(),
  getCityServiceCategoryCounts: jest.fn(),
  createServiceListing: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = api as unknown as Record<string, jest.Mock>;

const cats = [
  { id: 90, name: 'تعمیرکار کولر', slug: 'svc_ac_repair', icon: '❄️' },
  { id: 91, name: 'کابینت‌ساز', slug: 'svc_cabinet_maker', icon: '🪚' },
];

const listings = [
  {
    id: 501,
    name: 'کابینت‌کار احمدی',
    phone: '09121112233',
    description: 'ساخت و تعمیر کابینت آشپزخانه',
    category: { name: 'کابینت‌ساز', slug: 'svc_cabinet_maker', icon: '🪚' },
  },
];

describe('CityServices (دفتر خدمات شهر)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    m.getTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    m.getServiceCategories.mockResolvedValue(cats);
    m.getCityServiceListings.mockResolvedValue(listings);
    m.getCityServiceListingCount.mockResolvedValue(123);
    m.getCityServiceCategoryCounts.mockResolvedValue({ svc_ac_repair: 2, svc_cabinet_maker: 0 });
    m.createServiceListing.mockResolvedValue({ id: 501, name: 'کابینت‌کار', phone: '09121112233' });
  });

  it('offers the two service actions and stays closed until a tile is clicked', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    await screen.findByTestId('service-listing-count');

    const tiles = screen.getByTestId('city-services').querySelectorAll('.service-tile');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveAttribute('data-testid', 'service-tile-register');
    expect(tiles[1]).toHaveAttribute('data-testid', 'service-tile-find');
    expect(tiles[0]).toHaveTextContent('شغلتو ثبت کن');
    expect(tiles[1]).toHaveTextContent('چه خدماتی در شهر شهر نمونه نیاز داری');
    expect(screen.queryByTestId('service-register')).not.toBeInTheDocument();
    expect(screen.queryByTestId('service-find')).not.toBeInTheDocument();
    expect(m.getServiceCategories).not.toHaveBeenCalled();
  });

  it('shows the city-wide registered service count in a red count badge', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    const badge = await screen.findByTestId('service-listing-count');
    expect(badge).toHaveTextContent('۱۲۳ شغل ثبت‌شده');
    expect(badge).toHaveAttribute('aria-label', '۱۲۳ شغل ثبت‌شده');
    expect(m.getCityServiceListingCount).toHaveBeenCalledWith('sample-city');
  });

  it('shows a registered-listing count beside every service category', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    expect(await screen.findByTestId('service-category-count-svc_ac_repair')).toHaveTextContent('۲');
    expect(screen.getByTestId('service-chip-svc_ac_repair')).toHaveTextContent('تعمیرکار کولر۲');
    expect(screen.getByTestId('service-category-count-svc_cabinet_maker')).toHaveTextContent('۰');
  });

  it('opens the registration form and lists only service categories', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-register'));

    expect(await screen.findByTestId('service-register')).toBeInTheDocument();
    const list = await screen.findByTestId('service-category');
    await waitFor(() => expect(m.getServiceCategories).toHaveBeenCalledTimes(1));
    expect((list as HTMLSelectElement).options.length).toBe(cats.length + 1);
    expect(list).toHaveTextContent('تعمیرکار کولر');
    expect(list).toHaveTextContent('کابینت‌ساز');
    expect(screen.getByTestId('service-register')).toHaveTextContent('پروفایل کسب‌وکار، منو یا محصولی ساخته نمی‌شود');
  });

  it('creates a separate service listing, not a business profile', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-register'));
    await screen.findByTestId('service-register');

    const submit = screen.getByTestId('service-submit');
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId('service-name'), { target: { value: 'کابینت‌کار' } });
    fireEvent.change(screen.getByTestId('service-category'), { target: { value: '91' } });
    fireEvent.change(screen.getByTestId('service-phone'), { target: { value: '09121112233' } });
    fireEvent.change(screen.getByLabelText('خدماتی که ارائه می‌کنی — اختیاری'), {
      target: { value: 'ساخت و تعمیر کابینت آشپزخانه' },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(m.createServiceListing).toHaveBeenCalledWith({
        citySlug: 'sample-city',
        name: 'کابینت‌کار',
        categoryId: 91,
        phone: '09121112233',
        description: 'ساخت و تعمیر کابینت آشپزخانه',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('صفحهٔ کسب‌وکار یا منو ساخته نشد');
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a logged-out visitor to login instead of publishing', async () => {
    m.getTokens.mockReturnValue(null);
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-register'));
    await screen.findByTestId('service-register');
    fireEvent.change(screen.getByTestId('service-name'), { target: { value: 'کابینت‌کار' } });
    fireEvent.change(screen.getByTestId('service-category'), { target: { value: '91' } });
    fireEvent.change(screen.getByTestId('service-phone'), { target: { value: '09121112233' } });
    fireEvent.click(screen.getByTestId('service-submit'));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=/'));
    expect(m.createServiceListing).not.toHaveBeenCalled();
  });

  it('surfaces a service-listing API failure inline', async () => {
    m.createServiceListing.mockRejectedValue(new api.ApiError(400, 'ثبت ناموفق بود'));
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-register'));
    await screen.findByTestId('service-register');
    fireEvent.change(screen.getByTestId('service-name'), { target: { value: 'کابینت‌کار' } });
    fireEvent.change(screen.getByTestId('service-category'), { target: { value: '91' } });
    fireEvent.change(screen.getByTestId('service-phone'), { target: { value: '09121112233' } });
    fireEvent.click(screen.getByTestId('service-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('ثبت ناموفق بود');
  });

  it('lists registered service entries in a table with direct phone calls', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    fireEvent.click(await screen.findByTestId('service-chip-svc_cabinet_maker'));

    await waitFor(() => expect(m.getCityServiceListings).toHaveBeenCalledWith('sample-city', 200, 'svc_cabinet_maker'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'شماره تماس' })).toBeInTheDocument();
    const row = await screen.findByTestId('service-result-501');
    expect(row).toHaveTextContent('کابینت‌کار احمدی');
    expect(row).toHaveTextContent('ساخت و تعمیر کابینت آشپزخانه');
    expect(row).toHaveTextContent('کابینت‌ساز');
    expect(row.querySelector('a[href^="tel:"]')).toHaveAttribute('href', 'tel:09121112233');
    expect(row.querySelector('a[href^="/business/"]')).toBeNull();
  });

  it('provides an explicit search button for the service finder', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    fireEvent.change(await screen.findByTestId('service-search-input'), { target: { value: 'کابینت' } });
    expect(screen.getByTestId('service-search-button')).toBeEnabled();
    fireEvent.click(screen.getByTestId('service-search-button'));

    await waitFor(() => expect(m.getCityServiceListings).toHaveBeenCalledWith('sample-city', 200, undefined, 'کابینت'));
    expect(await screen.findByTestId('service-result-501')).toBeInTheDocument();
  });

  it('supports Persian search text, Arabic letter variants, and Enter', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    const input = await screen.findByTestId('service-search-input');
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.change(input, { target: { value: 'كابینت ساز' } });
    expect(screen.getByTestId('service-chip-svc_cabinet_maker')).toBeInTheDocument();
    expect(screen.getByTestId('service-chip-svc_ac_repair')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(m.getCityServiceListings).toHaveBeenCalledWith('sample-city', 200, undefined, 'كابینت ساز'));
  });

  it('submits a selected star rating and updates the displayed average', async () => {
    m.rateServiceListing = jest.fn().mockResolvedValue({ rating: 4, ratingCount: 2, userRating: 5 });
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    fireEvent.click(await screen.findByTestId('service-chip-svc_cabinet_maker'));
    const stars = await screen.findByTestId('service-rating-501');
    fireEvent.click(screen.getByRole('button', { name: '۵ از ۵ ستاره' }));
    await waitFor(() => expect(m.rateServiceListing).toHaveBeenCalledWith(501, 5));
    expect(screen.getByTestId('service-result-501')).toHaveTextContent('۴ از ۵ · ۲ رأی');
  });
  it('shows the exact empty state and lets a visitor register that service', async () => {
    m.getCityServiceListings.mockResolvedValue([]);
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    fireEvent.click(await screen.findByTestId('service-chip-svc_ac_repair'));

    expect(await screen.findByTestId('service-results-empty')).toHaveTextContent('شغلی ثبت نشده است');
    fireEvent.click(screen.getByTestId('service-empty-register'));
    expect(await screen.findByTestId('service-register')).toBeInTheDocument();
    expect(screen.getByTestId('service-category')).toHaveValue('90');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the results dialog when the dimmed background is clicked', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    fireEvent.click(await screen.findByTestId('service-chip-svc_cabinet_maker'));
    await screen.findByTestId('service-result-501');
    fireEvent.click(screen.getByTestId('service-results-overlay'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('service-find')).toBeInTheDocument();
  });

  it('closes the results dialog with Escape', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    fireEvent.click(await screen.findByTestId('service-chip-svc_cabinet_maker'));
    await screen.findByTestId('service-results-dialog');
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes a panel when its tile is clicked again', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    const tile = screen.getByTestId('service-tile-register');
    fireEvent.click(tile);
    await screen.findByTestId('service-register');
    expect(tile).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(tile);
    await waitFor(() => expect(screen.queryByTestId('service-register')).not.toBeInTheDocument());
    expect(tile).toHaveAttribute('aria-expanded', 'false');
  });
});
