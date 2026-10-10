import { render, screen } from '@testing-library/react';
import { CityDashboard } from '@/components/dashboard';
import type { City, CityMapData, ShowcaseItem } from '@/lib/types';

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

function renderDashboard(overrides: Partial<Parameters<typeof CityDashboard>[0]> = {}) {
  return render(
    <CityDashboard
      city={city}
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
  it('greets the visitor with the city name only (no action pills)', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1, name: 'به شهر شهر نمونه خوش آمدید' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /تغییر شهر/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ثبت آگهی/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /اشتراک ویژه/ })).not.toBeInTheDocument();
  });

  it('offers the beating-heart entry to the city wall', () => {
    renderDashboard();
    const cta = screen.getByTestId('wall-cta');
    expect(cta).toHaveAttribute('href', '/wall');
    expect(cta).toHaveTextContent('ورود به دیوار شهر');
    expect(cta).toHaveClass('wall-cta');
  });

  it('keeps news, ads and businesses off the home page', () => {
    renderDashboard();
    expect(screen.queryByRole('heading', { name: 'اخبار شهر' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'آگهی‌ها' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'کسب‌وکارها' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('news-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-خبر')).not.toBeInTheDocument();
  });

  it('skips the map section until map data (or loading) arrives, without a redundant title', () => {
    renderDashboard();
    expect(screen.queryByRole('region', { name: 'نقشهٔ شهر نمونه' })).not.toBeInTheDocument();
    const view = renderDashboard({ loading: true });
    expect(screen.getByRole('region', { name: 'نقشهٔ شهر نمونه' })).toBeInTheDocument();
    expect(screen.getByText('در حال بارگذاری نقشه…')).toBeInTheDocument();
    view.unmount();
  });

  it('shows loading placeholders while fetching', () => {
    renderDashboard({ loading: true });
    expect(screen.getByText('در حال بارگذاری نقشه…')).toBeInTheDocument();
    expect(screen.getByText('در حال بارگذاری ویترین…')).toBeInTheDocument();
  });

  it('surfaces a non-fatal feed error banner', () => {
    renderDashboard({ feedError: 'دریافت محتوای شهر ناموفق بود' });
    expect(screen.getByRole('alert')).toHaveTextContent('دریافت محتوای شهر ناموفق بود');
  });

  it('renders the golden showcase panel without a duplicate business-registration CTA', () => {
    renderDashboard({ showcase });
    const panel = screen.getByTestId('showcase');
    expect(panel).toHaveTextContent('ویترین طلایی');
    expect(screen.getByTestId('showcase-40')).toHaveTextContent('رستوران ویترین');
    expect(screen.queryByTestId('showcase-cta')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /معرفی کسب‌وکار من/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رستوران ویترین' })).toHaveAttribute('href', '/business/40');
    const hidden = panel.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('shows the plan CTA when the city has no paid businesses', () => {
    renderDashboard();
    expect(screen.getByTestId('showcase-empty')).toHaveTextContent('هنوز کسب‌وکار طلایی‌ای در این شهر ثبت نشده');
    expect(screen.getByRole('link', { name: /مشاهده اشتراک‌ها/ })).toHaveAttribute('href', '/plans');
  });

  it('renders the map before the showcase so it appears higher on the city page', () => {
    renderDashboard({ mapData, showcase });
    const map = screen.getByTestId('city-map');
    expect(map).toHaveAttribute('data-pins', '1');
    expect(screen.queryByRole('heading', { name: 'نقشه شهر' })).not.toBeInTheDocument();
    const showcaseEl = screen.getByTestId('showcase');
    expect(map.compareDocumentPosition(showcaseEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
