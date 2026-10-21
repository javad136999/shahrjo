import { render, screen } from '@testing-library/react';
import { ShowcaseMarquee } from '@/components/showcase-marquee';
import type { ShowcaseItem } from '@/lib/types';

const items: ShowcaseItem[] = [
  {
    id: 40,
    name: 'رستوران ویترین',
    slug: 'rest',
    logoUrl: null,
    address: 'خیابان اصلی',
    rating: 4.8,
    ratingCount: 21,
    subscriptionTier: 'GOLD',
    category: { name: 'رستوران', slug: 'restaurants', icon: '🍽', color: '#0e7a5f' },
  },
  {
    id: 41,
    name: 'فروشگاه نقره‌ای',
    slug: 'shop',
    logoUrl: '/api/v1/files/ads/2026/10/x.jpg',
    address: null,
    rating: 4.1,
    ratingCount: 9,
    subscriptionTier: 'SILVER',
    category: { name: 'فروشگاه', slug: 'shops', icon: '🛍', color: null },
  },
];

describe('ShowcaseMarquee', () => {
  it('renders the golden panel without the menu/products shortcut', () => {
    render(<ShowcaseMarquee items={items} loading={false} />);
    expect(screen.getByTestId('showcase')).toHaveTextContent('ویترین طلایی');
    expect(screen.getByTestId('showcase')).toHaveTextContent('معرفی کن، جایزه ببر');
    expect(screen.getByTestId('showcase-cta')).toHaveAttribute('href', '/referrals');
    expect(screen.getByTestId('showcase-cta').firstElementChild).toHaveTextContent('🎁');
    expect(screen.queryByTestId('showcase-products-cta')).not.toBeInTheDocument();
    expect(screen.getByTestId('showcase-40')).toHaveTextContent('رستوران ویترین');
    expect(screen.getByTestId('showcase-41')).toHaveTextContent('فروشگاه نقره‌ای');
  });

  it('shows the real business photo instead of the business icon', () => {
    const { container } = render(<ShowcaseMarquee items={items} loading={false} />);

    const withPhoto = screen.getByTestId('showcase-41');
    const img = withPhoto.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/v1/files/ads/2026/10/x.thumb.webp');

    // no photo yet → the category emoji tile stays
    const withoutPhoto = screen.getByTestId('showcase-40');
    expect(withoutPhoto.querySelector('img')).toBeNull();
    expect(withoutPhoto).toHaveTextContent('🏪');
    expect(container.querySelector('.showcase-card__emoji')).not.toBeNull();
  });

  it('marks GOLD cards with the crown class and silver ones differently', () => {
    const { container } = render(<ShowcaseMarquee items={items} loading={false} />);
    expect(container.querySelector('.showcase-card--gold')).not.toBeNull();
    expect(container.querySelector('.showcase-card--silver')).not.toBeNull();
    expect(container.querySelectorAll('.showcase-card').length).toBeGreaterThanOrEqual(items.length * 2);
  });

  it('keeps every loop repeat out of the accessibility tree', () => {
    const { container } = render(<ShowcaseMarquee items={items} loading={false} />);
    const hidden = container.querySelectorAll('.showcase-card[aria-hidden="true"]');
    const visible = container.querySelectorAll('.showcase-card:not([aria-hidden="true"])');
    // only the first copy of each item is real content; the rest drive the loop
    expect(visible.length).toBe(items.length);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.length + visible.length).toBeGreaterThan(items.length * 2 - 1);
  });

  it('deep-links each card to its business page', () => {
    render(<ShowcaseMarquee items={items} loading={false} />);
    expect(screen.getByRole('link', { name: 'رستوران ویترین' })).toHaveAttribute('href', '/business/40');
  });

  it('loads logos from the 400px thumbnail instead of the full image', () => {
    render(<ShowcaseMarquee items={items} loading={false} />);
    const logo = screen.getByTestId('showcase-41').querySelector('img');
    expect(logo).toHaveAttribute('src', '/api/v1/files/ads/2026/10/x.thumb.webp');
  });

  it('shows the loading state while fetching', () => {
    render(<ShowcaseMarquee items={[]} loading={true} />);
    expect(screen.getByText('در حال بارگذاری ویترین…')).toBeInTheDocument();
    expect(screen.queryByTestId('showcase-viewport')).not.toBeInTheDocument();
  });

  it('offers the signup (not the plans) when there are no paid businesses yet', () => {
    render(<ShowcaseMarquee items={[]} loading={false} />);
    expect(screen.getByTestId('showcase-empty')).toHaveTextContent('هنوز کسب‌وکار طلایی‌ای');
    // one door out of an empty showcase: register a business
    expect(screen.getByTestId('showcase-empty-cta')).toHaveAttribute('href', '/business/new');
    expect(screen.getByRole('link', { name: /ثبت کسب‌وکار/ })).toHaveAttribute('href', '/business/new');
    // Introduction link remains available in an empty city too.
    expect(screen.getByTestId('showcase-cta')).toHaveAttribute('href', '/referrals');
    expect(screen.queryByRole('link', { name: /مشاهده اشتراک‌ها/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('showcase-viewport')).not.toBeInTheDocument();
  });
});
