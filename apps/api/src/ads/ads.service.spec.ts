import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AdsService } from './ads.service';
import { CreateAdDto } from './ads.dto';

const user = { id: 11, phone: '09123456789', cityId: 7 } as User;

function makeService() {
  const prisma = {
    city: { findFirst: jest.fn() },
    adCategory: { findFirst: jest.fn(), findMany: jest.fn() },
    ad: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    adImage: { createMany: jest.fn() },
    media: { findMany: jest.fn(), updateMany: jest.fn() },
    favorite: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  prisma.adImage.createMany.mockResolvedValue({ count: 0 });
  const service = new AdsService(prisma as unknown as PrismaService);
  return { service, prisma, adImage: prisma.adImage };
}

const validDto = (over: Partial<CreateAdDto> = {}): CreateAdDto => ({
  categoryId: 3,
  title: 'آگهی نمونه',
  description: 'توضیحات کامل آگهی نمونه برای تست',
  price: 125_000_000,
  ...over,
});

describe('AdsService.create — moderation first', () => {
  it('always stores the ad as PENDING with the profile city (never APPROVED, no client city)', async () => {
    const { service, prisma, adImage } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.adCategory.findFirst.mockResolvedValue({ id: 3 });
    prisma.ad.count.mockResolvedValue(0);
    prisma.ad.create.mockResolvedValue({
      id: 99,
      title: 'آگهی نمونه',
      status: 'PENDING',
      price: 125_000_000n,
      createdAt: new Date('2026-10-03'),
      expiresAt: new Date('2026-11-02'),
    });

    const dto = validDto();
    const result = await service.create(user, dto);

    const created = prisma.ad.create.mock.calls[0][0].data;
    expect(created.status).toBe('PENDING');
    expect(created.cityId).toBe(7); // from the profile, not from the body
    expect(created.price).toBe(125_000_000n); // stored as BigInt
    expect(created.expiresAt).toBeInstanceOf(Date);
    expect(result.status).toBe('PENDING');
    expect(result.price).toBe(125_000_000); // JSON-safe number
    expect(adImage.createMany).not.toHaveBeenCalled();
  });

  it('rejects when the user has not selected a city yet', async () => {
    const { service, prisma } = makeService();
    await expect(service.create({ ...user, cityId: null } as User, validDto())).rejects.toThrow('ابتدا شهر خودت را انتخاب کن');
    expect(prisma.ad.create).not.toHaveBeenCalled();
  });

  it('404s on unknown/inactive city and inactive category', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue(null);
    await expect(service.create(user, validDto())).rejects.toThrow('شهر انتخاب‌شده یافت نشد');

    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.adCategory.findFirst.mockResolvedValue(null);
    await expect(service.create(user, validDto({ categoryId: 999 }))).rejects.toThrow('دسته‌بندی یافت نشد');
    expect(prisma.ad.create).not.toHaveBeenCalled();
  });

  it('429s after the per-hour submission cap', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.adCategory.findFirst.mockResolvedValue({ id: 3 });
    prisma.ad.count.mockResolvedValue(20);

    await expect(service.create(user, validDto())).rejects.toMatchObject({ status: 429 });
    expect(prisma.ad.create).not.toHaveBeenCalled();
  });
});

describe('AdsService.create — images', () => {
  it('accepts only the caller\'s own fresh AD uploads, in the requested order', async () => {
    const { service, prisma, adImage } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.adCategory.findFirst.mockResolvedValue({ id: 3 });
    prisma.ad.count.mockResolvedValue(0);
    // ids requested as [21, 20]; server returns them unordered
    prisma.media.findMany.mockResolvedValue([
      { id: 20, url: '/api/v1/files/ads/a.png' },
      { id: 21, url: '/api/v1/files/ads/b.png' },
    ]);
    prisma.ad.create.mockResolvedValue({
      id: 5,
      title: 'آگهی نمونه',
      status: 'PENDING',
      price: null,
      createdAt: new Date(),
      expiresAt: new Date(),
    });

    const result = await service.create(user, validDto({ imageIds: [21, 20] }));

    const ownership = prisma.media.findMany.mock.calls[0][0].where;
    expect(ownership).toMatchObject({ ownerUserId: 11, entityType: 'AD', entityId: null, deletedAt: null });
    expect(result.imageUrls).toEqual(['/api/v1/files/ads/b.png', '/api/v1/files/ads/a.png']);
    expect(adImage.createMany).toHaveBeenCalledWith({
      data: [
        { adId: 5, url: '/api/v1/files/ads/b.png', sortOrder: 0 },
        { adId: 5, url: '/api/v1/files/ads/a.png', sortOrder: 1 },
      ],
    });
    // media rows are claimed so they cannot be reused by another ad
    expect(prisma.media.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [21, 20] } },
      data: { entityId: '5' },
    });
  });

  it('rejects images the caller does not own (or already used)', async () => {
    const { service, prisma } = makeService();
    prisma.city.findFirst.mockResolvedValue({ id: 7 });
    prisma.adCategory.findFirst.mockResolvedValue({ id: 3 });
    prisma.ad.count.mockResolvedValue(0);
    prisma.media.findMany.mockResolvedValue([{ id: 20, url: '/api/v1/files/ads/a.png' }]); // 1 of 2 matched

    await expect(service.create(user, validDto({ imageIds: [20, 21] }))).rejects.toThrow('نامعتبر');
    expect(prisma.ad.create).not.toHaveBeenCalled();
  });
});

