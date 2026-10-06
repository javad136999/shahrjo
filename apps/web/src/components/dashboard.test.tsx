import { render, screen } from '@testing-library/react';
import { CityDashboard } from '@/components/dashboard';
import type { AdItem, BusinessItem, City, CityMapData, NewsItem, ShowcaseItem } from '@/lib/types';

// The map is a Leaflet canvas (covered by city-map.test.tsx) — stub it here so
// dashboard tests stay DOM-only.
jest.mock('@/components/city-map', () => ({
  CityMap: ({ data }: { data: CityMapData }) => <div data-testid="city-map" data-pins={data.businesses.length} />,
}));

const city: City = {
  id: 1,
  name: 'شهر نمونه',
  slug: 'sample-city',
  isFeatured: true,
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

const ads: AdItem[] = [
  { id: 20, title: 'آگهی گران', price: 125000000, coverUrl: null, viewCount: 12, publishedAt: null, category: { name: 'لوازم', slug: 'goods', icon: '🛍️', color: null } },
  { id: 21, title: 'آگهی توافقی', price: null, coverUrl: null, viewCount: 0, publishedAt: null, category: { name: 'لوازم', slug: 'goods', icon: '🛍️', color: null } },
];

const businesses: BusinessItem[] = [
  {
    id: 30,
    name: 'کسب‌وکار نمونه',
    slug: 'sample-business',
    logoUrl: null,
    address: 'خیابان اصلی',
    phone: '09120000000',
    rating: 4.26,
    ratingCount: 3,
    subscriptionTier: 'GOLD',
    category: { name: 'رستوران', slug: 'restaurants', icon: '🍽', color: '#0e7a5f' },
  },
];

function renderDashboard(overrides: Partial<Parameters<typeof CityDashboard>[0]> = {}) {
  return render(
    <CityDashboard
      city={city}
      news={[]}
      ads={[]}
      businesses={[]}
      showcase={[]}
      mapData={null}
      loading={false}
      feedError={null}
      {...overrides}
    />,
  );
}

const showcase: ShowcaseItem[] = [
  {
    id: 40,
    name: 'رستوران ویترین',
    slug: 'showcase-rest',
    logoUrl: null,
    address: null,
    rating: 4.8,
    ratingCount: 21,
    subscriptionTier: 'GOLD',
    category: { name: 'رستوران', slug: 'restaurants', icon: '🍽', color: '#0e7a5f' },
  },
  {
    id: 41,
    name: 'فروشگاه نقره‌ای',
    slug: 'silver-shop',
    logoUrl: null,
    address: null,
    rating: 4.1,
    ratingCount: 9,
    subscriptionTier: 'SILVER',
    category: { name: 'فروشگاه', slug: 'shops', icon: '🛍', color: null },
  },
];

const mapData: CityMapData = {
  city: { id: 1, name: 'شهر نمونه', slug: 'sample-city', latitude: 27.83, longitude: 52.32, boundary: null },
  businesses: [
    { id: 40, name: 'رستوران ویترین', slug: 'showcase-rest', latitude: 27.831, longitude: 52.321, subscriptionTier: 'GOLD', category: { name: 'رستوران', slug: 'restaurants', icon: '🍽', color: '#0e7a5f' } },
  ],
};

describe('CityDashboard', () => {
  it('renders the city header with province and featured badge', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1, name: 'شهر نمونه' })).toBeInTheDocument();
    expect(screen.getByText(/استان نمونه/)).toBeInTheDocument();
    expect(screen.getByText('ویژه')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /تغییر شهر/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /ثبت آگهی/ })).toHaveAttribute('href', '/ads/new');
  });

  it('renders all three feeds', () => {
    renderDashboard({ news, ads, businesses });
    expect(screen.getByTestId('news-10')).toHaveTextContent('خبر نمونه');
    expect(screen.getByTestId('news-10')).toHaveTextContent('حوادث');
    expect(screen.getByTestId('ad-20')).toHaveTextContent('آگهی گران');
    expect(screen.getByTestId('business-30')).toHaveTextContent('کسب‌وکار نمونه');
    // section counters come from the data (Persian digits, JamCity-style)
    expect(screen.getByText('۱ خبر')).toBeInTheDocument();
    expect(screen.getByText('۲ آگهی')).toBeInTheDocument();
    expect(screen.getByText('۱ کسب‌وکار')).toBeInTheDocument();
    // quick stat tiles mirror the same counters
    expect(screen.getByTestId('stat-خبر')).toHaveTextContent('۱');
    expect(screen.getByTestId('stat-آگهی')).toHaveTextContent('۲');
    expect(screen.getByTestId('stat-کسب‌وکار')).toHaveTextContent('۱');
    // every card title deep-links into its detail page (Phase 6)
    expect(screen.getByRole('link', { name: 'خبر نمونه' })).toHaveAttribute('href', '/news/sample-news');
    expect(screen.getByRole('link', { name: 'آگهی گران' })).toHaveAttribute('href', '/ad/20');
    expect(screen.getByRole('link', { name: 'کسب‌وکار نمونه' })).toHaveAttribute('href', '/business/30');
  });

  it('formats prices as Rial or negotiated', () => {
    renderDashboard({ ads });
    expect(screen.getByTestId('ad-20-price')).toHaveTextContent('ریال');
    expect(screen.getByTestId('ad-21-price')).toHaveTextContent('توافقی');
  });

  it('marks gold businesses', () => {
    renderDashboard({ businesses });
    expect(screen.getByTestId('business-30')).toHaveTextContent('طلایی');
    expect(screen.getByTestId('business-30')).toHaveTextContent('4.3 از 5');
  });

  it('shows empty states per section when feeds are empty', () => {
    renderDashboard();
    expect(screen.getByText('هنوز خبری برای این شهر منتشر نشده است.')).toBeInTheDocument();
    expect(screen.getByText('فعلاً آگهی فعالی در این شهر نیست.')).toBeInTheDocument();
    expect(screen.getByText('هنوز کسب‌وکار تأییدشده‌ای در این شهر ثبت نشده است.')).toBeInTheDocument();
  });

  it('shows loading placeholders while fetching', () => {
    renderDashboard({ loading: true });
    // news + ads + businesses + city map sections
    expect(screen.getAllByText('در حال بارگذاری…')).toHaveLength(4);
    // the showcase has its own loading copy
    expect(screen.getByText('در حال بارگذاری ویترین…')).toBeInTheDocument();
  });

  it('surfaces a non-fatal feed error banner', () => {
    renderDashboard({ feedError: 'دریافت محتوای شهر ناموفق بود' });
    expect(screen.getByRole('alert')).toHaveTextContent('دریافت محتوای شهر ناموفق بود');
  });

  it('renders the golden showcase panel with its CTA (Phase 9)', () => {
    renderDashboard({ showcase });
    const panel = screen.getByTestId('showcase');
    expect(panel).toHaveTextContent('ویترین طلایی');
    expect(screen.getByTestId('showcase-40')).toHaveTextContent('رستوران ویترین');
    expect(screen.getByTestId('showcase-cta')).toHaveAttribute('href', '/plans');
    expect(screen.getByRole('link', { name: 'رستوران ویترین' })).toHaveAttribute('href', '/business/40');
    // the list is rendered twice for the seamless loop; the copy is aria-hidden
    const hidden = panel.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('shows the showcase CTA when the city has no paid businesses', () => {
    renderDashboard();
    expect(screen.getByTestId('showcase-empty')).toHaveTextContent('هنوز کسب‌وکار طلایی‌ای در این شهر ثبت نشده');
  });

  it('renders the city map above the feeds with its pins count (Phase 9)', () => {
    renderDashboard({ mapData, showcase });
    expect(screen.getByTestId('city-map')).toHaveAttribute('data-pins', '1');
    expect(screen.getByRole('heading', { name: 'نقشه شهر' })).toBeInTheDocument();
    expect(screen.getByText('۱ مکان')).toBeInTheDocument();
    // showcase sits directly above the map section
    const showcaseEl = screen.getByTestId('showcase');
    const mapHeading = screen.getByRole('heading', { name: 'نقشه شهر' });
    const section = mapHeading.closest('.dash-section') as HTMLElement;
    expect(showcaseEl.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
