import { render, screen } from '@testing-library/react';
import { CityNewsView } from '@/components/city-news';
import type { City, NewsItem } from '@/lib/types';

const city: City = {
  id: 1,
  name: 'شهر نمونه',
  slug: 'sample-city',
  isFeatured: false,
  latitude: null,
  longitude: null,
  province: { id: 1, name: 'استان نمونه', slug: 'sample-province' },
};

const news: NewsItem[] = [
  {
    id: 10,
    title: 'خبر نمونه',
    slug: 'sample-news',
    excerpt: 'خلاصه خبر',
    coverUrl: null,
    publishedAt: '2026-10-01T10:00:00.000Z',
    category: { name: 'حوادث', slug: 'accidents' },
  },
];

describe('CityNewsView', () => {
  it('titles the page with the city and links back to it', () => {
    render(<CityNewsView city={city} news={[]} loading={false} error={null} />);
    expect(screen.getByRole('heading', { level: 1, name: 'اخبار شهر شهر نمونه' })).toBeInTheDocument();
    expect(screen.getByTestId('news-back')).toHaveAttribute('href', '/city/sample-city');
  });

  it('renders news cards deep-linked to their detail pages', () => {
    render(<CityNewsView city={city} news={news} loading={false} error={null} />);
    const card = screen.getByTestId('news-10');
    expect(card).toHaveTextContent('خبر نمونه');
    expect(card).toHaveTextContent('حوادث');
    expect(screen.getByRole('link', { name: 'خبر نمونه' })).toHaveAttribute('href', '/news/sample-news');
  });

  it('shows an empty state when the city has no news', () => {
    render(<CityNewsView city={city} news={[]} loading={false} error={null} />);
    expect(screen.getByText('هنوز خبری برای این شهر منتشر نشده است.')).toBeInTheDocument();
  });

  it('shows a loading placeholder while fetching', () => {
    render(<CityNewsView city={city} news={[]} loading error={null} />);
    expect(screen.getByText('در حال بارگذاری…')).toBeInTheDocument();
  });

  it('surfaces a non-fatal error banner', () => {
    render(<CityNewsView city={city} news={[]} loading={false} error="دریافت اخبار ناموفق بود" />);
    expect(screen.getByRole('alert')).toHaveTextContent('دریافت اخبار ناموفق بود');
  });
});
