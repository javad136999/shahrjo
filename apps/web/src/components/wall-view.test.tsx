import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WallView } from '@/components/wall-view';
import type { WallFeed, WallPost } from '@/lib/types';

const mockGetWall = jest.fn();
const mockCreate = jest.fn();
const mockLike = jest.fn();
const mockDelete = jest.fn();
const mockPin = jest.fn();
const mockUpload = jest.fn();

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    getWall: (...args: unknown[]) => mockGetWall(...args),
    createWallPost: (...args: unknown[]) => mockCreate(...args),
    likeWallPost: (...args: unknown[]) => mockLike(...args),
    deleteWallPost: (...args: unknown[]) => mockDelete(...args),
    pinWallPost: (...args: unknown[]) => mockPin(...args),
    uploadImage: (...args: unknown[]) => mockUpload(...args),
  };
});

const city = { id: 1, slug: 'sample-city', name: 'شهر نمونه' };

function makePost(overrides: Partial<WallPost> = {}): WallPost {
  return {
    id: 1,
    content: 'سلام شهر',
    imageUrl: null,
    isPinned: false,
    likeCount: 2,
    likedByMe: false,
    canDelete: true,
    canPin: false,
    createdAt: new Date().toISOString(),
    user: { id: 4, name: 'علی', avatarUrl: null },
    replyTo: null,
    ...overrides,
  };
}

const feed: WallFeed = {
  posts: [
    makePost(),
    makePost({
      id: 2,
      content: 'خوش اومدی!',
      canDelete: false,
      likeCount: 0,
      likedByMe: true,
      replyTo: { id: 1, content: 'سلام شهر', userName: 'علی' },
    }),
  ],
  pinned: makePost({ id: 9, content: 'پیام سنجاق‌شده', isPinned: true, canPin: true }),
  nextBefore: null,
};

describe('WallView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWall.mockResolvedValue(feed);
  });

  it('renders post images from the thumbnail variant (lists never fetch the full file)', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [makePost({ id: 5, imageUrl: '/api/v1/files/media/2026/10/abc.webp' })],
      pinned: null,
    });
    render(<WallView city={city} />);
    expect(await screen.findByTestId('wall-post-5')).toBeInTheDocument();
    const img = document.querySelector('.wall-post__image');
    expect(img).toHaveAttribute('src', '/api/v1/files/media/2026/10/abc.thumb.webp');
  });

  it('renders the feed: posts, reply quote, like counts and the pinned banner', async () => {
    render(<WallView city={city} />);
    expect(await screen.findByTestId('wall-post-1')).toHaveTextContent('سلام شهر');
    expect(screen.getByTestId('wall-post-2')).toHaveTextContent('خوش اومدی!');
    expect(screen.getByTestId('wall-reply-2')).toHaveTextContent('علی: سلام شهر');
    expect(screen.getByTestId('wall-pinned')).toHaveTextContent('پیام سنجاق‌شده');
    expect(screen.getByTestId('wall-like-1')).toHaveTextContent('۲');
    expect(screen.getByTestId('wall-post-1')).toHaveTextContent('همین الان');
    expect(mockGetWall).toHaveBeenCalledWith('sample-city');
  });

  it('shows the login gate on 401 instead of the feed', async () => {
    const { ApiError } = jest.requireMock('@/lib/api');
    mockGetWall.mockRejectedValue(new ApiError(401, 'unauthorized'));
    render(<WallView city={city} />);
    const gate = await screen.findByTestId('wall-gate');
    expect(gate).toHaveTextContent('دیوار شهر شهر نمونه');
    expect(screen.getByRole('link', { name: 'ورود با موبایل' })).toHaveAttribute(
      'href',
      '/login?next=/wall',
    );
    expect(screen.queryByTestId('wall-input')).not.toBeInTheDocument();
  });

  it('toggles a like optimistically and syncs the server count', async () => {
    mockLike.mockResolvedValue({ liked: true, likeCount: 3 });
    render(<WallView city={city} />);
    const btn = await screen.findByTestId('wall-like-1');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(mockLike).toHaveBeenCalledWith(1);
    await waitFor(() => expect(btn).toHaveTextContent('۳'));
  });

  it('publishes a new post through the composer and clears the input', async () => {
    mockCreate.mockResolvedValue(makePost({ id: 12, content: 'پیام تازه' }));
    render(<WallView city={city} />);
    const input = await screen.findByTestId('wall-input');
    fireEvent.change(input, { target: { value: 'پیام تازه' } });
    expect(screen.getByTestId('wall-send')).toBeEnabled();
    fireEvent.click(screen.getByTestId('wall-send'));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        cityId: 1,
        content: 'پیام تازه',
        replyToId: undefined,
        imageIds: undefined,
      }),
    );
    await waitFor(() => expect(input).toHaveValue(''));
    // feed reloaded after publishing
    await waitFor(() => expect(mockGetWall).toHaveBeenCalledTimes(2));
  });

  it('keeps the send button disabled while the text is empty', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-input');
    expect(screen.getByTestId('wall-send')).toBeDisabled();
  });

  it('deletes own posts after confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockDelete.mockResolvedValue({ id: 1, deleted: true });
    render(<WallView city={city} />);
    fireEvent.click(await screen.findByTestId('wall-delete-1'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
    confirmSpy.mockRestore();
  });

  it('offers pinning only for operators (canPin)', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-post-1');
    expect(screen.getByTestId('wall-pin-9')).toBeInTheDocument(); // pinned post, operator view
    expect(screen.queryByTestId('wall-pin-1')).not.toBeInTheDocument();
  });

  it('starts a reply from the ↩ button', async () => {
    render(<WallView city={city} />);
    fireEvent.click(await screen.findByTestId('wall-reply-btn-1'));
    expect(screen.getByText(/پاسخ به/)).toHaveTextContent('علی');
    // publishing then carries the reply target
    mockCreate.mockResolvedValue(makePost({ id: 13 }));
    fireEvent.change(screen.getByTestId('wall-input'), { target: { value: 'پاسخ' } });
    fireEvent.click(screen.getByTestId('wall-send'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ replyToId: 1 })));
  });
});
