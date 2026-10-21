import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { BusinessManage } from '@/components/business-manage';

const mockGet = jest.fn();
const mockCats = jest.fn();
const mockUpdateBiz = jest.fn();
const mockCreateProduct = jest.fn();
const mockUpdateProduct = jest.fn();
const mockDeleteProduct = jest.fn();
const mockUpload = jest.fn();
const mockTokens = jest.fn();

// a stable router object: an unstable one would re-run the load effect on
// every render (in production useRouter returns the same instance).
const mockRouter = { replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  getMyBusiness: (id: number) => mockGet(id),
  getBusinessCategories: () => mockCats(),
  updateMyBusiness: (...args: unknown[]) => mockUpdateBiz(...args),
  createBusinessProduct: (...args: unknown[]) => mockCreateProduct(...args),
  updateBusinessProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  deleteBusinessProduct: (...args: unknown[]) => mockDeleteProduct(...args),
  uploadImage: (file: File) => mockUpload(file),
  uploadBusinessImage: (file: File) => mockUpload(file),
  getTokens: () => mockTokens(),
}));

const BUSINESS = {
  id: 4,
  name: 'کافه آزمون',
  slug: 'cafe-1',
  status: 'APPROVED',
  subscriptionTier: 'FREE',
  logoUrl: null,
  rating: 0,
  ratingCount: 0,
  productCount: 1,
  pinned: true,
  category: { id: 3, name: 'کافه', icon: '☕' },
  description: 'توضیح',
  phone: '09120000000',
  address: 'خیابان اصلی',
  latitude: 27.1,
  longitude: 56.2,
  categoryId: 3,
  products: [
    {
      id: 11,
      name: 'لاته',
      description: 'با شیر',
      price: 250_000,
      imageUrl: null,
      section: 'نوشیدنی',
      isAvailable: true,
    },
  ],
};

