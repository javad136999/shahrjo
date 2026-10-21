import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockGetLocalCity = jest.fn();
const mockGetCities = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  CITY_CHANGED_EVENT: 'shahrjo:city-changed',
  getLocalCity: () => mockGetLocalCity(),
  getTokens: () => null,
  setLocalCity: jest.fn(),
  api: { get: () => mockGetCities(), patch: jest.fn() },
}));

import { HeaderPills } from '@/components/header-pills';

describe('HeaderPills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocalCity.mockReturnValue({ id: 5, slug: 'sample-city', name: 'شهر نمونه' });
    mockGetCities.mockResolvedValue([]);
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

  it('links the tourism button to the remembered city tourism page', async () => {
    render(<HeaderPills />);
    const tourism = await screen.findByTestId('header-news-pill');
    expect(tourism).toHaveAttribute('href', '/city/sample-city/tourism');
    expect(tourism).toHaveTextContent('گردشگری');
  });

  it('sends the tourism button to the city picker when no city is remembered', async () => {
    mockGetLocalCity.mockReturnValue(null);
    render(<HeaderPills />);
    expect(await screen.findByTestId('header-news-pill')).toHaveAttribute('href', '/');
  });

  it('no longer offers the ad submission entry — it lives in the city wall now', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-news-pill');
    expect(screen.queryByTestId('header-submit-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ثبت آگهی/ })).not.toBeInTheDocument();
  });

  it('keeps the tourism link on the remembered city after another part stores a new one', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-city-pill');
    expect(screen.getByTestId('header-news-pill')).toHaveAttribute('href', '/city/sample-city/tourism');

    mockGetLocalCity.mockReturnValue({ id: 7, slug: 'new-city', name: 'شهر جدید' });
    window.dispatchEvent(new CustomEvent('shahrjo:city-changed'));

    expect(await screen.findByTestId('header-news-pill')).toHaveAttribute('href', '/city/new-city/tourism');
    // the pill label never changes — it is «انتخاب شهر», not a readout
    expect(screen.getByTestId('header-city-pill')).toHaveTextContent('انتخاب شهر');
  });

  it('keeps the header to tourism + city (no subscription, no submit pill)', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-news-pill');
    expect(screen.getByTestId('header-city-pill')).toBeInTheDocument();
    // اشتراک was removed from the header — plans stay reachable via ویترین
    expect(screen.queryByTestId('header-plans-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /اشتراک/ })).not.toBeInTheDocument();
    // «ثبت آگهی» moved to the wall composer (Phase 10)
    expect(screen.queryByTestId('header-submit-pill')).not.toBeInTheDocument();
  });
});
