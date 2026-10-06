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

  it('always offers the subscription entry', async () => {
    render(<HeaderPills />);
    expect(await screen.findByTestId('header-plans-pill')).toHaveAttribute('href', '/plans');
    expect(screen.getByTestId('header-plans-pill')).toHaveTextContent('اشتراک');
  });
});
