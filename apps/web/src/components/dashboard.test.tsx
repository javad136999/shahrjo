import { render, screen, within, fireEvent } from '@testing-library/react';
import { CityDashboard } from '@/components/dashboard';
import type { City, CityMapData, ShowcaseItem } from '@/lib/types';

// The map is a Leaflet canvas (covered by city-map.test.tsx) — stub it here so
// dashboard tests stay DOM-only.
jest.mock('@/components/city-map', () => ({
  CityMap: ({
    data,
    onCategoryChange,
  }: {
    data: CityMapData;
    onCategoryChange?: (slug: string | null) => void;
  }) => (
    <div data-testid="city-map" data-pins={data.businesses.length}>
      <button type="button" data-testid="mock-filter-restaurant" onClick={() => onCategoryChange?.('restaurant')}>
        فیلتر رستوران
      </button>
      <button type="button" data-testid="mock-filter-jobs" onClick={() => onCategoryChange?.('jobs')}>
        فیلتر استخدام
      </button>
      <button type="button" data-testid="mock-filter-clear" onClick={() => onCategoryChange?.(null)}>
        حذف فیلتر
      </button>
    </div>
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
    { id: 40, name: 'رستوران ویترین', slug: 'showcase-rest', latitude: 27.831, longitude: 52.321, subscriptionTier: 'GOLD', category: { name: 'رستوران', slug: 'restaurants', icon: '🍽', color: '#0e7a5f' } },
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

  it('keeps news, ads and businesses off the home page', () => {
    renderDashboard();
    // no feed sections, no stat tiles — they live on their own pages now
    expect(screen.queryByRole('heading', { name: 'اخبار شهر' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'آگهی‌ها' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'کسب‌وکارها' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('news-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-خبر')).not.toBeInTheDocument();
  });

  it('skips the map section until map data (or loading) arrives', () => {
    renderDashboard();
    expect(screen.queryByRole('heading', { name: 'نقشه شهر' })).not.toBeInTheDocument();
    renderDashboard({ loading: true });
    expect(screen.getByRole('heading', { name: 'نقشه شهر' })).toBeInTheDocument();
  });

  it('shows loading placeholders while fetching', () => {
    renderDashboard({ loading: true });
    // the map section keeps its placeholder; the showcase has its own copy
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

  it('renders the golden showcase above the city map with its pins count', () => {
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

const parityMap: CityMapData = {
  city: { id: 1, name: 'شهر نمونه', slug: 'sample-city', latitude: 27.5, longitude: 52.4, boundary: null },
  businesses: [
    {
      id: 1,
      name: 'رستوران نمونه',
      slug: 'rest-1',
      latitude: 27.5,
      longitude: 52.4,
      subscriptionTier: 'GOLD',
      category: { name: 'رستوران', slug: 'restaurant', icon: '🍽️', color: null },
    },
    {
      id: 2,
      name: 'کافه نمونه',
      slug: 'cafe-1',
      latitude: 27.51,
      longitude: 52.41,
      subscriptionTier: 'FREE',
      category: { name: 'کافه', slug: 'cafe', icon: '☕', color: null },
    },
  ],
};

describe('CityDashboard — map ↔ list parity', () => {
  it('lists every map business and keeps the list in sync with the map filter', async () => {
    renderDashboard({ mapData: parityMap });

    const list = await screen.findByTestId('map-bizlist');
    expect(list).toHaveTextContent('رستوران نمونه');
    expect(list).toHaveTextContent('کافه نمونه');
    expect(screen.getByTestId('map-list-count')).toHaveTextContent('۲');
    // gold marker hint comes from the API tier, not from styling guesses
    const rows = within(screen.getByTestId('map-bizlist')).getAllByRole('link');
    expect(rows[0]).toHaveTextContent('👑'); // GOLD row
    expect(rows[1]).not.toHaveTextContent('👑'); // FREE row

    fireEvent.click(screen.getByTestId('mock-filter-restaurant'));
    const filtered = screen.getByTestId('map-bizlist');
    expect(filtered).toHaveTextContent('رستوران نمونه');
    expect(filtered).not.toHaveTextContent('کافه نمونه');
    expect(screen.getByTestId('map-list-count')).toHaveTextContent('۱');
    expect(screen.getByText('فیلتر دسته: رستوران')).toBeInTheDocument();

    // a category with no pinned businesses → the shared empty state
    fireEvent.click(screen.getByTestId('mock-filter-jobs'));
    expect(screen.getByTestId('map-list-empty')).toBeInTheDocument();
    expect(screen.getByTestId('map-list-count')).toHaveTextContent('۰');

    // clearing the filter restores the full list
    fireEvent.click(screen.getByTestId('mock-filter-clear'));
    expect(screen.getByTestId('map-bizlist')).toHaveTextContent('کافه نمونه');
    expect(screen.getByText('کسب‌وکارهای دارای موقعیت، همراه با دسته‌بندی')).toBeInTheDocument();
  });
});