describe('AdsService.mine', () => {
  it('lists the owner\'s ads regardless of status, with JSON-safe price and cover', async () => {
    const { service, prisma } = makeService();
    prisma.ad.findMany.mockResolvedValue([
      { id: 1, title: 'در انتظار', status: 'PENDING', price: null, rejectedReason: null, createdAt: new Date(), expiresAt: null, images: [] },
      { id: 2, title: 'رد شده', status: 'REJECTED', price: 500n, rejectedReason: 'محتوای نامعتبر', createdAt: new Date(), expiresAt: null, images: [{ url: '/api/v1/files/ads/x.png' }] },
    ]);

    const mine = await service.mine(user);

    const args = prisma.ad.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 11 });
    expect(mine.map((a) => a.status)).toEqual(['PENDING', 'REJECTED']);
    expect(mine[1].price).toBe(500);
    expect(mine[1].coverUrl).toBe('/api/v1/files/ads/x.png');
    expect(mine[1].imageCount).toBe(1);
    expect(mine[0].coverUrl).toBeNull();
  });
});

const approvedAd = (over: Record<string, unknown> = {}) => ({
  id: 42,
  userId: 11,
  status: 'APPROVED',
  title: 'آگهی نمونه',
  description: 'توضیحات کامل آگهی نمونه برای تست',
  price: 125_000_000n,
  phone: '09123456789',
  address: null,
  viewCount: 7,
  rejectedReason: null,
  expiresAt: new Date('2099-01-01'),
  publishedAt: new Date('2026-10-01'),
  createdAt: new Date('2026-10-01'),
  city: { id: 7, name: 'شهر نمونه', slug: 'sample-city' },
  category: { id: 3, name: 'لوازم', slug: 'goods', icon: '🛍️', color: null },
  images: [{ url: '/api/v1/files/ads/a.png' }],
  ...over,
});

