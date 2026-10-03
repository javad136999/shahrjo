import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AdsService } from './ads.service';
import { CreateAdDto } from './ads.dto';

const user = { id: 11, phone: '09123456789', cityId: 7 } as User;

function makeService() {
  const prisma = {
    city: { findFirst: jest.fn() },
    adCategory: { findFirst: jest.fn(), findMany: jest.fn() },
    ad: { count: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    adImage: { createMany: jest.fn() },
    media: { findMany: jest.fn(), updateMany: jest.fn() },
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

describe('AdsService.categories', () => {
  it('returns only active categories ordered for the form', async () => {
    const { service, prisma } = makeService();
    prisma.adCategory.findMany.mockResolvedValue([]);

    await service.categories();
    expect(prisma.adCategory.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(prisma.adCategory.findMany.mock.calls[0][0].orderBy).toEqual([{ sortOrder: 'asc' }, { name: 'asc' }]);
  });
});
