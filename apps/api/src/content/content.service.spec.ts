import type { PrismaService } from '../prisma/prisma.service';
import { ContentService } from './content.service';

function makeService() {
  const prisma = {
    city: { findFirst: jest.fn() },
    news: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    ad: { findMany: jest.fn() },
    business: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
  const service = new ContentService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('ContentService.newsDetail', () => {
  it('serves only PUBLISHED articles and counts a view', async () => {
    const { service, prisma } = makeService();
    prisma.news.findFirst.mockResolvedValue({
      id: 1,
      title: 'خبر نمونه',
      slug: 'sample-news',
      excerpt: 'خلاصه',
      body: 'متن کامل خبر',
      coverUrl: null,
      publishedAt: new Date('2026-10-01'),
      city: { name: 'شهر نمونه', slug: 'sample-city' },
      category: { name: 'عمومی', slug: 'general' },
      viewCount: 4,
    });
    prisma.news.update.mockResolvedValue({ viewCount: 5 });

    const detail = await service.newsDetail('sample-news');

    expect(prisma.news.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: 'sample-news',
      status: 'PUBLISHED',
    });
    expect(prisma.news.update.mock.calls[0][0].data).toEqual({ viewCount: { increment: 1 } });
    expect(detail.body).toBe('متن کامل خبر');
    expect(detail.viewCount).toBe(5);
    expect(detail.city.slug).toBe('sample-city');
  });

  it('404s for unknown or unpublished articles', async () => {
    const { service, prisma } = makeService();
    prisma.news.findFirst.mockResolvedValue(null);

    await expect(service.newsDetail('draft-news')).rejects.toThrow('خبر یافت نشد');
    expect(prisma.news.update).not.toHaveBeenCalled();
  });
});

describe('ContentService.businessDetail', () => {
  it('serves only APPROVED businesses and counts a view', async () => {
    const { service, prisma } = makeService();
    prisma.business.findFirst.mockResolvedValue({
      id: 30,
      name: 'کسب‌وکار نمونه',
      slug: 'sample-business',
      description: null,
      logoUrl: null,
      coverUrl: null,
      phone: '09120000000',
      address: 'خیابان اصلی',
      latitude: null,
      longitude: null,
      workingHours: null,
      socialLinks: null,
      rating: 4.26,
      ratingCount: 12,
      viewCount: 9,
      subscriptionTier: 'GOLD',
      createdAt: new Date('2026-01-01'),
      city: { name: 'شهر نمونه', slug: 'sample-city' },
      category: { name: 'رستوران', slug: 'restaurants', icon: '🍽️', color: '#0e7a5f' },
      // menu rows travel with the profile (map → business shows the products)
      products: [
        {
          id: 5,
          name: 'لاته',
          description: 'با شیر',
          price: 250_000n,
          imageUrl: '/media/latte.webp',
          section: 'نوشیدنی',
          isAvailable: true,
        },
      ],
    });
    prisma.business.update.mockResolvedValue({ viewCount: 10 });

    const detail = await service.businessDetail(30);

    expect(prisma.business.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 30,
      status: 'APPROVED',
    });
    expect(prisma.business.update.mock.calls[0][0].data).toEqual({ viewCount: { increment: 1 } });
    expect(detail.viewCount).toBe(10);
    expect(detail.subscriptionTier).toBe('GOLD');
    expect(detail.category.icon).toBe('🍽️');
    // BigInt Rial must leave the API as a plain number
    expect(detail.products).toHaveLength(1);
    expect(detail.products[0]).toMatchObject({ name: 'لاته', section: 'نوشیدنی', price: 250_000 });
  });

  it('ships an empty menu array when the owner registered no products', async () => {
    const { service, prisma } = makeService();
    prisma.business.findFirst.mockResolvedValue({
      id: 31,
      name: 'بدون منو',
      slug: 'no-menu',
      description: null,
      logoUrl: null,
      coverUrl: null,
      phone: null,
      address: null,
      latitude: null,
      longitude: null,
      workingHours: null,
      socialLinks: null,
      rating: 0,
      ratingCount: 0,
      viewCount: 1,
      subscriptionTier: 'FREE',
      createdAt: new Date('2026-01-01'),
      city: { name: 'شهر نمونه', slug: 'sample-city' },
      category: { name: 'فروشگاه', slug: 'shop', icon: '🛍️', color: null },
      products: [],
    });
    prisma.business.update.mockResolvedValue({ viewCount: 2 });

    const detail = await service.businessDetail(31);

    expect(detail.products).toEqual([]);
  });

  it('404s for unknown or unapproved businesses', async () => {
    const { service, prisma } = makeService();
    prisma.business.findFirst.mockResolvedValue(null);

    await expect(service.businessDetail(999)).rejects.toThrow('کسب‌وکار یافت نشد');
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
});

describe('ContentService city resolution', () => {
  it('maps an active city slug to its id', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.news.findMany.mockResolvedValue([]);

    await service.news('sample-city');

    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { slug: 'sample-city', isActive: true, province: { isActive: true } },
      select: { id: true },
    });
  });

  it('404s for unknown or inactive cities on every feed', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue(null);

    await expect(service.news('nope')).rejects.toThrow('شهر یافت نشد');
    await expect(service.ads('nope')).rejects.toThrow('شهر یافت نشد');
    await expect(service.businesses('nope')).rejects.toThrow('شهر یافت نشد');
    expect(prisma.news.findMany).not.toHaveBeenCalled();
    expect(prisma.ad.findMany).not.toHaveBeenCalled();
    expect(prisma.business.findMany).not.toHaveBeenCalled();
  });
});

