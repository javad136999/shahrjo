import { render, screen, waitFor } from '@testing-library/react';

const mockPathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const mockGetLocalCity = jest.fn();
const mockGetTokens = jest.fn();
const mockGetProfile = jest.fn();
const mockGetWallUnread = jest.fn();
const mockGetConversations = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number) { super('api error'); this.status = status; }
  },
  CITY_CHANGED_EVENT: 'shahrjo:city-changed',
  getLocalCity: () => mockGetLocalCity(),
  getTokens: () => mockGetTokens(),
  getProfile: () => mockGetProfile(),
  getWallUnread: (...args: unknown[]) => mockGetWallUnread(...args),
  getConversations: () => mockGetConversations(),
}));

import { BottomNav } from '@/components/bottom-nav';

describe('BottomNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/');
    mockGetLocalCity.mockReturnValue({ id: 5, slug: 'sample-city', name: 'شهر نمونه' });
    mockGetTokens.mockReturnValue(null);
    mockGetProfile.mockResolvedValue({ id: 77 });
    mockGetWallUnread.mockResolvedValue({ count: 0 });
    mockGetConversations.mockResolvedValue([]);
    window.location.hash = '';
    window.localStorage.clear();
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('renders city navigation, private messages, public wall and business registration', () => {
    render(<BottomNav />);
    expect(screen.getByRole('navigation', { name: 'ناوبری سریع' })).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-home')).toHaveTextContent('خانه');
    expect(screen.getByTestId('bottom-nav-news')).toHaveTextContent('اخبار');
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveTextContent('نقشه');
    expect(screen.getByTestId('bottom-nav-wall')).toHaveTextContent('دیوار');
    expect(screen.getByTestId('bottom-nav-messages')).toHaveTextContent('پیام‌ها');
    expect(screen.getByTestId('bottom-nav-register')).toHaveAttribute('href', '/business/register');
    expect(screen.getByTestId('bottom-nav-register')).toHaveTextContent('ثبت کسب‌وکار');
    expect(screen.getByTestId('bottom-nav-profile')).toHaveAttribute('href', '/profile');
    expect(screen.queryByTestId('bottom-nav-submit')).not.toBeInTheDocument();
  });

  it('deep-links news and map to the remembered city', async () => {
    render(<BottomNav />);
    expect(await screen.findByTestId('bottom-nav-news')).toHaveAttribute('href', '/city/sample-city/news');
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveAttribute('href', '/city/sample-city#map');
  });

  it('falls back to the city picker when no city is remembered', async () => {
    mockGetLocalCity.mockReturnValue(null);
    render(<BottomNav />);
    expect(await screen.findByTestId('bottom-nav-news')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('bottom-nav-businesses')).toHaveAttribute('href', '/');
  });

  it('shows unread counts for wall posts and private conversations', async () => {
    mockGetTokens.mockReturnValue({ accessToken: 'available' });
    mockGetProfile.mockResolvedValue({ id: 77 });
    mockGetWallUnread.mockResolvedValue({ count: 3 });
    mockGetConversations.mockResolvedValue([
      { id: 1, unreadCount: 2 },
      { id: 2, unreadCount: 4 },
    ]);
    render(<BottomNav />);
    await waitFor(() => {
      expect(screen.getByTestId('bottom-nav-wall-count')).toHaveTextContent('۳');
      expect(screen.getByTestId('bottom-nav-messages-count')).toHaveTextContent('۶');
    });
    expect(mockGetWallUnread).toHaveBeenCalledWith('sample-city', undefined);
  });

  it('marks home active on the landing page, news on its page, and profile on /profile', () => {
    mockPathname.mockReturnValue('/');
    const view = render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-home')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-news')).not.toHaveClass('is-active');

    mockPathname.mockReturnValue('/city/sample-city/news');
    view.rerender(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-news')).toHaveClass('is-active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('is-active');

    mockPathname.mockReturnValue('/profile');
    view.rerender(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-profile')).toHaveClass('is-active');
  });

  it('activates the wall, messages, business registration and map routes', () => {
    const view = render(<BottomNav />);
    mockPathname.mockReturnValue('/wall');
    view.rerender(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-wall')).toHaveClass('is-active');
    mockPathname.mockReturnValue('/messages');
    view.rerender(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-messages')).toHaveClass('is-active');
    mockPathname.mockReturnValue('/business/register');
    view.rerender(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-register')).toHaveClass('is-active');
  });
});
