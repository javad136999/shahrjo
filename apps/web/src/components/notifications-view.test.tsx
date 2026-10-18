import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  getNotifications,
  getTokens,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api';
import { NotificationsView } from './notifications-view';

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(public readonly status: number, message: string) { super(message); }
  },
  getNotifications: jest.fn(),
  getTokens: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
  NOTIFICATIONS_CHANGED_EVENT: 'shahrjo:notifications-changed',
}));

const mockedGetNotifications = jest.mocked(getNotifications);
const mockedGetTokens = jest.mocked(getTokens);
const mockedMarkRead = jest.mocked(markNotificationRead);
const mockedMarkAllRead = jest.mocked(markAllNotificationsRead);

const sample = {
  id: 7,
  type: 'AD_APPROVED',
  title: 'آگهی تأیید شد',
  body: 'آگهی شما منتشر شده است.',
  data: null,
  readAt: null,
  createdAt: '2026-10-18T12:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTokens.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
  mockedGetNotifications.mockResolvedValue([sample]);
});

describe('NotificationsView', () => {
  it('asks logged-out visitors to sign in', async () => {
    mockedGetTokens.mockReturnValue(null);
    render(<NotificationsView />);

    expect(await screen.findByText('برای دیدن اعلان‌ها ابتدا وارد حساب خود شوید.')).toBeInTheDocument();
    expect(mockedGetNotifications).not.toHaveBeenCalled();
  });

  it('loads the inbox and marks a single notification as read', async () => {
    mockedMarkRead.mockResolvedValue({ ...sample, readAt: '2026-10-18T13:00:00.000Z' });
    render(<NotificationsView />);

    expect(await screen.findByText('آگهی تأیید شد')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'علامت‌گذاری «آگهی تأیید شد» به‌عنوان خوانده‌شده' }));

    await waitFor(() => expect(mockedMarkRead).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'علامت‌گذاری «آگهی تأیید شد» به‌عنوان خوانده‌شده' })).not.toBeInTheDocument());
  });

  it('marks all unread notifications as read', async () => {
    mockedMarkAllRead.mockResolvedValue({ updated: 1 });
    render(<NotificationsView />);

    expect(await screen.findByText('آگهی تأیید شد')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'خواندن همه' }));

    await waitFor(() => expect(mockedMarkAllRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'خواندن همه' })).not.toBeInTheDocument());
  });
});