describe('ContentService.news', () => {
  it('returns only PUBLISHED news, newest first, respecting limit', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.news.findMany.mockResolvedValue([]);

    await service.news('sample-city', 5);

    const args = prisma.news.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ cityId: 7, status: 'PUBLISHED' });
    expect(args.take).toBe(5);
    expect(args.orderBy).toEqual([{ publishedAt: 'desc' }, { createdAt: 'desc' }]);
  });
});

describe('ContentService.ads', () => {
  it('returns APPROVED, non-expired ads and converts BigInt price to Number', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.ad.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'آگهی نمونه',
        price: 125000000n, // BigInt as stored by Prisma
        viewCount: 10,
        publishedAt: new Date('2026-10-01'),
        category: { name: 'دسته', slug: 'cat' },
        images: [{ url: '/files/1.jpg' }],
      },
      {
        id: 2,
        title: 'بدون قیمت',
        price: null,
        viewCount: 0,
        publishedAt: null,
        category: { name: 'دسته', slug: 'cat' },
        images: [],
      },
    ]);

    const result = await service.ads('sample-city');

    const args = prisma.ad.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ cityId: 7, status: 'APPROVED' });
    expect(args.where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);

    // JSON-safe: plain numbers, cover image flattened
    expect(result[0].price).toBe(125000000);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].coverUrl).toBe('/files/1.jpg');
    expect(result[1].price).toBeNull();
    expect(result[1].coverUrl).toBeNull();
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
  it('filters by category slug when one is given (category shortcuts)', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.ad.findMany.mockResolvedValue([]);

    await service.ads('sample-city', 8, 'real-estate');
    const filtered = prisma.ad.findMany.mock.calls[0][0];
    expect(filtered.where).toMatchObject({
      cityId: 7,
      status: 'APPROVED',
      category: { slug: 'real-estate' },
    });

    await service.ads('sample-city', 8);
    const plain = prisma.ad.findMany.mock.calls[1][0];
    expect(plain.where.category).toBeUndefined();
  });


describe('ContentService.businesses', () => {
  it('returns APPROVED businesses in showcase order', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.business.findMany.mockResolvedValue([]);

    await service.businesses('sample-city');

    const args = prisma.business.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ cityId: 7, status: 'APPROVED' });
    expect(args.orderBy).toEqual([{ showcasePriority: 'asc' }, { rating: 'desc' }]);
    expect(args.select).toMatchObject({ subscriptionTier: true, phone: true });
  });
});

