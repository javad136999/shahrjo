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

  it('shows the remembered city name and opens the picker in place (no page jump)', async () => {
    render(<HeaderPills />);
    const pill = await screen.findByTestId('header-city-pill');
    expect(pill).toHaveTextContent('شهر نمونه');
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

  it('links the news button to the remembered city news page', async () => {
    render(<HeaderPills />);
    const news = await screen.findByTestId('header-news-pill');
    expect(news).toHaveAttribute('href', '/city/sample-city/news');
    expect(news).toHaveTextContent('اخبار');
  });

  it('sends the news button to the city picker when no city is remembered', async () => {
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

  it('re-reads the city when another part of the page stores a new one', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-city-pill');
    expect(screen.getByTestId('header-city-pill')).toHaveTextContent('شهر نمونه');

    mockGetLocalCity.mockReturnValue({ id: 7, slug: 'new-city', name: 'شهر جدید' });
    window.dispatchEvent(new CustomEvent('shahrjo:city-changed'));

    expect(await screen.findByTestId('header-city-pill')).toHaveTextContent('شهر جدید');
    expect(screen.getByTestId('header-news-pill')).toHaveAttribute('href', '/city/new-city/news');
  });

  it('keeps the header to news + city (no subscription, no submit pill)', async () => {
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
