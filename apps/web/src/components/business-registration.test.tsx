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
  createBusiness: jest.fn(),
  checkoutPlan: jest.fn(),
  ApiError: class ApiError extends Error {},
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
    m.getTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    m.getBusinessCategories.mockResolvedValue(cats);
    m.getPlans.mockResolvedValue(plans);
    m.getCityMap.mockResolvedValue({ city: { id: 1, name: 'شهر نمونه', slug: 'sample-city', latitude: 27.8, longitude: 52.3, boundary: null }, businesses: [] });
    m.getLocalCity.mockReturnValue({ id: 1, slug: 'sample-city', name: 'شهر نمونه' });
  });

  it('redirects logged-out visitors to login', async () => {
    m.getTokens.mockReturnValue(null);
    render(<BusinessRegistration />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=/business/new'));
  });

  it('gates the details step until name and category are chosen', async () => {
    render(<BusinessRegistration />);
    const next = await screen.findByRole('button', { name: /مرحله بعد: موقعیت/ });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/نام کسب‌وکار/), { target: { value: 'قهوه‌خانه' } });
    fireEvent.change(screen.getByLabelText(/دسته‌بندی/), { target: { value: '3' } });
    expect(next).toBeEnabled();
  });

  it('walks details → location → plan and redirects to the gateway on confirm', async () => {
    m.createBusiness.mockResolvedValue({ id: 77, name: 'قهوه‌خانه', slug: 'biz-77', status: 'PENDING', subscriptionTier: 'FREE' });
    m.checkoutPlan.mockResolvedValue({ paymentId: 1, payUrl: 'https://gateway.pay/x', authority: 'A1', amount: 500_000 });

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
  });
});
