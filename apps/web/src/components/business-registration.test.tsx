import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@/lib/api';
import { BusinessRegistration } from '@/components/business-registration';

// Leaflet touches window/DOM heavily — stub only what the picker uses.
jest.mock('leaflet', () => {
  const makeLayer = () => {
    const layer: Record<string, unknown> = {};
    layer.addTo = jest.fn(() => layer);
    layer.setLatLng = jest.fn(() => layer);
    layer.getBounds = jest.fn(() => ({ isValid: () => false }));
    return layer;
  };
  const mapInstance = { setView: jest.fn(), fitBounds: jest.fn(), remove: jest.fn(), on: jest.fn() };
  return {
    map: jest.fn(() => mapInstance),
    tileLayer: jest.fn(() => makeLayer()),
    geoJSON: jest.fn(() => makeLayer()),
    marker: jest.fn(() => makeLayer()),
  };
});

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  getTokens: jest.fn(),
  getBusinessCategories: jest.fn(),
  getPlans: jest.fn(),
  getCityMap: jest.fn(),
  getLocalCity: jest.fn(),
  getProfile: jest.fn(),
  api: { get: jest.fn() },
  createBusiness: jest.fn(),
  checkoutPlan: jest.fn(),
  verifyBazaarPurchase: jest.fn(),
  uploadBusinessImage: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