describe('AdsService.detail — visibility & views', () => {
  it('serves an approved ad to anyone and counts a view', async () => {
    const { service, prisma } = makeService();
    prisma.ad.findUnique.mockResolvedValue(approvedAd());
    prisma.ad.update.mockResolvedValue({ viewCount: 8 });
    prisma.favorite.count.mockResolvedValue(0);

    const detail = await service.detail(42, null);

    expect(prisma.ad.update.mock.calls[0][0]).toMatchObject({
      where: { id: 42 },
      data: { viewCount: { increment: 1 } },
    });
    expect(detail.viewCount).toBe(8);
    expect(detail.price).toBe(125_000_000); // BigInt → Number
    expect(detail.images).toEqual(['/api/v1/files/ads/a.png']);
    expect(detail.isOwner).toBe(false);
    expect(detail.favorited).toBe(false);
    expect(detail.rejectedReason).toBeNull(); // moderation detail is owner-only
  });

  it('lets the owner preview their own PENDING ad without counting a view', async () => {
    const { service, prisma } = makeService();
    prisma.ad.findUnique.mockResolvedValue(
      approvedAd({ status: 'PENDING', rejectedReason: null }),
    );
    prisma.favorite.count.mockResolvedValue(0);

    const detail = await service.detail(42, user);

    expect(detail.status).toBe('PENDING');
    expect(detail.isOwner).toBe(true);
    expect(prisma.ad.update).not.toHaveBeenCalled();
  });

  it('hides PENDING/REJECTED/EXPIRED ads from everyone else (404, no view count)', async () => {
    const { service, prisma } = makeService();
    const stranger = { id: 99, phone: '09120000000', cityId: 7 } as User;

    prisma.ad.findUnique.mockResolvedValue(approvedAd({ status: 'PENDING' }));
    await expect(service.detail(42, stranger)).rejects.toThrow('آگهی یافت نشد');

    prisma.ad.findUnique.mockResolvedValue(
      approvedAd({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.detail(42, stranger)).rejects.toThrow('آگهی یافت نشد');

    prisma.ad.findUnique.mockResolvedValue(null);
    await expect(service.detail(404, null)).rejects.toThrow('آگهی یافت نشد');
    expect(prisma.ad.update).not.toHaveBeenCalled();
  });

  it('reports the favorited flag for a logged-in viewer', async () => {
    const { service, prisma } = makeService();
    prisma.ad.findUnique.mockResolvedValue(approvedAd());
    prisma.ad.update.mockResolvedValue({ viewCount: 8 });
    prisma.favorite.count.mockResolvedValue(1);

    const detail = await service.detail(42, user);

    expect(prisma.favorite.count.mock.calls[0][0].where).toMatchObject({
      userId: 11,
      targetType: 'AD',
      adId: 42,
    });
    expect(detail.favorited).toBe(true);
  });
});

describe('AdsService.toggleFavorite', () => {
  it('adds a favorite when none exists yet', async () => {
    const { service, prisma } = makeService();
    prisma.ad.findFirst.mockResolvedValue({ id: 42, userId: 11, status: 'APPROVED', expiresAt: null });
    prisma.favorite.findFirst.mockResolvedValue(null);

    const result = await service.toggleFavorite(user, 42);

    expect(result).toEqual({ favorited: true });
    expect(prisma.favorite.create.mock.calls[0][0].data).toEqual({
      userId: 11,
      targetType: 'AD',
      adId: 42,
    });
    expect(prisma.favorite.delete).not.toHaveBeenCalled();
  });

  it('removes an existing favorite (toggle off)', async () => {
    const { service, prisma } = makeService();
    prisma.ad.findFirst.mockResolvedValue({ id: 42, userId: 11, status: 'APPROVED', expiresAt: null });
    prisma.favorite.findFirst.mockResolvedValue({ id: 5 });

    const result = await service.toggleFavorite(user, 42);

    expect(result).toEqual({ favorited: false });
    expect(prisma.favorite.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(prisma.favorite.create).not.toHaveBeenCalled();
  });

  it('404s for unknown ads and for hidden ads the caller does not own', async () => {
    const { service, prisma } = makeService();
    prisma.ad.findFirst.mockResolvedValue(null);
    await expect(service.toggleFavorite(user, 999)).rejects.toThrow('آگهی یافت نشد');

    prisma.ad.findFirst.mockResolvedValue({ id: 42, userId: 77, status: 'PENDING', expiresAt: null });
    await expect(service.toggleFavorite(user, 42)).rejects.toThrow('آگهی یافت نشد');
    expect(prisma.favorite.create).not.toHaveBeenCalled();
  });
});

describe('AdsService.favorites', () => {
  it('lists favorited ads with cover/count and JSON-safe price, skipping vanished rows', async () => {
    const { service, prisma } = makeService();
    prisma.favorite.findMany.mockResolvedValue([
      {
        ad: {
          id: 42,
          title: 'آگهی محبوب',
          status: 'APPROVED',
          price: 900n,
          rejectedReason: null,
          createdAt: new Date('2026-10-02'),
          expiresAt: null,
          images: [{ url: '/api/v1/files/ads/b.png' }, { url: '/api/v1/files/ads/c.png' }],
        },
      },
      { ad: null }, // defense: relation may be missing
    ]);

    const list = await service.favorites(user);

    const args = prisma.favorite.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ userId: 11, targetType: 'AD' });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 42,
      price: 900,
      coverUrl: '/api/v1/files/ads/b.png',
      imageCount: 2,
    });
  });
});

describe('AdsService.categories', () => {
  it('returns only active categories ordered for the form', async () => {
    const { service, prisma } = makeService();
    prisma.adCategory.findMany.mockResolvedValue([]);

    await service.categories();
    expect(prisma.adCategory.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(prisma.adCategory.findMany.mock.calls[0][0].orderBy).toEqual([{ sortOrder: 'asc' }, { name: 'asc' }]);
  });
});