describe('ContentService.menuShowcase', () => {
  it('returns approved menu businesses with two compact product previews and JSON-safe prices', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.business.findMany.mockResolvedValue([
      {
        id: 18,
        name: 'کافه نمونه',
        slug: 'sample-cafe',
        logoUrl: null,
        subscriptionTier: 'SILVER',
        category: { name: 'کافه', slug: 'cafe', icon: '☕', color: '#167b5c' },
        products: [{ id: 9, name: 'لاته', price: 250_000n, imageUrl: '/media/latte.webp', isAvailable: true }],
      },
    ]);

    const result = await service.menuShowcase('sample-city', 200);
    const args = prisma.business.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ cityId: 7, status: 'APPROVED', products: { some: {} } });
    expect(args.take).toBe(200);
    expect(args.select.products).toMatchObject({ take: 2, select: { id: true, name: true, price: true, imageUrl: true } });
    expect(result[0].products[0].price).toBe(250_000);
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(args.select.phone).toBeUndefined();
  });
});

describe('ContentService.showcase (Phase 9)', () => {
  it('returns only paid-tier, enabled, APPROVED businesses in showcase order', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.business.findMany.mockResolvedValue([]);

    await service.showcase('sample-city', 10);

    const args = prisma.business.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      cityId: 7,
      status: 'APPROVED',
      subscriptionTier: { in: ['GOLD', 'SILVER'] },
      showcaseEnabled: true,
    });
    expect(args.orderBy).toEqual([{ showcasePriority: 'asc' }, { rating: 'desc' }]);
    expect(args.take).toBe(10);
    expect(args.select).toMatchObject({
      logoUrl: true,
      subscriptionTier: true,
      category: { select: { name: true, slug: true, icon: true, color: true } },
    });
    // no phone leak in the marquee payload
    expect(args.select.phone).toBeUndefined();
  });

  it('404s for unknown cities', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue(null);
    await expect(service.showcase('nope')).rejects.toThrow('شهر یافت نشد');
    expect(prisma.business.findMany).not.toHaveBeenCalled();
  });
});

