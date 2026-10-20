import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WallView } from '@/components/wall-view';
import type { WallFeed, WallPost } from '@/lib/types';

const mockGetWall = jest.fn();
const mockCreate = jest.fn();
const mockLike = jest.fn();
const mockDelete = jest.fn();
const mockDeleteAd = jest.fn();
const mockPin = jest.fn();
const mockUpload = jest.fn();
const mockUploadVoice = jest.fn();
const mockEdit = jest.fn();
const mockUpdateAd = jest.fn();
const mockGetCats = jest.fn();

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
    getAdCategories: (...args: unknown[]) => mockGetCats(...args),
    getWall: (...args: unknown[]) => mockGetWall(...args),
    createWallPost: (...args: unknown[]) => mockCreate(...args),
    likeWallPost: (...args: unknown[]) => mockLike(...args),
    deleteWallPost: (...args: unknown[]) => mockDelete(...args),
    deleteAd: (...args: unknown[]) => mockDeleteAd(...args),
    pinWallPost: (...args: unknown[]) => mockPin(...args),
    uploadImage: (...args: unknown[]) => mockUpload(...args),
    uploadVoice: (...args: unknown[]) => mockUploadVoice(...args),
    editWallPost: (...args: unknown[]) => mockEdit(...args),
    updateAd: (...args: unknown[]) => mockUpdateAd(...args),
  };
});

const city = { id: 1, slug: 'sample-city', name: 'شهر نمونه' };

const CATS = [
  { id: 1, name: 'املاک', slug: 'real-estate', icon: '🏠', color: '#16a34a' },
  { id: 2, name: 'وسایل نقلیه', slug: 'car', icon: '🚗', color: '#2563eb' },
  { id: 3, name: 'موبایل', slug: 'mobile', icon: '📱', color: '#7c3aed' },
  { id: 4, name: 'لوازم خانه', slug: 'home-appliances', icon: '🛋️', color: '#ea580c' },
  { id: 5, name: 'استخدام', slug: 'jobs', icon: '💼', color: '#0891b2' },
  { id: 6, name: 'خدمات', slug: 'services', icon: '🛠️', color: '#ca8a04' },
  { id: 7, name: 'خرید و فروش', slug: 'market', icon: '🛒', color: '#db2777' },
  { id: 8, name: 'سایر', slug: 'other', icon: '✨', color: '#6b7280' },
];

