import { render, screen, waitFor } from '@testing-library/react';

const mockPathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const mockGetLocalCity = jest.fn();
const mockGetTokens = jest.fn();
const mockGetDmUnread = jest.fn();
const mockGetWallUnread = jest.fn();

jest.mock('@/lib/api', () => ({
  CITY_CHANGED_EVENT: 'shahrjo:city-changed',
  DM_CHANGED_EVENT: 'shahrjo:dm-changed',
  getLocalCity: () => mockGetLocalCity(),
  getTokens: () => mockGetTokens(),
  getDmUnread: () => mockGetDmUnread(),
  getWallUnread: (slug: string) => mockGetWallUnread(slug),
}));

import { BottomNav } from '@/components/bottom-nav';

describe('BottomNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/');
    mockGetLocalCity.mockReturnValue({ id: 5, slug: 'sample-city', name: 'شهر نمونه' });
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGetDmUnread.mockResolvedValue({ total: 0 });
    mockGetWallUnread.mockResolvedValue({ unseenCount: 0 });
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('renders the six quick actions with emoji icons (no submit entry)', () => {
    render(<BottomNav />);
    expect(screen.getByRole('navigation', { name: 'ناوبری سریع' })).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-home')).toHaveTextContent('خانه');
    // the news icon left the bar: its slot opens the owner's businesses now
    expect(screen.queryByTestId('bottom-nav-news')).toBeNull();
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveTextContent('کسب‌وکارها');
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveAttribute('href', '/businesses');
    expect(screen.getByTestId('bottom-nav-businesses')).not.toHaveClass('bottom-nav__item--register-business');
    expect(screen.getByTestId('bottom-nav-wall')).toHaveTextContent('دیوار');
    expect(screen.getByTestId('bottom-nav-messages')).toHaveTextContent('پیام‌ها');
    expect(screen.getByTestId('bottom-nav-register-business')).toHaveTextContent('ثبت کسب‌وکار');
    expect(screen.getByTestId('bottom-nav-register-business')).toHaveClass('bottom-nav__item--register-business');
    expect(screen.getByTestId('bottom-nav-profile')).toHaveTextContent('پروفایل');
    expect(screen.getByTestId('bottom-nav-profile')).toHaveAttribute('href', '/profile');
    expect(screen.getByTestId('bottom-nav-wall')).toHaveAttribute('href', '/wall');
    expect(screen.getByTestId('bottom-nav-messages')).toHaveAttribute('href', '/messages');
    // the home icon leads back to the remembered city, not to city selection
    expect(screen.getByTestId('bottom-nav-home')).toHaveAttribute('href', '/city/sample-city');
    // «ثبت آگهی» moved into the city-wall composer (Phase 10)
    expect(screen.queryByTestId('bottom-nav-submit')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ثبت آگهی/ })).not.toBeInTheDocument();
  });

  it('deep-links businesses and register-business', async () => {
    render(<BottomNav />);
    // the city is read client-side after mount
    expect(await screen.findByTestId('bottom-nav-businesses')).toHaveAttribute('href', '/businesses');
    expect(screen.getByTestId('bottom-nav-register-business')).toHaveAttribute('href', '/business/new');
  });

  it('keeps the businesses entry working with no city remembered', async () => {
    mockGetLocalCity.mockReturnValue(null);
    render(<BottomNav />);
    expect(await screen.findByTestId('bottom-nav-businesses')).toHaveAttribute('href', '/businesses');
    expect(screen.getByTestId('bottom-nav-register-business')).toHaveAttribute('href', '/business/new');
    // with no city chosen yet, home falls back to the city-selection page
    expect(screen.getByTestId('bottom-nav-home')).toHaveAttribute('href', '/');
  });

  it('marks home active on the landing page (and never an ads route)', () => {
    mockPathname.mockReturnValue('/');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-home')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-businesses')).not.toHaveClass('is-active');
  });

  it('marks businesses active on the owner list and on a manage page', () => {
    mockPathname.mockReturnValue('/businesses');
    const { unmount } = render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');
    unmount();

    mockPathname.mockReturnValue('/business/30/manage');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveClass('is-active');
  });

  it('keeps the bar on screen on the city home page (pinned at every width)', () => {
    mockPathname.mockReturnValue('/city/sample-city');
    render(<BottomNav />);
    const nav = screen.getByRole('navigation', { name: 'ناوبری سریع' });
    expect(nav).toHaveClass('bottom-nav--always');
    expect(nav).toHaveAttribute('data-pinned', 'true');
    // the page gets the room the pinned bar occupies
    expect(document.body).toHaveClass('nav-pinned');
  });

  it('never pins the bar outside the city home', () => {
    mockPathname.mockReturnValue('/city/sample-city/news');
    const { unmount } = render(<BottomNav />);
    expect(screen.getByRole('navigation', { name: 'ناوبری سریع' })).not.toHaveClass('bottom-nav--always');
    expect(document.body).not.toHaveClass('nav-pinned');
    unmount();
  });

  it('marks register-business active on /business/new', () => {
    mockPathname.mockReturnValue('/business/new');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-register-business')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');
  });

  it('marks the profile item active on /profile', () => {
    mockPathname.mockReturnValue('/profile');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-profile')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');
  });

  it('marks wall active on /wall (and not home)', () => {
    mockPathname.mockReturnValue('/wall');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-wall')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');
  });

  it('marks messages active on /messages (and not home)', () => {
    mockPathname.mockReturnValue('/messages');
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-messages')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');
  });

  it('shows red unread badges for private messages and the wall', async () => {
    mockGetDmUnread.mockResolvedValue({ total: 3 });
    mockGetWallUnread.mockResolvedValue({ unseenCount: 7 });
    render(<BottomNav />);
    expect(await screen.findByTestId('bottom-nav-messages-badge')).toHaveTextContent('3');
    expect(await screen.findByTestId('bottom-nav-wall-badge')).toHaveTextContent('7');
    expect(mockGetWallUnread).toHaveBeenCalledWith('sample-city');
  });

  it('fetches no unread counts for signed-out visitors', async () => {
    mockGetTokens.mockReturnValue(null);
    mockGetDmUnread.mockResolvedValue({ total: 4 });
    mockGetWallUnread.mockResolvedValue({ unseenCount: 9 });
    render(<BottomNav />);
    await waitFor(() => expect(mockGetTokens).toHaveBeenCalled());
    expect(mockGetDmUnread).not.toHaveBeenCalled();
    expect(mockGetWallUnread).not.toHaveBeenCalled();
    expect(screen.queryByTestId('bottom-nav-messages-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bottom-nav-wall-badge')).not.toBeInTheDocument();
  });
});