describe('BusinessManage (ویرایش + منو و محصولات)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockGet.mockResolvedValue(BUSINESS);
    mockCats.mockResolvedValue([{ id: 3, name: 'کافه', slug: 'cafe', icon: '☕' }]);
  });

  it('loads the owned business and saves edited profile fields', async () => {
    mockUpdateBiz.mockResolvedValue({ ...BUSINESS, name: 'کافه تازه' });
    render(<BusinessManage id={4} />);

    const name = await screen.findByTestId('biz-name');
    expect(name).toHaveValue('کافه آزمون');
    fireEvent.change(name, { target: { value: 'کافه تازه' } });
    fireEvent.click(screen.getByTestId('biz-save'));

    await waitFor(() =>
      expect(mockUpdateBiz).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ name: 'کافه تازه', categoryId: 3 }),
      ),
    );
    expect(await screen.findByTestId('biz-notice')).toHaveTextContent('ذخیره شد');
  });

  it('opens the menu tab directly when the owner chooses the products shortcut', async () => {
    render(<BusinessManage id={4} initialTab="menu" />);
    expect(await screen.findByTestId('biz-menu')).toBeInTheDocument();
    expect(screen.getByTestId('biz-tab-menu')).toHaveClass('is-active');
    expect(screen.queryByTestId('biz-info-form')).not.toBeInTheDocument();
  });

  it('groups the menu by section and adds a product with a Rial price', async () => {
    mockCreateProduct.mockResolvedValue({
      id: 12,
      name: 'اسپرسو',
      description: null,
      price: 180_000,
      imageUrl: null,
      section: 'نوشیدنی',
      isAvailable: true,
    });
    render(<BusinessManage id={4} />);
    await screen.findByTestId('biz-name');

    fireEvent.click(screen.getByTestId('biz-tab-menu'));
    expect(screen.getByTestId('biz-menu-group-نوشیدنی')).toHaveTextContent('لاته');

    fireEvent.click(screen.getByTestId('product-new'));
    fireEvent.change(screen.getByTestId('product-name'), { target: { value: 'اسپرسو' } });
    fireEvent.change(screen.getByTestId('product-section'), { target: { value: 'نوشیدنی' } });
    fireEvent.change(screen.getByTestId('product-price'), { target: { value: '180000' } });
    fireEvent.click(screen.getByTestId('product-save'));

    await waitFor(() =>
      expect(mockCreateProduct).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ name: 'اسپرسو', section: 'نوشیدنی', price: 180_000 }),
      ),
    );
    expect(await screen.findByTestId('biz-product-12')).toHaveTextContent('اسپرسو');
  });

  it('sends «توافقی» as no price and deletes a product', async () => {
    mockCreateProduct.mockResolvedValue({
      id: 13,
      name: 'سفارشی',
      description: null,
      price: null,
      imageUrl: null,
      section: '',
      isAvailable: true,
    });
    mockDeleteProduct.mockResolvedValue({ id: 11, removed: true });
    render(<BusinessManage id={4} />);
    await screen.findByTestId('biz-name');
    fireEvent.click(screen.getByTestId('biz-tab-menu'));

    fireEvent.click(screen.getByTestId('product-new'));
    fireEvent.change(screen.getByTestId('product-name'), { target: { value: 'سفارشی' } });
    fireEvent.click(screen.getByTestId('product-save'));
    await waitFor(() =>
      expect(mockCreateProduct).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ price: undefined, section: '' }),
      ),
    );

    fireEvent.click(await screen.findByTestId('product-delete-11'));
    await waitFor(() => expect(mockDeleteProduct).toHaveBeenCalledWith(4, 11));
  });

  it('opens the edit form pre-filled from an existing row', async () => {
    render(<BusinessManage id={4} />);
    await screen.findByTestId('biz-name');
    fireEvent.click(screen.getByTestId('biz-tab-menu'));
    fireEvent.click(screen.getByTestId('product-edit-11'));

    expect(screen.getByTestId('product-name')).toHaveValue('لاته');
    expect(screen.getByTestId('product-price')).toHaveValue('250000');
  });

  it('uploads the profile photo through the compressed route and saves its URL', async () => {
    mockUpload.mockResolvedValue({ id: 55, url: '/api/v1/files/media/2026/10/logo.webp' });
    mockUpdateBiz.mockResolvedValue({ ...BUSINESS, logoUrl: '/api/v1/files/media/2026/10/logo.webp' });

    render(<BusinessManage id={4} />);
    await screen.findByTestId('biz-name');

    const file = new File(['x'], 'logo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('biz-logo-input'), { target: { files: [file] } });

    expect(await screen.findByTestId('biz-logo-preview')).toBeInTheDocument();
    expect(mockUpload).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getByTestId('biz-save'));
    await waitFor(() =>
      expect(mockUpdateBiz).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ logoUrl: '/api/v1/files/media/2026/10/logo.webp' }),
      ),
    );
  });

  it('rejects an oversized business photo before sending it to the server', async () => {
    render(<BusinessManage id={4} />);
    await screen.findByTestId('biz-name');
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('biz-logo-input'), { target: { files: [oversized] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('حداکثر ۱۰ مگابایت');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('clears the photo by sending an empty logoUrl', async () => {
    mockGet.mockResolvedValue({ ...BUSINESS, logoUrl: '/api/v1/files/media/2026/10/old.webp' });
    mockUpdateBiz.mockResolvedValue({ ...BUSINESS, logoUrl: null });

    render(<BusinessManage id={4} />);
    await screen.findByTestId('biz-logo-preview');
    fireEvent.click(screen.getByTestId('biz-logo-remove'));
    expect(screen.queryByTestId('biz-logo-preview')).toBeNull();

    fireEvent.click(screen.getByTestId('biz-save'));
    await waitFor(() =>
      expect(mockUpdateBiz).toHaveBeenCalledWith(4, expect.objectContaining({ logoUrl: '' })),
    );
  });
});
