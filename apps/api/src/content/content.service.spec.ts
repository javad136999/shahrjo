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
