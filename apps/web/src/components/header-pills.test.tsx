import { render, screen } from '@testing-library/react';

const mockGetLocalCity = jest.fn();

jest.mock('@/lib/api', () => ({
  getLocalCity: () => mockGetLocalCity(),
}));

import { HeaderPills } from '@/components/header-pills';

describe('HeaderPills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocalCity.mockReturnValue({ id: 5, slug: 'sample-city', name: 'شهر نمونه' });
  });

  it('shows the remembered city name; clicking it opens the city picker', async () => {
    render(<HeaderPills />);
    const pill = await screen.findByTestId('header-city-pill');
    expect(pill).toHaveAttribute('href', '/');
    expect(pill).toHaveTextContent('شهر نمونه');
  });

  it('asks for a city selection when none is remembered', async () => {
    mockGetLocalCity.mockReturnValue(null);
    render(<HeaderPills />);
    const pill = await screen.findByTestId('header-city-pill');
    expect(pill).toHaveAttribute('href', '/');
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

  it('always offers the ad submission entry', async () => {
    render(<HeaderPills />);
    expect(await screen.findByTestId('header-submit-pill')).toHaveAttribute('href', '/ads/new');
    expect(screen.getByTestId('header-submit-pill')).toHaveTextContent('ثبت آگهی');
  });

  it('keeps the header to news + city + submit (no subscription pill)', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-news-pill');
    expect(screen.getByTestId('header-city-pill')).toBeInTheDocument();
    expect(screen.getByTestId('header-submit-pill')).toBeInTheDocument();
    // اشتراک was removed from the header — plans stay reachable via ویترین
    expect(screen.queryByTestId('header-plans-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /اشتراک/ })).not.toBeInTheDocument();
  });
});
