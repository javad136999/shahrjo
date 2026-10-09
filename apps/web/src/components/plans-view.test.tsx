import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
}));

const mockGetTokens = jest.fn();
const mockGetPlans = jest.fn();
const mockGetMySubscriptions = jest.fn();
const mockGetMyBusinesses = jest.fn();
const mockCheckoutPlan = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getTokens: () => mockGetTokens(),
  getPlans: () => mockGetPlans(),
  getMySubscriptions: () => mockGetMySubscriptions(),
  getMyBusinesses: () => mockGetMyBusinesses(),
  checkoutPlan: (body: unknown) => mockCheckoutPlan(body),
}));

const mockRedirectTo = jest.fn();

jest.mock('@/lib/navigation', () => ({
  redirectTo: (url: string) => mockRedirectTo(url),
}));

import { PlansView } from '@/components/plans-view';
import { ApiError } from '@/lib/api';

const plans = [
  { id: 1, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', badge: null, durationDays: 30, price: 4_000_000, sortOrder: 1 },
  { id: 2, code: 'SILVER_6M', tier: 'SILVER', label: '۶ ماهه', badge: 'پیشنهاد ویژه', durationDays: 180, price: 8_000_000, sortOrder: 5 },
];

describe('PlansView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, '', '/plans'); // no ?business= by default
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGetPlans.mockResolvedValue(plans);
    mockGetMySubscriptions.mockResolvedValue([]);
    mockGetMyBusinesses.mockResolvedValue([]);
  });

  it('renders every active plan with Persian-formatted price', async () => {
    render(<PlansView />);

    expect(await screen.findByTestId('plans-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('plan-card')).toHaveLength(2);
    expect(screen.getByTestId('plans-grid')).toHaveTextContent('۴٬۰۰۰٬۰۰۰ ریال');
    expect(screen.getByText('۶ ماهه')).toBeInTheDocument(); // 180 days rendered as months
    expect(screen.getByText('پیشنهاد ویژه')).toBeInTheDocument();
  });

  it('redirects to login when there is no session', async () => {
    mockGetTokens.mockReturnValue(null);
    mockGetMySubscriptions.mockResolvedValue([]);
    render(<PlansView />);

    fireEvent.click(await screen.findByTestId('buy-GOLD_1M'));
    expect(mockReplace).toHaveBeenCalledWith('/login?next=/plans');
    expect(mockCheckoutPlan).not.toHaveBeenCalled();
  });

  it('starts a checkout and hands the browser to the gateway', async () => {
    mockCheckoutPlan.mockResolvedValue({
      paymentId: 9,
      payUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A99',
      authority: 'A99',
      amount: 4_000_000,
    });
    render(<PlansView />);

    fireEvent.click(await screen.findByTestId('buy-GOLD_1M'));

    await waitFor(() => expect(mockCheckoutPlan).toHaveBeenCalledWith({ planId: 1 }));
    expect(mockRedirectTo).toHaveBeenCalledWith('https://sandbox.zarinpal.com/pg/StartPay/A99');
  });

  it('shows the API error when the gateway cannot be reached', async () => {
    mockCheckoutPlan.mockRejectedValue(
      new ApiError(502, 'درگاه پرداخت در دسترس نیست؛ کمی بعد دوباره تلاش کنید'),
    );
    render(<PlansView />);

    fireEvent.click(await screen.findByTestId('buy-GOLD_1M'));

    expect(await screen.findByRole('alert')).toHaveTextContent('درگاه پرداخت در دسترس نیست');
    expect(mockRedirectTo).not.toHaveBeenCalled();
    // button re-enabled for a retry
    expect(screen.getByTestId('buy-GOLD_1M')).toBeEnabled();
  });

  it('lists my subscriptions with their moderation status', async () => {
    mockGetMySubscriptions.mockResolvedValue([
      {
        id: 4,
        tier: 'GOLD',
        status: 'PENDING_REVIEW',
        startsAt: null,
        expiresAt: null,
        createdAt: '2026-10-05T10:00:00.000Z',
        plan: { code: 'GOLD_1M', label: '۱ ماهه', tier: 'GOLD' },
        business: { id: 3, name: 'کسب‌وکار نمونه' },
      },
    ]);
    render(<PlansView />);

    const row = await screen.findByTestId('my-subscription');
    expect(row).toHaveTextContent('در انتظار تأیید');
    expect(row).toHaveTextContent('کسب‌وکار نمونه');
  });

  it('loads plans even when the subscriptions call fails', async () => {
    mockGetMySubscriptions.mockRejectedValue(new Error('network'));
    render(<PlansView />);

    expect(await screen.findByTestId('plans-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('plan-card')).toHaveLength(2);
  });

  it('renders the feature comparison with prices taken from the DB rows', async () => {
    render(<PlansView />);

    const compare = screen.getByTestId('plans-compare');
    // wait until the table (not the loading line) is there
    await screen.findByText('شروع قیمت از');
    expect(compare).toHaveTextContent('بازنشانی روزانه در دیوار شهر');
    expect(compare).toHaveTextContent('۲ بار (صبح و عصر)');
    // cheapest real prices per tier from the fetched plans
    expect(compare).toHaveTextContent('۴٬۰۰۰٬۰۰۰ ریال'); // GOLD_1M
    expect(compare).toHaveTextContent('۸٬۰۰۰٬۰۰۰ ریال'); // SILVER_6M
    expect(compare).toHaveTextContent('در ویترین نیست');
  });

  it('attaches businessId to the checkout when arriving with ?business=', async () => {
    window.history.pushState({}, '', '/plans?business=9');
    mockGetMyBusinesses.mockResolvedValue([
      {
        id: 9,
        name: 'کافه آرامش',
        status: 'PENDING',
        createdAt: '2026-10-02T10:00:00.000Z',
        cityName: 'شهر نمونه',
        categoryName: 'کافه',
        categoryIcon: '☕',
      },
    ]);
    mockCheckoutPlan.mockResolvedValue({
      paymentId: 9,
      payUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A99',
      authority: 'A99',
      amount: 4_000_000,
    });
    render(<PlansView />);

    const banner = await screen.findByTestId('business-plan-target');
    expect(banner).toHaveTextContent('کافه آرامش');
    expect(banner).toHaveTextContent('در انتظار تأیید');

    fireEvent.click(screen.getByTestId('buy-GOLD_1M'));
    await waitFor(() =>
      expect(mockCheckoutPlan).toHaveBeenCalledWith({ planId: 1, businessId: 9 }),
    );
    expect(mockRedirectTo).toHaveBeenCalledWith('https://sandbox.zarinpal.com/pg/StartPay/A99');
  });

  it('falls back to a personal payment when the business id is not mine', async () => {
    window.history.pushState({}, '', '/plans?business=999');
    mockGetMyBusinesses.mockResolvedValue([]);
    mockCheckoutPlan.mockResolvedValue({
      paymentId: 10,
      payUrl: 'https://sandbox.zarinpal.com/pg/StartPay/B11',
      authority: 'B11',
      amount: 4_000_000,
    });
    render(<PlansView />);

    expect(await screen.findByTestId('business-plan-notice')).toHaveTextContent('یافت نشد');
    expect(screen.queryByTestId('business-plan-target')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('buy-GOLD_1M'));
    await waitFor(() => expect(mockCheckoutPlan).toHaveBeenCalledWith({ planId: 1 }));
  });

  it('keeps the business param through the login redirect', async () => {
    window.history.pushState({}, '', '/plans?business=9');
    mockGetTokens.mockReturnValue(null);
    mockGetMySubscriptions.mockResolvedValue([]);
    render(<PlansView />);

    fireEvent.click(await screen.findByTestId('buy-GOLD_1M'));
    expect(mockReplace).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent('/plans?business=9')}`,
    );
    expect(mockCheckoutPlan).not.toHaveBeenCalled();
  });
});
