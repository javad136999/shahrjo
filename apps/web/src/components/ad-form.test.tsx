import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, refresh: jest.fn() }),
}));

const mockGetTokens = jest.fn();
const mockGetAdCategories = jest.fn();
const mockGetProfile = jest.fn();
const mockGetMyAds = jest.fn();
const mockCreateAd = jest.fn();
const mockUploadImage = jest.fn();
const mockGetLocalCity = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getTokens: () => mockGetTokens(),
  getAdCategories: () => mockGetAdCategories(),
  getProfile: () => mockGetProfile(),
  getMyAds: () => mockGetMyAds(),
  createAd: (body: unknown) => mockCreateAd(body),
  uploadImage: (file: unknown) => mockUploadImage(file),
  getLocalCity: () => mockGetLocalCity(),
}));

import { AdForm } from '@/components/ad-form';
import { ApiError } from '@/lib/api';

const categories = [
  { id: 3, name: 'لوازم', slug: 'goods', icon: null, color: null },
  { id: 4, name: 'خانه', slug: 'homes', icon: '🏠', color: null },
];

const profile = {
  id: 1,
  phone: '09123456789',
  fullName: null,
  avatarUrl: null,
  cityId: 1,
  hasSelectedCity: true,
  status: 'ACTIVE',
  roles: [],
  createdAt: '2026-10-01T10:00:00.000Z',
};

