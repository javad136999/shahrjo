import type { PrismaService } from '../prisma/prisma.service';
import { ContentService } from './content.service';

function makeService() {
  const prisma = {
    city: { findFirst: jest.fn() },
    news: { findMany: jest.fn() },
    ad: { findMany: jest.fn() },
    business: { findMany: jest.fn() },
  };
  const service = new ContentService(prisma as unknown as PrismaService);
  return { service, prisma };
}

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