jest.mock('@/lib/bazaar', () => ({
  purchaseWithBazaar: jest.fn().mockResolvedValue('bazaar-token'),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = api as unknown as Record<string, jest.Mock>;

const cats = [{ id: 3, name: 'رستوران', slug: 'restaurants', icon: '🍽' }];
const plans = [
  { id: 10, code: 'SILVER_1M', tier: 'SILVER', label: 'نقره‌ای یک‌ماهه', badge: null, durationDays: 30, price: 200_000, sortOrder: 1 },
  { id: 11, code: 'GOLD_1M', tier: 'GOLD', label: 'طلایی یک‌ماهه', badge: 'ویژه', durationDays: 30, price: 500_000, sortOrder: 2 },
];

describe('BusinessRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.ShahrjoBazaar = { purchase: jest.fn().mockResolvedValue({ purchaseToken: 'bazaar-token' }) };
    m.getTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    m.getBusinessCategories.mockResolvedValue(cats);
    m.getPlans.mockResolvedValue(plans);
    m.getCityMap.mockResolvedValue({ city: { id: 1, name: 'شهر نمونه', slug: 'sample-city', latitude: 27.8, longitude: 52.3, boundary: null }, businesses: [] });
    m.getLocalCity.mockReturnValue({ id: 1, slug: 'sample-city', name: 'شهر نمونه' });
    // no profile city by default → the map falls back to the local city
    m.getProfile.mockResolvedValue({ cityId: null });
  });

  it('frames the map on the PROFILE city (the city the backend files under)', async () => {
    const apiExport = api as unknown as { api: { get: jest.Mock } };
    m.getProfile.mockResolvedValue({ cityId: 5 });
    apiExport.api.get.mockResolvedValue([
      { id: 5, slug: 'profile-city', name: 'شهر پروفایل' },
      { id: 1, slug: 'sample-city', name: 'شهر نمونه' },
    ]);
    render(<BusinessRegistration />);
    await waitFor(() => expect(m.getCityMap).toHaveBeenCalledWith('profile-city'));
    expect(m.getCityMap).not.toHaveBeenCalledWith('sample-city');
  });

  it('redirects logged-out visitors to login', async () => {
    m.getTokens.mockReturnValue(null);
    render(<BusinessRegistration />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=/business/new'));
  });

  it('opens the category list with the popular trades, then the rest', async () => {
    m.getBusinessCategories.mockResolvedValue([
      { id: 1, name: 'لوله‌کشی و تاسیسات', slug: 'plumbing', icon: '🚰' },
      { id: 2, name: 'فروشگاه', slug: 'shop', icon: '🛍️' },
      { id: 3, name: 'رستوران', slug: 'restaurant', icon: '🍽️' },
      { id: 4, name: 'کافه', slug: 'cafe', icon: '☕' },
      { id: 5, name: 'املاک', slug: 'real_estate', icon: '🏠' },
      { id: 6, name: 'اتوگالری و خرید و فروش خودرو', slug: 'car_dealer', icon: '🚗' },
      { id: 7, name: 'نانوایی و شیرینی', slug: 'bakery', icon: '🥖' },
      { id: 8, name: 'خدمات فنی', slug: 'technical', icon: '🧰' },
    ]);

    render(<BusinessRegistration />);
    const select = (await screen.findByLabelText(/دسته‌بندی/)) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(9));

    // کافه، رستوران، نانوایی، املاک، اتوگالری، فروشگاه — then the server order
    expect([...select.options].map((o) => o.value).slice(1)).toEqual([
      '4', // کافه
      '3', // رستوران
      '7', // نانوایی و شیرینی
      '5', // املاک
      '6', // اتوگالری و خرید و فروش خودرو
      '2', // فروشگاه
      '1', // لوله‌کشی و تاسیسات (server order)
      '8', // خدمات فنی (server order)
    ]);
  });

  it('gates the details step until name and category are chosen', async () => {
    render(<BusinessRegistration />);
    const next = await screen.findByRole('button', { name: /مرحله بعد: موقعیت/ });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/نام کسب‌وکار/), { target: { value: 'قهوه‌خانه' } });
    fireEvent.change(screen.getByLabelText(/دسته‌بندی/), { target: { value: '3' } });
    expect(next).toBeEnabled();
  });

  it('walks details → location → plan and opens Bazaar billing on confirm', async () => {
    m.createBusiness.mockResolvedValue({ id: 77, name: 'قهوه‌خانه', slug: 'biz-77', status: 'PENDING', subscriptionTier: 'FREE' });
    m.checkoutPlan.mockResolvedValue({ paymentId: 1, productId: 'GOLD_1M', packageName: 'ir.shahrju.app', developerPayload: 'shahrjo:payload-1', amount: 500_000 });
    m.verifyBazaarPurchase.mockResolvedValue('SUCCESS');

    render(<BusinessRegistration />);
    fireEvent.change(await screen.findByLabelText(/نام کسب‌وکار/), { target: { value: 'قهوه‌خانه' } });
    fireEvent.change(screen.getByLabelText(/دسته‌بندی/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /مرحله بعد: موقعیت/ }));

    // step 2: map picker shown
    await screen.findByTestId('biz-map');
    fireEvent.click(screen.getByRole('button', { name: /مرحله بعد: اشتراک/ }));

    // step 3: pick GOLD plan then confirm
    await screen.findByTestId('biz-plans');
    fireEvent.click(screen.getByTestId('biz-plan-11'));
    fireEvent.click(screen.getByRole('button', { name: /تأیید و پرداخت/ }));

    await waitFor(() =>
      expect(m.createBusiness).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'قهوه‌خانه', categoryId: 3 }),
      ),
    );
    await waitFor(() =>
      expect(m.checkoutPlan).toHaveBeenCalledWith({ planId: 11, businessId: 77 }),
    );
    await waitFor(() => expect(m.verifyBazaarPurchase).toHaveBeenCalledWith({ paymentId: 1, productId: 'GOLD_1M', purchaseToken: 'bazaar-token' }));
  });

  it('uploads the business photo (compressed route) and sends it with the registration', async () => {
    m.uploadBusinessImage.mockResolvedValue({
      id: 55,
      url: '/api/v1/files/media/2026/10/logo.webp',
    });
    m.createBusiness.mockResolvedValue({ id: 77, name: 'قهوه‌خانه', slug: 'biz-77', status: 'PENDING', subscriptionTier: 'FREE' });
    m.checkoutPlan.mockResolvedValue({ paymentId: 1, productId: 'GOLD_1M', packageName: 'ir.shahrju.app', developerPayload: 'shahrjo:payload-1', amount: 500_000 });
    m.verifyBazaarPurchase.mockResolvedValue('SUCCESS');

    render(<BusinessRegistration />);
    fireEvent.change(await screen.findByLabelText(/نام کسب‌وکار/), { target: { value: 'قهوه‌خانه' } });
    fireEvent.change(screen.getByLabelText(/دسته‌بندی/), { target: { value: '3' } });

    const file = new File(['x'], 'logo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('biz-logo-input'), { target: { files: [file] } });

    expect(await screen.findByTestId('biz-logo-preview')).toBeInTheDocument();
    expect(m.uploadBusinessImage).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getByRole('button', { name: /مرحله بعد: موقعیت/ }));
    await screen.findByTestId('biz-map');
    fireEvent.click(screen.getByRole('button', { name: /مرحله بعد: اشتراک/ }));
    await screen.findByTestId('biz-plans');
    fireEvent.click(screen.getByTestId('biz-plan-11'));
    fireEvent.click(screen.getByRole('button', { name: /تأیید و پرداخت/ }));

    await waitFor(() =>
      expect(m.createBusiness).toHaveBeenCalledWith(
        expect.objectContaining({ logoUrl: '/api/v1/files/media/2026/10/logo.webp' }),
      ),
    );
  });
});
