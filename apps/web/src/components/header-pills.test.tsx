import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockGetLocalCity = jest.fn();
const mockGetCities = jest.fn();
const mockGetTokens = jest.fn();
const mockGetSiteVisitStats = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  CITY_CHANGED_EVENT: 'shahrjo:city-changed',
  getLocalCity: () => mockGetLocalCity(),
  getTokens: () => mockGetTokens(),
  getSiteVisitStats: () => mockGetSiteVisitStats(),
  setLocalCity: jest.fn(),
  api: { get: () => mockGetCities(), patch: jest.fn() },
}));

import { HeaderPills } from '@/components/header-pills';

describe('HeaderPills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocalCity.mockReturnValue({ id: 5, slug: 'sample-city', name: 'شهر نمونه' });
    mockGetCities.mockResolvedValue([]);
    mockGetTokens.mockReturnValue(null);
    mockGetSiteVisitStats.mockResolvedValue({
      daily: { total: 1, series: [] },
      monthly: { total: 2, series: [] },
      yearly: { total: 12345, series: [] },
    });
  });

  it('reads «انتخاب شهر» and opens the picker in place (no page jump)', async () => {
    render(<HeaderPills />);
    const pill = await screen.findByTestId('header-city-pill');
    // The pill is a fixed action, never a state readout — the header's first
    // slot (header-city.tsx) is where the current city is displayed.
    expect(pill).toHaveTextContent('انتخاب شهر');
    expect(pill).not.toHaveTextContent('شهر نمونه');
    // it is a toggle button now, not a link to the first-run screen
    expect(pill.tagName).toBe('BUTTON');
    expect(pill).not.toHaveAttribute('href');
    expect(pill).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(pill);
    expect(await screen.findByTestId('city-picker')).toBeInTheDocument();
    expect(pill).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByTestId('city-picker-close'));
    await waitFor(() => expect(screen.queryByTestId('city-picker')).toBeNull());
  });

  it('asks for a city selection when none is remembered', async () => {
    mockGetLocalCity.mockReturnValue(null);
    render(<HeaderPills />);
    const pill = await screen.findByTestId('header-city-pill');
    expect(pill.tagName).toBe('BUTTON');
    expect(pill).toHaveTextContent('انتخاب شهر');
  });

  it('shows the current-year whole-site visit count to a signed-in user', async () => {
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    render(<HeaderPills />);
    const visits = await screen.findByTestId('header-annual-visits');
    expect(visits).toHaveAttribute('href', '/profile');
    expect(visits).toHaveAttribute('aria-label', 'بازدید سایت امسال: ۱۲٬۳۴۵');
    expect(visits).toHaveTextContent('۱۲٬۳۴۵');
    expect(visits).toHaveTextContent('بازدید از سایت');
  });

  it('links the business signup button to the registration page', async () => {
    render(<HeaderPills />);
    const signup = await screen.findByTestId('header-register-business-pill');
    expect(signup).toHaveAttribute('href', '/business/new');
    expect(signup).toHaveTextContent('ثبت کسب‌وکار');
  });

  it('keeps the header uncluttered so the single install prompt is handled by the dismissible banner', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-city-pill');
    expect(screen.queryByTestId('header-install-pill')).not.toBeInTheDocument();
  });

  it('keeps the business signup link available without a remembered city', async () => {
    render(<HeaderPills />);
    expect(await screen.findByTestId('header-register-business-pill')).toHaveAttribute('href', '/business/new');
  });

  it('shows business signup and does not offer the old ad submission entry', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-register-business-pill');
    expect(screen.queryByTestId('header-submit-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ثبت آگهی/ })).not.toBeInTheDocument();
  });

  it('keeps the business signup link stable after a city change', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-city-pill');
    expect(screen.getByTestId('header-register-business-pill')).toHaveAttribute('href', '/business/new');

    mockGetLocalCity.mockReturnValue({ id: 7, slug: 'new-city', name: 'شهر جدید' });
    window.dispatchEvent(new CustomEvent('shahrjo:city-changed'));

    expect(await screen.findByTestId('header-register-business-pill')).toHaveAttribute('href', '/business/new');
    // the pill label never changes — it is «انتخاب شهر», not a readout
    expect(screen.getByTestId('header-city-pill')).toHaveTextContent('انتخاب شهر');
  });

  it('keeps the header to business signup + city (no subscription, no submit pill)', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-register-business-pill');
    expect(screen.getByTestId('header-city-pill')).toBeInTheDocument();
    // اشتراک was removed from the header — plans stay reachable via ویترین
    expect(screen.queryByTestId('header-plans-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /اشتراک/ })).not.toBeInTheDocument();
    // «ثبت آگهی» moved to the wall composer (Phase 10)
    expect(screen.queryByTestId('header-submit-pill')).not.toBeInTheDocument();
  });
});
