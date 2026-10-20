import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

// Leaflet is initialised dynamically — stub it so the test only verifies wiring.
jest.mock('leaflet', () => {
  const makeLayer = () => {
    const layer: Record<string, unknown> = {};
    layer.addTo = jest.fn(() => layer);
    layer.setLatLng = jest.fn(() => layer);
    layer.getBounds = jest.fn(() => ({ isValid: () => false }));
    layer.remove = jest.fn(() => layer);
    return layer;
  };
  const mapInstance = { setView: jest.fn(), fitBounds: jest.fn(), remove: jest.fn(), on: jest.fn() };
  return {
    __esModule: true,
    default: { map: jest.fn(() => mapInstance), tileLayer: jest.fn(() => makeLayer()), geoJSON: jest.fn(() => makeLayer()), marker: jest.fn(() => makeLayer()) },
    map: jest.fn(() => mapInstance),
    tileLayer: jest.fn(() => makeLayer()),
    geoJSON: jest.fn(() => makeLayer()),
    marker: jest.fn(() => makeLayer()),
  };
});

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const mockTokens = jest.fn();
const mockApiGet = jest.fn();
const mockCategories = jest.fn();
const mockCityMap = jest.fn();
const mockUpload = jest.fn();
const mockCreate = jest.fn();

jest.mock('@/lib/api', () => ({
  __esModule: true,
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getTokens: () => mockTokens(),
  api: { get: (path: string) => mockApiGet(path) },
  getBusinessCategories: () => mockCategories(),
  getCityMap: (slug: string) => mockCityMap(slug),
  uploadBusinessImage: (file: File) => mockUpload(file),
  adminCreateBusiness: (body: unknown) => mockCreate(body),
}));

import { AdminBusinessCreate } from '@/components/admin-business-create';

const CITIES = [
  { id: 5, name: 'شهر نمونه', slug: 'sample-city', isFeatured: true, latitude: 29.59, longitude: 52.58, province: { id: 1, name: 'استان نمونه', slug: 'sample-province' } },
];
const CATS = [{ id: 3, name: 'نانوایی', slug: 'bakery', icon: '🥖' }];
const MAP_DATA = {
  city: { id: 5, name: 'شهر نمونه', slug: 'sample-city', latitude: 29.59, longitude: 52.58, boundary: null },
  businesses: [],
};

describe('AdminBusinessCreate (ثبت دستی کسب‌وکار — صفحهٔ جدا)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mockApiGet.mockResolvedValue(CITIES);
    mockCategories.mockResolvedValue(CATS);
    mockCityMap.mockResolvedValue(MAP_DATA);
    mockUpload.mockResolvedValue({ url: '/api/v1/files/media/logo.webp' });
    mockCreate.mockResolvedValue({ id: 90, name: 'نانوایی مرکزی', status: 'APPROVED', subscriptionTier: 'GOLD' });
  });

  it('sends a guest to login instead of opening the form', () => {
    mockTokens.mockReturnValue(null);
    render(<AdminBusinessCreate />);
    expect(replace).toHaveBeenCalledWith('/login?next=/admin/business/new');
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('loads the pickers and frames the map on the selected city', async () => {
    render(<AdminBusinessCreate />);
    expect(await screen.findByTestId('admin-create-page')).toBeInTheDocument();
    expect(mockApiGet).toHaveBeenCalledWith('/cities');
    expect(mockCategories).toHaveBeenCalled();

    // no city yet → no map and a hint to pick one first
    expect(screen.queryByTestId('nb-map')).not.toBeInTheDocument();

    fireEvent.change(await screen.findByTestId('nb-city'), { target: { value: '5' } });
    expect(mockCityMap).toHaveBeenCalledWith('sample-city');
    expect(await screen.findByTestId('nb-map')).toBeInTheDocument();
    expect(screen.getByTestId('nb-pin')).toHaveTextContent('روی نقشه کلیک کن');
  });

  it('takes the pin from a map click and sends it with the signup', async () => {
    render(<AdminBusinessCreate />);
    fireEvent.change(await screen.findByTestId('nb-city'), { target: { value: '5' } });
    await screen.findByTestId('nb-map');

    // the leaflet mock records the click handler on the last created map
    const leaflet = require('leaflet');
    const instance = leaflet.map.mock.results[leaflet.map.mock.results.length - 1].value;
    const onClick = instance.on.mock.calls.find((c: unknown[]) => c[0] === 'click')?.[1];
    expect(onClick).toBeDefined();
    act(() => onClick({ latlng: { lat: 29.6, lng: 52.5 } }));

    expect(screen.getByTestId('nb-pin')).toHaveTextContent('29.6');

    fireEvent.change(screen.getByTestId('nb-name'), { target: { value: 'نانوایی مرکزی' } });
    fireEvent.change(screen.getByTestId('nb-category'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('nb-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      name: 'نانوایی مرکزی',
      cityId: 5,
      categoryId: 3,
      latitude: 29.6,
      longitude: 52.5,
    });
  });

  it('publishes with the chosen tier and months (no payment step)', async () => {
    render(<AdminBusinessCreate />);
    await screen.findByTestId('admin-create-page');

    fireEvent.change(screen.getByTestId('nb-city'), { target: { value: '5' } });
    await screen.findByTestId('nb-map');
    const leaflet = require('leaflet');
    const instance = leaflet.map.mock.results[leaflet.map.mock.results.length - 1].value;
    const onClick = instance.on.mock.calls.find((call: unknown[]) => call[0] === 'click')?.[1];
    act(() => onClick({ latlng: { lat: 29.6, lng: 52.5 } }));
    fireEvent.change(screen.getByTestId('nb-category'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('nb-name'), { target: { value: 'کافه گلد' } });

    // months only exist once a paid tier is on
    expect(screen.queryByTestId('nb-months')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('nb-tier-GOLD').querySelector('input')!);
    fireEvent.change(await screen.findByTestId('nb-months'), { target: { value: '6' } });

    fireEvent.click(screen.getByTestId('nb-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ tier: 'GOLD', months: 6 });

    // success screen replaces the form
    expect(await screen.findByTestId('admin-create-done')).toHaveTextContent('کسب‌وکار منتشر شد');
    expect(screen.getByRole('link', { name: 'مشاهده روی نقشهٔ شهر' })).toHaveAttribute('href', '/city/sample-city#map');
    expect(screen.getByRole('link', { name: /بازگشت به پنل مدیریت/ })).toHaveAttribute('href', '/admin');
  });

  it('requires a map pin before publishing so the business cannot be invisible on the city map', async () => {
    render(<AdminBusinessCreate />);
    await screen.findByTestId('admin-create-page');

    fireEvent.change(screen.getByTestId('nb-city'), { target: { value: '5' } });
    await screen.findByTestId('nb-map');
    fireEvent.change(screen.getByTestId('nb-category'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('nb-name'), { target: { value: 'نانوایی مرکزی' } });
    fireEvent.click(screen.getByTestId('nb-submit'));

    expect(await screen.findByTestId('admin-create-error')).toHaveTextContent('موقعیت کسب‌وکار را روی نقشه انتخاب کن');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('requires name, category and city before publishing', async () => {
    render(<AdminBusinessCreate />);
    await screen.findByTestId('admin-create-page');

    fireEvent.click(screen.getByTestId('nb-submit'));

    expect(await screen.findByTestId('admin-create-error')).toHaveTextContent('نام، دسته‌بندی و شهر الزامی است');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
