import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
const mockGetTokens = jest.fn();
const mockGetProfile = jest.fn();
const mockGetBusinessCategories = jest.fn();
const mockGetPlans = jest.fn();
const mockApiGet = jest.fn();
const mockCreateBusiness = jest.fn();
const mockCheckoutPlan = jest.fn();
const mockRedirectTo = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error { status = 500; },
  getTokens: () => mockGetTokens(),
  getProfile: () => mockGetProfile(),
  getBusinessCategories: () => mockGetBusinessCategories(),
  getPlans: () => mockGetPlans(),
  createBusiness: (...args: unknown[]) => mockCreateBusiness(...args),
  checkoutPlan: (...args: unknown[]) => mockCheckoutPlan(...args),
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));
jest.mock('@/lib/navigation', () => ({ redirectTo: (...args: unknown[]) => mockRedirectTo(...args) }));
jest.mock('@/components/business-location-picker', () => ({
  BusinessLocationPicker: ({ onChange }: { onChange: (point: { latitude: number; longitude: number }) => void }) => (
    <button type="button" data-testid="choose-business-point" onClick={() => onChange({ latitude: 27.83, longitude: 52.32 })}>
      انتخاب نقطه
    </button>
  ),
}));

import { BusinessRegistrationForm } from '@/components/business-registration-form';

describe('BusinessRegistrationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTokens.mockReturnValue({ accessToken: 'available' });
    mockGetProfile.mockResolvedValue({ id: 7, cityId: 5, phone: '09120000000' });
    mockGetBusinessCategories.mockResolvedValue([
      { id: 2, name: 'کافه', slug: 'cafe', icon: '☕', color: null },
    ]);
    mockGetPlans.mockResolvedValue([
      { id: 21, code: 'SILVER_30', tier: 'SILVER', label: 'ماهانه', badge: null, durationDays: 30, price: 100000, sortOrder: 1 },
      { id: 22, code: 'GOLD_30', tier: 'GOLD', label: 'ماهانه', badge: 'ویژه', durationDays: 30, price: 200000, sortOrder: 2 },
    ]);
    mockApiGet.mockResolvedValue([
      { id: 5, name: 'شهر نمونه', slug: 'sample-city', latitude: 27.83, longitude: 52.32 },
    ]);
    mockCreateBusiness.mockResolvedValue({ id: 90, name: 'کافه دریا' });
    mockCheckoutPlan.mockResolvedValue({ payUrl: 'https://gateway.example/pay' });
  });

  it('requires a map point and plan, creates the business, and starts ZarinPal checkout', async () => {
    render(<BusinessRegistrationForm />);
    await screen.findByText(/شهر انتخاب‌شده:/);
    expect(screen.getByRole('link', { name: 'بازگشت' })).toHaveAttribute('href', '/city/sample-city');

    fireEvent.change(screen.getByPlaceholderText('مثلاً کافهٔ ساحلی'), { target: { value: 'کافه دریا' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('choose-business-point'));
    fireEvent.click(screen.getByRole('radio', { name: /طلایی/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ثبت کسب‌وکار و پرداخت' }));

    await waitFor(() => {
      expect(mockCreateBusiness).toHaveBeenCalledWith(expect.objectContaining({
        categoryId: 2,
        name: 'کافه دریا',
        latitude: 27.83,
        longitude: 52.32,
      }));
      expect(mockCheckoutPlan).toHaveBeenCalledWith({ planId: 22, businessId: 90 });
      expect(mockRedirectTo).toHaveBeenCalledWith('https://gateway.example/pay');
    });
  });
});