function makePost(overrides: Partial<WallPost> = {}): WallPost {
  return {
    id: 1,
    content: 'سلام شهر',
    imageUrl: null,
    voiceUrl: null,
    editedAt: null,
    ad: null,
    business: null,
    isPinned: false,
    likeCount: 2,
    likedByMe: false,
    canDelete: true,
    canEdit: true,
    canPin: false,
    isMine: true,
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
      isMine: false,
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
    mockGetCats.mockResolvedValue(CATS);
  });

  it('renders the room header: wall name + member and message counts', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-room');
    expect(screen.getByTestId('wall-room-name')).toHaveTextContent('دیوار شهر شهر نمونه');
    expect(screen.getByTestId('wall-room-members')).toHaveTextContent('۱۲ عضو');
    expect(screen.getByTestId('wall-room-members')).toHaveTextContent('۳۴ پیام');
    // the city/change-city pills are gone — six category shortcuts took their place
    const strip = screen.getByTestId('wall-cats');
    expect(strip).toBeTruthy();
    expect(screen.getByTestId('wall-cat-real-estate')).toHaveAttribute('href', '/ads?category=real-estate');
    expect(screen.getByTestId('wall-cat-car')).toHaveAttribute('href', '/ads?category=car');
    expect(screen.getByTestId('wall-cat-services')).toHaveAttribute('href', '/ads?category=services');
    expect(screen.queryByTestId('wall-cat-market')).toBeNull(); // only the first six are shown
    expect(screen.queryByTestId('wall-change-city')).toBeNull();
    expect(screen.queryByTestId('wall-back-city')).toBeNull();
    // the site header/nav are gone in the room → the room's own top bar carries
    // the single 🏠 entry back to that city's home page (the composer dock has
    // none any more: it is a WhatsApp-style bar now)
    expect(screen.getByTestId('wall-home-top')).toHaveAttribute('href', '/city/sample-city');
    expect(screen.queryByTestId('wall-home-bottom')).toBeNull();
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
            canRemove: true,
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
          canRemove: true,
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

  it('lays the composer out like WhatsApp and puts «ثبت آگهی فروش» under the bar', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-input');

    // one bar: attach · [sticker + input] · mic/send flip
    const bar = document.querySelector('.wall-bar');
    expect(bar).toBeTruthy();
    for (const id of ['wall-photo-btn', 'wall-input', 'wall-sticker-btn', 'wall-voice-btn', 'wall-send']) {
      expect(bar).toContainElement(screen.getByTestId(id));
    }
    // the sticker button lives inside the rounded input pill, WhatsApp-style
    expect(screen.getByTestId('wall-input').closest('.wall-bar__field')).not.toBeNull();
    expect(screen.getByTestId('wall-sticker-btn')).toHaveAttribute('aria-label', 'استیکرها');

    // the ad entry left the bar: it is a text row under the send box now
    const adBtn = screen.getByTestId('wall-ad-btn');
    expect(adBtn).toHaveAttribute('href', '/ads/new');
    expect(adBtn).toHaveTextContent('ثبت آگهی فروش');
    expect(adBtn.className).toContain('wall-adbtn');
    expect(bar).not.toContainElement(adBtn);
    expect(screen.getByTestId('wall-composer')).toContainElement(adBtn);
    // the old two-row dock and its city-home button are gone
    expect(document.querySelector('.wall-composer__bridge')).toBeNull();
    expect(document.querySelector('.wall-quick')).toBeNull();
    expect(screen.queryByTestId('wall-home-bottom')).toBeNull();
  });

  it('opens the sticker tray, switches packs and sends a sticker in one tap', async () => {
    mockCreate.mockResolvedValue(makePost({ id: 21, content: '🐱' }));
    render(<WallView city={city} />);
    fireEvent.click(await screen.findByTestId('wall-sticker-btn'));
    expect(await screen.findByTestId('wall-sticker-panel')).toBeInTheDocument();

    // the default pack shows its stickers
    expect(screen.getByTestId('wall-sticker-grin')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('wall-sticker-pack-animals'));
    expect(screen.getByTestId('wall-sticker-cat')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('wall-sticker-cat'));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({ cityId: 1, content: '🐱', replyToId: undefined }),
    );
    // the tray closes and the feed refreshes after sending
    await waitFor(() => expect(screen.queryByTestId('wall-sticker-panel')).toBeNull());
    await waitFor(() => expect(mockGetWall).toHaveBeenCalledTimes(2));
  });

  it('renders a sticker message as a big sticker instead of a text bubble', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [makePost({ id: 22, content: '🔥' })],
      pinned: null,
    });
    render(<WallView city={city} />);

    const sticker = await screen.findByTestId('wall-sticker-post-22');
    expect(sticker).toHaveTextContent('🔥');
    expect(sticker.className).toContain('wall-sticker');
    // ordinary messages still use the text/bubble styling
    expect(document.querySelector('.wall-post__text')).toBeNull();
  });

  it('paints own messages as bubbles and leaves other people\'s as room posts', async () => {
    render(<WallView city={city} />);
    const mine = await screen.findByTestId('wall-post-1');
    const theirs = screen.getByTestId('wall-post-2');
    expect(mine.className).toContain('wall-post--own');
    expect(theirs.className).not.toContain('wall-post--own');
  });

  it('gives the composer labelled attachment tools and no caption under the dock', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-input');
    expect(screen.getByTestId('wall-photo-btn')).toHaveAttribute('aria-label', 'افزودن عکس به پیام');
    expect(screen.getByTestId('wall-voice-btn')).toHaveAttribute('aria-label', 'ضبط پیام صوتی');
    expect(screen.getByTestId('wall-send')).toHaveAttribute('aria-label', 'ارسال پیام');
    // the 4-day caption under the dock is gone (it only added dead space)
    expect(screen.queryByTestId('wall-media-hint')).not.toBeInTheDocument();
  });

  it('flips the send arrow so it points the way the message goes (left)', async () => {
    render(<WallView city={city} />);
    await screen.findByTestId('wall-input');
    expect(document.querySelector('.wall-sendbtn__arrow')).toBeTruthy();
  });

  it('previews the picked photo in the composer before sending', async () => {
    // jsdom has no object-URL implementation — the preview only needs a src
    const create = jest.fn(() => 'blob:preview');
    const revoke = jest.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    render(<WallView city={city} />);
    const picker = await screen.findByTestId('wall-image');
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    fireEvent.change(picker, { target: { files: [file] } });

    const chip = await screen.findByTestId('wall-image-chip');
    expect(chip.querySelector('img')).toHaveAttribute('src', 'blob:preview');
    expect(chip).toHaveTextContent('photo.png');
    // sending is possible with just the photo
    expect(screen.getByTestId('wall-send')).toBeEnabled();
    fireEvent.click(screen.getByTestId('wall-image-remove'));
    await waitFor(() => expect(screen.queryByTestId('wall-image-chip')).toBeNull());
  });

  it('shows the error with a retry button when the feed fails (no endless loading)', async () => {
    mockGetWall.mockRejectedValue(new Error('خطای داخلی سرور'));
    render(<WallView city={city} />);

    const box = await screen.findByTestId('wall-error');
    expect(box).toHaveTextContent('خطای داخلی سرور');
    expect(screen.queryByText(/در حال بارگذاری دیوار/)).not.toBeInTheDocument();

    // a healthy retry renders the wall
    mockGetWall.mockResolvedValue(feed);
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(await screen.findByTestId('wall')).toBeInTheDocument();
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

  it('keeps a way back to the city from the login gate and the error state', async () => {
    const { ApiError } = require('@/lib/api');
    mockGetWall.mockRejectedValueOnce(new ApiError(401, 'وارد شوید'));
    const { unmount } = render(<WallView city={city} />);
    expect(await screen.findByTestId('wall-gate')).toBeInTheDocument();
    expect(screen.getByTestId('wall-home-gate')).toHaveAttribute('href', '/city/sample-city');
    unmount();

    mockGetWall.mockRejectedValueOnce(new ApiError(500, 'خطای داخلی سرور'));
    render(<WallView city={city} />);
    expect(await screen.findByTestId('wall-error')).toBeInTheDocument();
    expect(screen.getByTestId('wall-home-error')).toHaveAttribute('href', '/city/sample-city');
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

  it('renders the daily GOLD-business promo card with a link to its page', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [
        makePost({
          id: 30,
          content: '🌅 صبح بخیر شهر! کافه ساحلی روزتان را شروع می‌کند',
          business: {
            id: 40,
            name: 'کافه ساحلی',
            address: 'بلوار ساحلی',
            logoUrl: '/api/v1/files/media/2026/10/logo.webp',
            category: { name: 'کافه', icon: '☕', color: '#c9971f' },
          },
        }),
      ],
      pinned: null,
    });
    render(<WallView city={city} />);

    const card = await screen.findByTestId('wall-promocard-30');
    expect(card).toHaveAttribute('href', '/business/40');
    expect(card).toHaveTextContent('کافه ساحلی');
    expect(card).toHaveTextContent('کافه');
    expect(card).toHaveTextContent('بلوار ساحلی');
    expect(card).toHaveTextContent('طلایی');
    expect(card.querySelector('img')).toHaveAttribute(
      'src',
      '/api/v1/files/media/2026/10/logo.thumb.webp',
    );
    // the promo copy itself sits above the card
    expect(screen.getByTestId('wall-post-30')).toHaveTextContent('صبح بخیر');
  });

  it('offers «حذف آگهی» on an ad card for its owner or a moderator', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeleteAd.mockResolvedValue({ id: 42, status: 'DELETED', removedFiles: 2 });
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [
        makePost({
          id: 45,
          canDelete: true,
          ad: {
            id: 42,
            title: 'ویلای شمال',
            description: 'نزدیک ساحل',
            price: 900_000_000,
            image: '/api/v1/files/media/2026/10/ad.webp',
            status: 'APPROVED',
            canRemove: true,
          },
        }),
      ],
      pinned: null,
    });
    render(<WallView city={city} />);

    const btn = await screen.findByTestId('wall-addelete-45');
    expect(btn).toHaveAttribute('aria-label', 'حذف کامل آگهی');
    // the card itself keeps working as a link
    expect(screen.getByTestId('wall-adcard-45')).toHaveAttribute('href', '/ad/42');

    fireEvent.click(btn);
    expect(mockDeleteAd).toHaveBeenCalledWith(42);
    await waitFor(() => expect(mockDeleteAd).toHaveBeenCalled());
  });

  it('does not offer ad deletion to a stranger', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [
        makePost({
          id: 46,
          canDelete: false,
          ad: {
            id: 42,
            title: 'ویلای شمال',
            description: 'نزدیک ساحل',
            price: null,
            image: null,
            status: 'APPROVED',
            canRemove: false,
          },
        }),
      ],
      pinned: null,
    });
    render(<WallView city={city} />);
    await screen.findByTestId('wall-adcard-46');
    expect(screen.queryByTestId('wall-addelete-46')).not.toBeInTheDocument();
  });

  it('swaps the pinned banner for one short red row when the pinned post is an ad', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      pinned: makePost({
        id: 9,
        content: 'آگهی سنجاق‌شده',
        isPinned: true,
        canPin: true,
        ad: {
          id: 42,
          title: 'ویلای شمال',
          description: 'نزدیک ساحل',
          price: 900_000_000,
          image: null,
          status: 'APPROVED',
          canRemove: false,
        },
      }),
    });
    render(<WallView city={city} />);

    const bar = await screen.findByTestId('wall-pinnedbar');
    expect(bar).toHaveAttribute('href', '/ad/42');
    expect(bar).toHaveTextContent('دیوار شهر');
    expect(bar).toHaveTextContent('ویلای شمال');
    expect(bar.className).toContain('wall-pinnedbar');
    // the heavyweight pinned card is not rendered for an ad
    expect(screen.queryByTestId('wall-pinned')).not.toBeInTheDocument();
  });

  it('opens the inline ad editor from the ✏️ button and saves through PATCH /ads/:id', async () => {
    mockUpdateAd.mockResolvedValue({
      id: 42,
      title: 'ویلای شمال ویرایش‌شده',
      status: 'APPROVED',
      price: 850_000_000,
      imageUrls: [],
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [
        makePost({
          id: 45,
          ad: {
            id: 42,
            title: 'ویلای شمال',
            description: 'نزدیک ساحل و جنگل',
            price: 900_000_000,
            image: null,
            status: 'APPROVED',
            canRemove: false,
          },
        }),
      ],
      pinned: null,
    });
    render(<WallView city={city} />);

    fireEvent.click(await screen.findByTestId('wall-adedit-45'));
    const box = screen.getByTestId('wall-adedit-title');
    expect(box).toHaveValue('ویلای شمال');

    fireEvent.change(screen.getByTestId('wall-adedit-title'), {
      target: { value: 'ویلای شمال ویرایش‌شده' },
    });
    fireEvent.change(screen.getByTestId('wall-adedit-price'), { target: { value: '۸۵۰٬۰۰۰٬۰۰۰' } });
    fireEvent.click(screen.getByTestId('wall-adedit-save'));

    await waitFor(() =>
      expect(mockUpdateAd).toHaveBeenCalledWith(42, {
        title: 'ویلای شمال ویرایش‌شده',
        description: 'نزدیک ساحل و جنگل',
        price: 850000000,
      }),
    );
  });

  it('validates the ad title before calling the API', async () => {
    mockGetWall.mockResolvedValue({
      ...feed,
      posts: [
        makePost({
          id: 47,
          ad: {
            id: 43,
            title: 'کوتاه',
            description: 'توضیحات کافی برای آگهی',
            price: null,
            image: null,
            status: 'APPROVED',
            canRemove: false,
          },
        }),
      ],
      pinned: null,
    });
    render(<WallView city={city} />);

    fireEvent.click(await screen.findByTestId('wall-adedit-47'));
    fireEvent.change(screen.getByTestId('wall-adedit-title'), { target: { value: 'کم' } });
    fireEvent.click(screen.getByTestId('wall-adedit-save'));

    expect(await screen.findByTestId('wall-adedit-error')).toHaveTextContent('عنوان باید حداقل ۴ حرف باشد');
    expect(mockUpdateAd).not.toHaveBeenCalled();
  });

  it('hold-to-edit: pressing your own message opens its editor', async () => {
    jest.useFakeTimers();
    try {
      render(<WallView city={city} />);
      const post = await screen.findByTestId('wall-post-1');
      expect(screen.queryByTestId('wall-editbox-1')).not.toBeInTheDocument();

      fireEvent.pointerDown(post);
      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(screen.getByTestId('wall-editbox-1')).toBeInTheDocument();
      expect(screen.getByTestId('wall-edit-input')).toHaveValue('سلام شهر');
    } finally {
      jest.useRealTimers();
    }
  });

  it('hold-to-edit: releasing early does nothing', async () => {
    jest.useFakeTimers();
    try {
      render(<WallView city={city} />);
      const post = await screen.findByTestId('wall-post-1');

      fireEvent.pointerDown(post);
      fireEvent.pointerUp(post);
      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(screen.queryByTestId('wall-editbox-1')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('hold-to-edit never opens on someone else\'s message', async () => {
    jest.useFakeTimers();
    try {
      render(<WallView city={city} />);
      const post = await screen.findByTestId('wall-post-2');

      fireEvent.pointerDown(post);
      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(screen.queryByTestId('wall-editbox-2')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