/** Fill the form with valid values (category/title/description). */
function fillValidFields() {
  fireEvent.change(screen.getByLabelText('دسته‌بندی'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('عنوان آگهی'), { target: { value: 'کولر گازی نو' } });
  fireEvent.change(screen.getByLabelText('توضیحات'), {
    target: { value: 'کولر گازی نو با گارانتی معتبر' },
  });
}

describe('AdForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGetAdCategories.mockResolvedValue(categories);
    mockGetProfile.mockResolvedValue(profile);
    mockGetMyAds.mockResolvedValue([]);
    mockGetLocalCity.mockReturnValue({ id: 1, slug: 'sample-city', name: 'شهر نمونه' });
    mockCreateAd.mockResolvedValue({
      id: 55,
      title: 'کولر گازی نو',
      status: 'PENDING',
      price: null,
      imageUrls: [],
      createdAt: '2026-10-03T10:00:00.000Z',
      expiresAt: '2026-11-02T10:00:00.000Z',
    });
    mockUploadImage.mockReset();
  });

  it('redirects to the login page when there is no session', () => {
    mockGetTokens.mockReturnValue(null);
    render(<AdForm />);
    expect(mockReplace).toHaveBeenCalledWith('/login?next=/ads/new');
    expect(mockCreateAd).not.toHaveBeenCalled();
  });

  it('requires a category before submitting', async () => {
    render(<AdForm />);
    fireEvent.click(screen.getByRole('button', { name: 'ارسال' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('دسته‌بندی آگهی را انتخاب کنید');
    expect(mockCreateAd).not.toHaveBeenCalled();
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric price without calling the API', async () => {
    render(<AdForm />);
    await screen.findByRole('option', { name: 'لوازم' });
    fillValidFields();
    fireEvent.change(screen.getByLabelText(/قیمت/), { target: { value: 'قیمت توافقی' } });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('قیمت باید عدد صحیح');
    expect(mockCreateAd).not.toHaveBeenCalled();
  });

  it('warns (and links to city selection) when no city is selected on the profile', async () => {
    mockGetProfile.mockResolvedValue({ ...profile, cityId: null, hasSelectedCity: false });
    render(<AdForm />);

    expect(await screen.findByRole('status')).toHaveTextContent('برای ثبت آگهی ابتدا شهر خودت را انتخاب کن');
    expect(screen.getByRole('link', { name: 'انتخاب شهر' })).toHaveAttribute('href', '/');
  });

  it('uploads each image then creates the ad with Persian-digit price parsed', async () => {
    mockUploadImage
      .mockResolvedValueOnce({ id: 11, url: '/api/v1/files/ads/a.jpg' })
      .mockResolvedValueOnce({ id: 22, url: '/api/v1/files/ads/b.png' });

    render(<AdForm />);
    await screen.findByRole('option', { name: 'لوازم' });
    fillValidFields();
    fireEvent.change(screen.getByLabelText(/قیمت/), { target: { value: '۱٬۲۰۰٬۰۰۰' } });

    const first = new File(['a'], 'one.jpg', { type: 'image/jpeg' });
    const second = new File(['b'], 'two.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/تصاویر/), { target: { files: [first, second] } });

    fireEvent.click(screen.getByRole('button', { name: 'ارسال' }));

    await waitFor(() => expect(mockCreateAd).toHaveBeenCalledTimes(1));
    expect(mockUploadImage).toHaveBeenCalledTimes(2);
    expect(mockUploadImage).toHaveBeenNthCalledWith(1, first);
    expect(mockUploadImage).toHaveBeenNthCalledWith(2, second);
    expect(mockCreateAd).toHaveBeenCalledWith({
      categoryId: 3,
      title: 'کولر گازی نو',
      description: 'کولر گازی نو با گارانتی معتبر',
      price: 1200000,
      phone: '09123456789',
      imageIds: [11, 22],
    });

    // moderation result: never "published" — always pending
    expect(await screen.findByTestId('ad-success')).toBeInTheDocument();
    expect(screen.getByTestId('ad-status')).toHaveTextContent('در انتظار تأیید');
    expect(screen.getByRole('link', { name: 'مشاهده دیوار شهر' })).toHaveAttribute('href', '/wall');
    expect(mockPush).toHaveBeenCalledWith('/wall');
  });

  it('sends no price field when the price is left empty (negotiated)', async () => {
    render(<AdForm />);
    await screen.findByRole('option', { name: 'لوازم' });
    fillValidFields();

    fireEvent.click(screen.getByRole('button', { name: 'ارسال' }));

    await waitFor(() => expect(mockCreateAd).toHaveBeenCalledTimes(1));
    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockCreateAd.mock.calls[0][0]).not.toHaveProperty('price');
    expect(mockCreateAd.mock.calls[0][0]).not.toHaveProperty('imageIds');
  });

  it('surfaces API errors from a rejected submission', async () => {
    mockCreateAd.mockRejectedValue(
      new ApiError(429, 'سقف ثبت آگهی در ساعت پر شده است؛ کمی بعد دوباره تلاش کنید'),
    );
    render(<AdForm />);
    await screen.findByRole('option', { name: 'لوازم' });
    fillValidFields();

    fireEvent.click(screen.getByRole('button', { name: 'ارسال' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('سقف ثبت آگهی در ساعت پر شده است');
    expect(screen.queryByTestId('ad-success')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeEnabled();
  });

  it('lists the owner ads with their moderation status', async () => {
    mockGetMyAds.mockResolvedValue([
      {
        id: 77,
        title: 'آگهی در انتظار',
        status: 'PENDING',
        price: null,
        coverUrl: null,
        imageCount: 2,
        rejectedReason: null,
        createdAt: '2026-10-02T10:00:00.000Z',
        expiresAt: null,
      },
      {
        id: 78,
        title: 'آگهی رد شده',
        status: 'REJECTED',
        price: 5000,
        coverUrl: null,
        imageCount: 0,
        rejectedReason: 'محتوای نامناسب',
        createdAt: '2026-10-01T10:00:00.000Z',
        expiresAt: null,
      },
    ]);
    render(<AdForm />);

    expect(await screen.findByTestId('my-ad-77')).toHaveTextContent('در انتظار تأیید');
    expect(screen.getByTestId('my-ad-78')).toHaveTextContent('رد شده');
    expect(screen.getByTestId('my-ad-78')).toHaveTextContent('علت رد: محتوای نامناسب');
  });
});
