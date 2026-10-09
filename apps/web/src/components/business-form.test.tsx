import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, refresh: jest.fn() }),
}));

const mockGetTokens = jest.fn();
const mockGetBusinessCategories = jest.fn();
const mockGetProfile = jest.fn();
const mockGetMyBusinesses = jest.fn();
const mockCreateBusiness = jest.fn();
const mockUploadImage = jest.fn();
const mockApiGet = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  api: { get: (path: string) => mockApiGet(path) },
  getTokens: () => mockGetTokens(),
  getBusinessCategories: () => mockGetBusinessCategories(),
  getProfile: () => mockGetProfile(),
  getMyBusinesses: () => mockGetMyBusinesses(),
  createBusiness: (body: unknown) => mockCreateBusiness(body),
  uploadImage: (file: unknown, entity?: string) => mockUploadImage(file, entity),
}));

// Leaflet cannot run in jsdom — the picker itself has its own coverage.
jest.mock('@/components/business-map-picker', () => ({
  BusinessMapPicker: () => <div data-testid="business-map" />,
}));

import { BusinessForm } from '@/components/business-form';
import { ApiError } from '@/lib/api';

const categories = [
  { id: 3, name: 'رستوران', slug: 'restaurant', icon: '🍽️' },
  { id: 5, name: 'نانوایی', slug: 'bakery', icon: '🥖' },
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

const cities = [
  {
    id: 1,
    name: 'شهر نمونه',
    slug: 'jam',
    isFeatured: true,
    latitude: 27.83,
    longitude: 52.32,
    province: { id: 1, name: 'استان نمونه', slug: 'sample-province' },
  },
];

/**
 * Stand exactly ON step `target` (0-based): fills the name, picks the first
 * category, then advances only as far as needed. The caller clicks «بعدی»
 * itself when it wants to leave that step.
 */
async function goToStep(target: number) {
  fireEvent.change(await screen.findByTestId('field-name'), { target: { value: 'نانوایی امید' } });
  fireEvent.click(screen.getByTestId('step-next')); // 0 → 1 (basic → category)
  fireEvent.click((await screen.findAllByTestId('category-option'))[0]);
  if (target <= 1) return;
  fireEvent.click(screen.getByTestId('step-next')); // 1 → 2 (category → contact)
  if (target <= 2) return;
  fireEvent.click(screen.getByTestId('step-next')); // 2 → 3 (contact → images)
  if (target <= 3) return;
  fireEvent.click(screen.getByTestId('step-next')); // 3 → 4 (images → location)
}

describe('BusinessForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGetBusinessCategories.mockResolvedValue(categories);
    mockGetProfile.mockResolvedValue(profile);
    mockGetMyBusinesses.mockResolvedValue([]);
    mockApiGet.mockResolvedValue(cities);
    mockCreateBusiness.mockResolvedValue({ id: 9, name: 'نانوایی امید', status: 'PENDING' });
    mockUploadImage.mockReset();
  });

  it('redirects to login when there is no session', () => {
    mockGetTokens.mockReturnValue(null);
    render(<BusinessForm />);
    expect(mockReplace).toHaveBeenCalledWith('/login?next=/businesses/new');
    expect(mockCreateBusiness).not.toHaveBeenCalled();
  });

  it('blocks the first step until a valid name is entered', async () => {
    render(<BusinessForm />);
    fireEvent.click(await screen.findByTestId('step-next'));
    expect(await screen.findByTestId('form-error')).toHaveTextContent('حداقل ۳ حرف');
    expect(screen.getByTestId('wizard-step-0')).toHaveAttribute('aria-current', 'step');
    expect(mockCreateBusiness).not.toHaveBeenCalled();
  });

  it('requires a category before the contact step', async () => {
    render(<BusinessForm />);
    fireEvent.change(await screen.findByTestId('field-name'), { target: { value: 'نانوایی امید' } });
    fireEvent.click(screen.getByTestId('step-next'));
    // step 1 with nothing selected
    fireEvent.click(await screen.findByTestId('step-next'));
    expect(await screen.findByTestId('form-error')).toHaveTextContent('دسته‌بندی کسب‌وکار را انتخاب کنید');
    expect(screen.getByTestId('wizard-step-1')).toHaveAttribute('aria-current', 'step');
  });

  it('warns when the profile has no selected city', async () => {
    mockGetProfile.mockResolvedValue({ ...profile, cityId: null, hasSelectedCity: false });
    render(<BusinessForm />);
    expect(await screen.findByRole('status')).toHaveTextContent('برای ثبت کسب‌وکار ابتدا شهر خودت را انتخاب کن');
    expect(screen.getByRole('link', { name: 'انتخاب شهر' })).toHaveAttribute('href', '/');
  });

  it('submits all steps with the city-center pin and shows the pending status', async () => {
    render(<BusinessForm />);
    await goToStep(3);
    fireEvent.click(await screen.findByTestId('step-next')); // location step

    // default pin = city center from /cities (never hard-coded)
    expect(await screen.findByTestId('coord-readout')).toHaveTextContent('27.830000, 52.320000');

    fireEvent.click(screen.getByTestId('submit-business'));
    await waitFor(() => expect(mockCreateBusiness).toHaveBeenCalledTimes(1));
    expect(mockCreateBusiness).toHaveBeenCalledWith({
      categoryId: 3,
      name: 'نانوایی امید',
      phone: '09123456789',
      latitude: 27.83,
      longitude: 52.32,
    });
    expect(mockUploadImage).not.toHaveBeenCalled();

    // moderation result: never "published" — always pending, plan comes later
    expect(await screen.findByTestId('business-success')).toBeInTheDocument();
    expect(screen.getByTestId('business-status')).toHaveTextContent('در انتظار تأیید');
    expect(screen.getByTestId('choose-plan')).toHaveAttribute('href', '/plans?business=9');
  });

  it('sends no coordinates after «ثبت بدون موقعیت»', async () => {
    render(<BusinessForm />);
    await goToStep(3);
    fireEvent.click(await screen.findByTestId('step-next'));
    fireEvent.click(await screen.findByTestId('drop-point'));
    expect(screen.getByTestId('coord-readout')).toHaveTextContent('بدون موقعیت');

    fireEvent.click(screen.getByTestId('submit-business'));
    await waitFor(() => expect(mockCreateBusiness).toHaveBeenCalledTimes(1));
    const body = mockCreateBusiness.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('latitude');
    expect(body).not.toHaveProperty('longitude');
  });

  it('uploads the logo as business media and passes its id', async () => {
    mockUploadImage.mockResolvedValue({ id: 11, url: '/api/v1/files/biz/logo.webp' });
    render(<BusinessForm />);
    await goToStep(2);

    // images step
    fireEvent.click(await screen.findByTestId('step-next'));
    const logo = new File(['x'], 'logo.png', { type: 'image/png' });
    fireEvent.change(await screen.findByTestId('field-logo'), { target: { files: [logo] } });

    fireEvent.click(await screen.findByTestId('step-next'));
    fireEvent.click(await screen.findByTestId('submit-business'));

    await waitFor(() => expect(mockCreateBusiness).toHaveBeenCalledTimes(1));
    expect(mockUploadImage).toHaveBeenCalledWith(logo, 'business');
    expect(mockCreateBusiness.mock.calls[0][0]).toMatchObject({ logoMediaId: 11 });
  });

  it('surfaces a duplicate-request 409 from the API', async () => {
    mockCreateBusiness.mockRejectedValue(
      new ApiError(409, 'یک درخواست کسب‌وکار شما در این شهر در انتظار بررسی است'),
    );
    render(<BusinessForm />);
    await goToStep(3);
    fireEvent.click(await screen.findByTestId('step-next'));

    fireEvent.click(screen.getByTestId('submit-business'));
    expect(await screen.findByTestId('form-error')).toHaveTextContent('در انتظار بررسی است');
    expect(screen.queryByTestId('business-success')).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-business')).toBeEnabled();
  });

  it('lists my businesses with their moderation status', async () => {
    mockGetMyBusinesses.mockResolvedValue([
      {
        id: 7,
        name: 'کافه آرامش',
        status: 'PENDING',
        createdAt: '2026-10-02T10:00:00.000Z',
        cityName: 'شهر نمونه',
        categoryName: 'کافه',
        categoryIcon: '☕',
      },
    ]);
    render(<BusinessForm />);

    expect(await screen.findByTestId('my-business')).toHaveTextContent('کافه آرامش');
    expect(screen.getByTestId('my-business')).toHaveTextContent('در انتظار تأیید');
    expect(screen.getByTestId('my-business')).toHaveTextContent('شهر نمونه');
  });
});