describe('ContentService.map (Phase 9)', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ elements: [] }),
    } as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns the center, boundary and pinned APPROVED businesses', async () => {
    const { service, prisma } = makeService();
    const boundary = { type: 'Polygon', coordinates: [[[52.2, 27.7], [52.5, 27.7], [52.5, 27.9], [52.2, 27.9], [52.2, 27.7]]] };
    prisma.city.findFirst.mockResolvedValue({
      id: 7,
      name: 'شهر نمونه',
      slug: 'sample-city',
      latitude: 27.83,
      longitude: 52.32,
      boundary,
    });
    prisma.business.findMany.mockResolvedValue([
      { id: 40, name: 'رستوران ویترین', slug: 'rest', latitude: 27.831, longitude: 52.321, subscriptionTier: 'GOLD', category: { name: 'رستوران', icon: '🍽', color: '#0e7a5f' } },
      { id: 41, name: 'پین شهر دیگر', slug: 'foreign-pin', latitude: 29.59, longitude: 52.58, subscriptionTier: 'FREE', category: { name: 'فروشگاه', icon: '🛍', color: null } },
      { id: 42, name: 'مختصات خراب', slug: 'invalid-pin', latitude: Number.NaN, longitude: 52.32, subscriptionTier: 'FREE', category: { name: 'فروشگاه', icon: '🛍', color: null } },
    ]);

    const data = await service.map('sample-city');

    const args = prisma.business.findMany.mock.calls[0][0];
    // only APPROVED businesses that actually have coordinates reach the map
    expect(args.where).toMatchObject({
      cityId: 7,
      status: 'APPROVED',
      latitude: { not: null },
      longitude: { not: null },
    });
    expect(args.orderBy).toEqual([{ showcasePriority: 'asc' }, { rating: 'desc' }]);
    expect(data.city).toMatchObject({ id: 7, slug: 'sample-city', latitude: 27.83, boundary });
    expect(data.businesses).toHaveLength(1);
    expect(data.businesses[0]).toMatchObject({ id: 40, latitude: 27.831, longitude: 52.321, subscriptionTier: 'GOLD' });
    expect(data.amenities).toEqual([]);
    expect(() => JSON.stringify(data)).not.toThrow();
  });

  it('returns named hospitals, clinics and parking from OSM inside the city and caches the query', async () => {
    const { service, prisma } = makeService();
    const boundary = { type: 'Polygon', coordinates: [[[52.2, 27.7], [52.5, 27.7], [52.5, 27.9], [52.2, 27.9], [52.2, 27.7]]] };
    prisma.city.findFirst.mockResolvedValue({
      id: 7,
      name: 'شهر نمونه',
      slug: 'sample-city',
      latitude: 27.83,
      longitude: 52.32,
      boundary,
    });
    prisma.business.findMany.mockResolvedValue([]);
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          { type: 'node', id: 1, lat: 27.83, lon: 52.32, tags: { amenity: 'hospital', 'name:fa': 'بیمارستان نمونه' } },
          { type: 'way', id: 2, center: { lat: 27.84, lon: 52.31 }, tags: { healthcare: 'clinic', name: 'درمانگاه نمونه' } },
          { type: 'node', id: 3, lat: 27.82, lon: 52.33, tags: { amenity: 'parking' } },
          { type: 'node', id: 4, lat: 29.59, lon: 52.58, tags: { amenity: 'hospital', name: 'بیرون شهر' } },
        ],
      }),
    } as Response);

    const first = await service.map('sample-city');
    const second = await service.map('sample-city');

    expect(first.amenities).toEqual([
      { id: 'node/1', kind: 'hospital', name: 'بیمارستان نمونه', latitude: 27.83, longitude: 52.32 },
      { id: 'way/2', kind: 'clinic', name: 'درمانگاه نمونه', latitude: 27.84, longitude: 52.31 },
      { id: 'node/3', kind: 'parking', name: 'پارکینگ', latitude: 27.82, longitude: 52.33 },
    ]);
    expect(second.amenities).toEqual(first.amenities);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0][1];
    const query = new URLSearchParams(String(requestInit?.body)).get('data') ?? '';
    expect(query).toContain('nwr["amenity"~"^(hospital|clinic|parking)$"]');
    expect(query).toContain('nwr["healthcare"~"^(hospital|clinic)$"]');
    expect(query).toContain('out center tags;');
    expect(query).toContain('(27.700000,52.200000,27.900000,52.500000)');
  });

  it('keeps the city map available when Overpass fails', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({
      id: 7,
      name: 'شهر نمونه',
      slug: 'sample-city',
      latitude: 27.83,
      longitude: 52.32,
      boundary: null,
    });
    prisma.business.findMany.mockResolvedValue([
      { id: 40, name: 'رستوران ویترین', slug: 'rest', latitude: 27.831, longitude: 52.321, subscriptionTier: 'GOLD', category: { name: 'رستوران', icon: '🍽', color: '#0e7a5f' } },
    ]);
    (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('upstream unavailable'));

    const data = await service.map('sample-city');

    expect(data.businesses).toHaveLength(1);
    expect(data.amenities).toEqual([]);
  });

  it('404s for unknown cities without querying businesses', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue(null);
    await expect(service.map('nope')).rejects.toThrow('شهر یافت نشد');
    expect(prisma.business.findMany).not.toHaveBeenCalled();
  });
});

describe('City news — only the last week is published', () => {
  it('caps the feed at 7 days (published date, creation as the fallback)', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.news.findMany.mockResolvedValue([]);

    await service.news('sample-city');

    const { where } = prisma.news.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ cityId: 7, status: 'PUBLISHED' });
    const or = where.OR as { publishedAt?: { gte: Date }; createdAt?: { gte: Date } }[];
    expect(or).toHaveLength(2);
    expect(or[0].publishedAt?.gte.getTime()).toBeCloseTo(Date.now() - 7 * 86_400_000, -6);
    expect(or[1]).toMatchObject({ publishedAt: null });
  });

  it('applies the same window to a single story', async () => {
    const { service, prisma } = makeService();
    prisma.news.findFirst.mockResolvedValue(null);

    await expect(service.newsDetail('old-story')).rejects.toThrow('خبر یافت نشد');

    const { where } = prisma.news.findFirst.mock.calls[0][0];
    expect(where).toMatchObject({ slug: 'old-story', status: 'PUBLISHED' });
    expect(Array.isArray((where as { OR?: unknown[] }).OR)).toBe(true);
    // an old story never reaches the view counter
    expect(prisma.news.update).not.toHaveBeenCalled();
  });
});
