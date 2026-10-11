import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: jest.fn(),
}));

const mockGetTokens = jest.fn();
const mockListDmConversations = jest.fn();
const mockStartDm = jest.fn();
const mockGetDmMessages = jest.fn();
const mockSendDmMessage = jest.fn();
const mockUploadImage = jest.fn();
const mockGetPublicProfile = jest.fn();

jest.mock('@/lib/api', () => ({
  DM_CHANGED_EVENT: 'shahrjo:dm-changed',
  getTokens: () => mockGetTokens(),
  listDmConversations: () => mockListDmConversations(),
  startDm: (userId: number) => mockStartDm(userId),
  getDmMessages: (id: number, before?: string) => mockGetDmMessages(id, before),
  sendDmMessage: (id: number, body: unknown) => mockSendDmMessage(id, body),
  uploadImage: (file: File) => mockUploadImage(file),
  getPublicProfile: (userId: number) => mockGetPublicProfile(userId),
}));

import MessagesPage from '@/app/messages/page';

const mockUseSearchParams = useSearchParams as unknown as jest.Mock;

const convo = {
  id: 77,
  peer: { id: 9, fullName: 'مرضیه مرادی', avatarUrl: null },
  unreadCount: 2,
  lastMessageAt: '2026-10-11T08:00:00.000Z',
  lastMessage: { id: 5, senderId: 9, body: 'سلام!', imageUrl: null, createdAt: '2026-10-11T08:00:00.000Z' },
};

describe('MessagesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams(''));
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockListDmConversations.mockResolvedValue([convo]);
    mockStartDm.mockResolvedValue(convo);
    mockGetDmMessages.mockResolvedValue({ messages: [], nextBefore: null });
    mockGetPublicProfile.mockResolvedValue({
      id: 9,
      fullName: 'مرضیه مرادی',
      avatarUrl: null,
      cityName: 'شهر نمونه',
      memberSince: '2026-01-15T10:00:00.000Z',
      isSelf: false,
    });
    mockSendDmMessage.mockResolvedValue({
      id: 6,
      senderId: 4,
      body: 'سلام عالیه',
      imageUrl: null,
      createdAt: '2026-10-11T09:00:00.000Z',
    });
  });

  it('asks signed-out visitors to log in', async () => {
    mockGetTokens.mockReturnValue(null);
    render(<MessagesPage />);

    expect(await screen.findByTestId('dm-gate')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ورود با موبایل' })).toHaveAttribute(
      'href',
      '/login?next=/messages',
    );
  });

  it('lists conversations with the unread badge', async () => {
    render(<MessagesPage />);

    expect(await screen.findByTestId('dm-item-77')).toHaveTextContent('مرضیه مرادی');
    expect(screen.getByTestId('dm-item-77')).toHaveTextContent('سلام!');
    expect(await screen.findByTestId('dm-item-badge-77')).toHaveTextContent('2');
    expect(screen.getByTestId('dm-placeholder')).toBeInTheDocument();
  });

  it('opens a conversation from the ?peer= deep link (wall username tap)', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('peer=9'));
    render(<MessagesPage />);

    await waitFor(() => expect(mockStartDm).toHaveBeenCalledWith(9));
    expect(await screen.findByTestId('dm-thread-name')).toHaveTextContent('مرضیه مرادی');
    expect(mockGetDmMessages).toHaveBeenCalledWith(77, undefined);
    // the query is dropped so a refresh doesn't re-run the deep link
    expect(mockReplace).toHaveBeenCalledWith('/messages');
  });

  it('opens the peer profile card from the thread header', async () => {
    render(<MessagesPage />);
    fireEvent.click(await screen.findByTestId('dm-item-77'));

    fireEvent.click(await screen.findByTestId('dm-thread-peer'));
    expect(await screen.findByTestId('user-profile-modal')).toBeInTheDocument();
    expect(mockGetPublicProfile).toHaveBeenCalledWith(9);
  });

  it('sends a typed message into the open conversation', async () => {
    render(<MessagesPage />);
    fireEvent.click(await screen.findByTestId('dm-item-77'));

    const input = await screen.findByTestId('dm-input');
    fireEvent.change(input, { target: { value: 'سلام عالیه' } });
    fireEvent.click(screen.getByTestId('dm-send'));

    await waitFor(() =>
      expect(mockSendDmMessage).toHaveBeenCalledWith(77, { body: 'سلام عالیه' }),
    );
  });
});
