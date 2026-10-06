import { render, screen } from '@testing-library/react';

const mockPathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const mockGetLocalCity = jest.fn();

jest.mock('@/lib/api', () => ({
  CITY_CHANGED_EVENT: 'shahrjo:city-changed',
  getLocalCity: () => mockGetLocalCity(),
}));

import { BottomNav } from '@/components/bottom-nav';

describe('BottomNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/');
    mockGetLocalCity.mockReturnValue({ id: 5, slug: 'sample-city', name: 'شهر نمونه' });
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('renders the four quick actions with emoji icons', () => {
    render(<BottomNav />);
    expect(screen.getByRole('navigation', { name: 'ناوبری سریع' })).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-home')).toHaveTextContent('خانه');
    expect(screen.getByTestId('bottom-nav-news')).toHaveTextContent('اخبار');
    expect(screen.getByTestId('bottom-nav-submit')).toHaveTextContent('ثبت آگهی');
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveTextContent('کسب‌وکارها');
    expect(screen.getByTestId('bottom-nav-profile')).toHaveTextContent('پروفایل');
    expect(screen.getByTestId('bottom-nav-profile')).toHaveAttribute('href', '/profile');
  });

  it('deep-links news to the city news page and businesses to the map', async () => {
    render(<BottomNav />);
    // the city is read client-side after mount
    expect(await screen.findByTestId('bottom-nav-news')).toHaveAttribute('href', '/city/sample-city/news');
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveAttribute('href', '/city/sample-city#map');
    expect(screen.getByTestId('bottom-nav-submit')).toHaveAttribute('href', '/ads/new');
  });

  it('falls back to the city picker when no city is remembered', async () => {
    mockGetLocalCity.mockReturnValue(null);
    render(<BottomNav />);
    expect(await screen.findByTestId('bottom-nav-news')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveAttribute('href', '/');
  });

  it('marks the submit action active on /ads routes', () => {
    mockPathname.mockReturnValue('/ads/new');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-submit')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');
  });

  it('marks home active on the landing page', () => {
    mockPathname.mockReturnValue('/');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-home')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-submit')).not.toHaveClass('is-active');
  });

  it('marks news active on the city news page (and not home)', () => {
    mockPathname.mockReturnValue('/city/sample-city/news');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-news')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');
  });

  it('marks the profile item active on /profile', () => {
    mockPathname.mockReturnValue('/profile');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-profile')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');
  });
});
