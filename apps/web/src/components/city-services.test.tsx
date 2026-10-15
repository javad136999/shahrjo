import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@/lib/api';
import { CityServices } from '@/components/city-services';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  getTokens: jest.fn(),
  getServiceCategories: jest.fn(),
  getCityBusinesses: jest.fn(),
  createQuickBusiness: jest.fn(),
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

const pros = [
  {
    id: 501,
    name: 'کارگاه کابینت احمدی',
    slug: 'cab-ahmadi',
    logoUrl: null,
    address: 'خیابان اصلی',
    phone: '09121112233',
    rating: 4.7,
    ratingCount: 12,
    subscriptionTier: 'FREE',
    category: { name: 'کابینت‌ساز', slug: 'svc_cabinet_maker', icon: '🪚', color: null },
  },
];

describe('CityServices (دفتر خدمات شهر)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    m.getTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    m.getServiceCategories.mockResolvedValue(cats);
    m.getCityBusinesses.mockResolvedValue(pros);
    m.createQuickBusiness.mockResolvedValue({ id: 501, name: 'کابینت‌کار', slug: 'cab-1', status: 'APPROVED', subscriptionTier: 'FREE' });
  });

  it('offers the two compact tiles side by side (register on the right, find on the left)', () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);

    const tiles = screen.getByTestId('city-services').querySelectorAll('.service-tile');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveAttribute('data-testid', 'service-tile-register');
    expect(tiles[1]).toHaveAttribute('data-testid', 'service-tile-find');
    // RTL: the first tile in the DOM is the one on the right
    expect(tiles[0]).toHaveTextContent('شغلتو ثبت کن');
    expect(tiles[1]).toHaveTextContent('چه خدماتی در شهر شهر نمونه نیاز داری');
    // nothing is open until a tile is clicked
    expect(screen.queryByTestId('service-register')).not.toBeInTheDocument();
    expect(screen.queryByTestId('service-find')).not.toBeInTheDocument();
    expect(m.getServiceCategories).not.toHaveBeenCalled();
  });

  it('opens the compact registration form and lists only service categories', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-register'));

    expect(await screen.findByTestId('service-register')).toBeInTheDocument();
    const list = await screen.findByTestId('service-category');
    await waitFor(() => expect(m.getServiceCategories).toHaveBeenCalledTimes(1));
    expect((list as HTMLSelectElement).options.length).toBe(cats.length + 1);
    expect(list).toHaveTextContent('تعمیرکار کولر');
    expect(list).toHaveTextContent('کابینت‌ساز');
  });

  it('publishes a trade immediately and confirms without leaving the page', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-register'));
    await screen.findByTestId('service-register');

    const submit = screen.getByTestId('service-submit');
    expect(submit).toBeDisabled(); // nothing filled in yet

    fireEvent.change(screen.getByTestId('service-name'), { target: { value: 'کابینت‌کار' } });
    fireEvent.change(screen.getByTestId('service-category'), { target: { value: '91' } });
    fireEvent.change(screen.getByTestId('service-phone'), { target: { value: '09121112233' } });
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    await waitFor(() =>
      expect(m.createQuickBusiness).toHaveBeenCalledWith({
        name: 'کابینت‌کار',
        categoryId: 91,
        phone: '09121112233',
        description: undefined,
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('همین حالا');
    expect(replace).not.toHaveBeenCalled(); // publishing stays on the page
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
    expect(m.createQuickBusiness).not.toHaveBeenCalled();
  });

  it('surfaces an API failure inline', async () => {
    m.createQuickBusiness.mockRejectedValue(new api.ApiError(429, 'سقف ثبت در روز پر شده است'));
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-register'));
    await screen.findByTestId('service-register');

    fireEvent.change(screen.getByTestId('service-name'), { target: { value: 'کابینت‌کار' } });
    fireEvent.change(screen.getByTestId('service-category'), { target: { value: '91' } });
    fireEvent.change(screen.getByTestId('service-phone'), { target: { value: '09121112233' } });
    fireEvent.click(screen.getByTestId('service-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('سقف ثبت در روز پر شده است');
  });

  it('lists the tradespeople of the picked service with a one-tap call button', async () => {
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');

    fireEvent.click(await screen.findByTestId('service-chip-svc_cabinet_maker'));

    await waitFor(() => expect(m.getCityBusinesses).toHaveBeenCalledWith('sample-city', 50, 'svc_cabinet_maker'));

    const row = await screen.findByTestId('service-result-501');
    expect(row).toHaveTextContent('کارگاه کابینت احمدی');
    expect(row).toHaveTextContent('کابینت‌ساز');
    const call = row.querySelector('a[href^="tel:"]');
    expect(call).toHaveAttribute('href', 'tel:09121112233');
  });

  it('says so when nobody registered the picked service yet', async () => {
    m.getCityBusinesses.mockResolvedValue([]);
    render(<CityServices cityName="شهر نمونه" citySlug="sample-city" />);
    fireEvent.click(screen.getByTestId('service-tile-find'));
    await screen.findByTestId('service-find');
    fireEvent.click(await screen.findByTestId('service-chip-svc_ac_repair'));

    expect(await screen.findByTestId('service-results')).toHaveTextContent('هنوز کسی این خدمت را در شهر ثبت نکرده است');
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
