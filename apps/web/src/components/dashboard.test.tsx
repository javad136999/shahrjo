import { render, screen } from '@testing-library/react';
import { CityDashboard } from '@/components/dashboard';
import type { City, CityMapData, MenuShowcaseItem, ShowcaseItem } from '@/lib/types';

// The map is a Leaflet canvas (covered by city-map.test.tsx) — stub it here so
// dashboard tests stay DOM-only.
jest.mock('@/components/city-map', () => ({
  CityMap: ({ data }: { data: CityMapData }) => <div data-testid="city-map" data-pins={data.businesses.length} />,
}));

// The service desk (city-services.test.tsx covers it) — stubbed so these tests
// stay about the dashboard layout, not about the desk's fetches/router.
jest.mock('@/components/city-services', () => ({
  CityServices: ({ cityName }: { cityName: string }) => (
    <div data-testid="city-services" data-city={cityName} />
  ),
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
    { id: 40, name: 'رستوران ویترین', slug: 'showcase-rest', latitude: 27.831, longitude: 52.321, subscriptionTier: 'GOLD', logoUrl: null, category: { name: 'رستوران', slug: 'restaurants', icon: '🍽', color: '#0e7a5f' } },
  ],
};

describe('CityDashboard', () => {
  it('greets the visitor with the city name only (no action pills)', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1, name: 'به شهر شهر نمونه خوش آمدید' })).toBeInTheDocument();
    // the old header actions (subscription / submit / change city) are gone
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

  it('keeps city services inside the welcome card and the showcase above the map', () => {
    renderDashboard({ mapData });
    const desk = screen.getByTestId('city-services');
    expect(desk).toHaveAttribute('data-city', 'شهر نمونه');
    const welcome = screen.getByTestId('dash-welcome');
    expect(welcome).toContainElement(desk);
    expect(welcome).toContainElement(screen.getByTestId('wall-cta'));
    const order = [...document.querySelectorAll('[data-testid="dash-welcome"], [data-testid="showcase"], [data-testid="city-map"]')].map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(order).toEqual(['dash-welcome', 'showcase', 'city-map']);
  });

  it('keeps news, ads and the full business directory off the home page', () => {
    renderDashboard();
    // no feed sections, no stat tiles — they live on their own pages now
    expect(screen.queryByRole('heading', { name: 'اخبار شهر' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'آگهی‌ها' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'کسب‌وکارها' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('news-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-خبر')).not.toBeInTheDocument();
  });

  it('skips the map until map data (or loading) arrives', () => {
    const { container: empty } = renderDashboard();
    expect(empty.querySelector('.dash-map')).toBeNull();
    expect(screen.queryByTestId('city-map')).toBeNull();
    const { container: loading } = renderDashboard({ loading: true });
    expect(loading.querySelector('.dash-map')).not.toBeNull();
  });

  it('renders the map without the «نقشه شهر» title/icon row above it', () => {
    renderDashboard({ mapData, showcase });
    expect(screen.getByTestId('city-map')).toBeInTheDocument();
    // the labelled section head (icon tile + title + counts) was removed
    expect(screen.queryByRole('heading', { name: 'نقشه شهر' })).toBeNull();
    expect(screen.queryByText('محدوده شهر و کسب‌وکارهای تأییدشده روی نقشه')).toBeNull();
    expect(screen.queryByText('۱ مکان')).toBeNull();
    expect(document.querySelector('.dash-map .icon-tile')).toBeNull();
  });

  it('shows loading placeholders while fetching', () => {
    renderDashboard({ loading: true });
    // the map keeps its placeholder; the showcase has its own copy
    expect(screen.getAllByText('در حال بارگذاری…')).toHaveLength(1);
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
    expect(screen.getByTestId('showcase-cta')).toHaveAttribute('href', '/referrals');
    expect(screen.queryByTestId('showcase-products-cta')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رستوران ویترین' })).toHaveAttribute('href', '/business/40');
    // the list is rendered twice for the seamless loop; the copy is aria-hidden
    const hidden = panel.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('offers the signup instead of the plans when the city has no paid businesses', () => {
    renderDashboard();
    expect(screen.getByTestId('showcase-empty')).toHaveTextContent('هنوز کسب‌وکار طلایی‌ای در این شهر ثبت نشده');
    // an empty showcase keeps signup and the site-introduction link
    expect(screen.getByTestId('showcase-cta')).toHaveAttribute('href', '/referrals');
    expect(screen.queryByRole('link', { name: /معرفی کسب‌وکار من/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /مشاهده اشتراک‌ها/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('showcase-empty-cta')).toHaveAttribute('href', '/business/new');
  });

  it('puts the golden showcase above the map', () => {
    renderDashboard({ mapData, showcase });
    expect(screen.getByTestId('city-map')).toHaveAttribute('data-pins', '1');
    const map = document.querySelector('.dash-map') as HTMLElement;
    const showcaseEl = screen.getByTestId('showcase');
    expect(map).not.toBeNull();
    expect(showcaseEl.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows businesses with menu products directly beneath the city map', () => {
    const menuShowcase: MenuShowcaseItem[] = [
      {
        id: 88,
        name: 'کافه نمونه',
        slug: 'sample-cafe',
        logoUrl: null,
        subscriptionTier: 'SILVER',
        category: { name: 'کافه', slug: 'cafe', icon: '☕', color: null },
        products: [{ id: 9, name: 'موکا', price: 250_000, imageUrl: null, isAvailable: true }],
      },
    ];
    renderDashboard({ mapData, menuShowcase });

    const map = document.querySelector('.dash-map') as HTMLElement;
    const panel = screen.getByTestId('menu-showcase');
    expect(map.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('menu-showcase-business-88')).toHaveAttribute('href', '/business/88');
    expect(panel).toHaveTextContent('کافه نمونه');
    expect(panel).toHaveTextContent('موکا');
  });
});
