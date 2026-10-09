import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WallView } from '@/components/wall-view';
import type { WallFeed, WallPost } from '@/lib/types';

const mockGetWall = jest.fn();
const mockCreate = jest.fn();
const mockLike = jest.fn();
const mockDelete = jest.fn();
const mockPin = jest.fn();
const mockUpload = jest.fn();
const mockUploadVoice = jest.fn();
const mockEdit = jest.fn();

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
    uploadVoice: (...args: unknown[]) => mockUploadVoice(...args),
    editWallPost: (...args: unknown[]) => mockEdit(...args),
  };
});

const city = { id: 1, slug: 'sample-city', name: 'شهر نمونه' };

function makePost(overrides: Partial<WallPost> = {}): WallPost {
  return {
    id: 1,
    content: 'سلام شهر',
    imageUrl: null,
    voiceUrl: null,
    editedAt: null,
    ad: null,
    isPinned: false,
    likeCount: 2,
    likedByMe: false,
    canDelete: true,
    canEdit: true,
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
      canEdit: false,
      likeCount: 0,
      likedByMe: true,
      replyTo: { id: 1, content: 'سلام شهر', userName: 'علی' },
    }),
  ],
  pinned: makePost({ id: 9, content: 'پیام سنجاق‌شده', isPinned: true, canPin: true }),
  nextBefore: null,
  room: { name: 'دیوار شهر شهر نمونه', memberCount: 12, messageCount: 34 },
};

describe('WallView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWall.mockResolvedValue(feed);
  });

  it('filters the feed with the in-wall search and can close it', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-room');
    expect(screen.getByTestId('wall-post-1')).toBeInTheDocument();
    expect(screen.getByTestId('wall-post-2')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('wall-search'), { target: { value: 'خوش' } });
    expect(screen.getByTestId('wall-post-2')).toBeInTheDocument();
    expect(screen.queryByTestId('wall-post-1')).not.toBeInTheDocument();
    // the pinned banner is a separate strip — it stays visible while searching
    expect(screen.getByTestId('wall-pinned')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('wall-search'), { target: { value: 'چیزی که نیست' } });
    expect(screen.getByTestId('wall-search-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('wall-post-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('wall-search-close'));
    expect(screen.getByTestId('wall-post-1')).toBeInTheDocument();
    expect(screen.queryByTestId('wall-search-empty')).not.toBeInTheDocument();
  });

  it('renders the room header: wall name + member and message counts', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-room');
    expect(screen.getByTestId('wall-room-name')).toHaveTextContent('دیوار شهر شهر نمونه');
    expect(screen.getByTestId('wall-room-members')).toHaveTextContent('۱۲ عضو');
    expect(screen.getByTestId('wall-room-members')).toHaveTextContent('۳۴ پیام');
    expect(screen.getByTestId('wall-change-city')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('wall-back-city')).toHaveAttribute('href', '/city/sample-city');
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

  it('plays voice notes inline', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [makePost({ id: 6, content: '', voiceUrl: '/api/v1/files/voice/2026/10/abc.webm' })],
      pinned: null,
    });
    render(<WallView city={city} />);
    const audio = await screen.findByTestId('wall-voice-6');
    expect(audio).toHaveAttribute('src', '/api/v1/files/voice/2026/10/abc.webm');
    expect(audio.tagName).toBe('AUDIO');
  });

  it('renders a republished ad as a card linking to the ad detail page', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [
        makePost({
          id: 7,
          content: '🌟 پیشنهاد ویژه صبح — ویلا',
          ad: {
            id: 42,
            title: 'ویلای شمال',
            description: 'ویلای دلباز نزدیک ساحل با حیاط بزرگ',
            price: 900_000_000,
            image: '/api/v1/files/media/2026/10/ad.webp',
            status: 'APPROVED',
          },
        }),
      ],
      pinned: null,
    });
    render(<WallView city={city} />);
    const card = await screen.findByTestId('wall-adcard-7');
    expect(card).toHaveAttribute('href', '/ad/42');
    expect(card).toHaveTextContent('ویلای شمال');
    expect(card).toHaveTextContent('نزدیک ساحل');
    expect(card).toHaveTextContent('ریال');
    const img = card.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/v1/files/media/2026/10/ad.thumb.webp');
    // promoted posts are system-authored: no personal edit button
    expect(screen.queryByTestId('wall-edit-7')).not.toBeInTheDocument();
  });

  it('shows a pending ad preview in the wall without linking to a hidden detail page', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [makePost({
        id: 19,
        content: 'آگهی تازه در دیوار شهر',
        ad: {
          id: 43,
          title: 'دوچرخه سالم',
          description: 'دوچرخه تمیز و آماده استفاده',
          price: 12_000_000,
          image: null,
          status: 'PENDING',
        },
      })],
      pinned: null,
    });
    render(<WallView city={city} />);
    const card = await screen.findByTestId('wall-adcard-19');
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveTextContent('دوچرخه تمیز و آماده استفاده');
    expect(card).toHaveTextContent('در انتظار تأیید');
    expect(card).not.toHaveAttribute('href');
  });

  it('offers the ad-post entry on the right of the composer', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-input');
    const adBtn = screen.getByTestId('wall-ad-btn');
    expect(adBtn).toHaveAttribute('href', '/ads/new');
    expect(adBtn).toHaveTextContent('ثبت آگهی');
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
        voiceMediaId: undefined,
      }),
    );
    await waitFor(() => expect(input).toHaveValue(''));
    // feed reloaded after publishing
    await waitFor(() => expect(mockGetWall).toHaveBeenCalledTimes(2));
  });

  it('keeps the send button disabled while nothing is composed', async () => {
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

  it('edits own message inline and shows the edited marker', async () => {
    mockEdit.mockResolvedValue(makePost({ id: 1, content: 'متن تازه', editedAt: '2026-10-08T10:00:00.000Z' }));
    render(<WallView city={city} />);
    fireEvent.click(await screen.findByTestId('wall-edit-1'));
    const box = screen.getByTestId('wall-edit-input');
    expect(box).toHaveValue('سلام شهر');
    fireEvent.change(box, { target: { value: 'متن تازه' } });
    fireEvent.click(screen.getByTestId('wall-edit-save'));
    await waitFor(() => expect(mockEdit).toHaveBeenCalledWith(1, 'متن تازه'));
    expect(await screen.findByTestId('wall-edited-1')).toHaveTextContent('ویرایش شد');
  });

  it('does not offer editing on someone else\'s message', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-post-2');
    expect(screen.getByTestId('wall-edit-1')).toBeInTheDocument();
    expect(screen.queryByTestId('wall-edit-2')).not.toBeInTheDocument();
  });
});
