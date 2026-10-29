import { NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ServiceListingsService } from './service-listings.service';

const user = { id: 7, cityId: 5, phone: '09120000000' } as User;
const dto = {
  citySlug: 'sample-city',
  name: 'تعمیرکار کولر',
  categoryId: 90,
  phone: '09121112233',
  description: 'نصب و سرویس کولر',
};

function makePrisma() {
  return {
    city: { findFirst: jest.fn() },
    businessCategory: { findFirst: jest.fn(), findMany: jest.fn() },
    serviceListing: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    serviceListingRating: { upsert: jest.fn(), aggregate: jest.fn() },
  };
}

describe('ServiceListingsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: ServiceListingsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ServiceListingsService(prisma as unknown as PrismaService);
    prisma.city.findFirst.mockResolvedValue({ id: 5 });
    prisma.businessCategory.findFirst.mockResolvedValue({ id: 90 });
    prisma.businessCategory.findMany.mockResolvedValue([{ id: 90, slug: 'svc_ac_repair' }, { id: 91, slug: 'svc_plumber' }]);
    prisma.serviceListing.create.mockResolvedValue({
      id: 11,
      name: dto.name,
      phone: dto.phone,
      description: dto.description,
      category: { name: 'تعمیرکار کولر', slug: 'svc_ac_repair', icon: '❄️' },
    });
    prisma.serviceListing.findMany.mockResolvedValue([]);
    prisma.serviceListing.count.mockResolvedValue(123);
    prisma.serviceListing.groupBy.mockResolvedValue([{ categoryId: 90, _count: { _all: 2 } }]);
    prisma.serviceListing.findFirst.mockResolvedValue(null);
    prisma.serviceListingRating.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { _all: 2 } });
  });

  it('returns each active service category count, including categories with no listings', async () => {
    await expect(service.categoryCounts('sample-city')).resolves.toEqual({ svc_ac_repair: 2, svc_plumber: 0 });
    expect(prisma.serviceListing.groupBy).toHaveBeenCalledWith({
      by: ['categoryId'],
      where: { cityId: 5, isActive: true },
      _count: { _all: true },
    });
  });
  it('counts all active listings in a city without applying the search page limit', async () => {
    await expect(service.count('sample-city')).resolves.toBe(123);
    expect(prisma.serviceListing.count).toHaveBeenCalledWith({ where: { cityId: 5, isActive: true } });
  });
  it('creates a service-listing row only, with the entered contact and service details', async () => {
    const result = await service.create(user, dto);

    expect(result).toMatchObject({ id: 11, name: dto.name, phone: dto.phone, description: dto.description });
    expect(prisma.serviceListing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ownerId: user.id,
          cityId: 5,
          categoryId: 90,
          name: dto.name,
          phone: dto.phone,
          normalizedPhone: dto.phone,
          uniquePhoneGuard: true,
          description: dto.description,
        },
      }),
    );
    expect('business' in prisma).toBe(false);
  });

  it('rejects a phone already used by an existing listing after normalizing Persian numerals', async () => {
    prisma.serviceListing.findFirst.mockResolvedValue({ id: 8 });
    await expect(service.create(user, { ...dto, phone: '۰۹۱۲-۱۱۱-۲۲۳۳' })).rejects.toMatchObject({ status: 409 });
    expect(prisma.businessCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.serviceListing.create).not.toHaveBeenCalled();
  });
  it('rejects a category that is not an active service category', async () => {
    prisma.businessCategory.findFirst.mockResolvedValue(null);

    await expect(service.create(user, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.serviceListing.create).not.toHaveBeenCalled();
  });

  it('allows one authenticated vote per user, updating an existing rating and returning the aggregate', async () => {
    prisma.serviceListing.findFirst.mockResolvedValue({ id: 11, ownerId: 8 });
    await expect(service.rate(user, 11, 5)).resolves.toEqual({ rating: 4.5, ratingCount: 2, userRating: 5 });
    expect(prisma.serviceListingRating.upsert).toHaveBeenCalledWith({
      where: { serviceListingId_userId: { serviceListingId: 11, userId: user.id } },
      create: { serviceListingId: 11, userId: user.id, rating: 5 },
      update: { rating: 5 },
    });
  });
  it('prevents owners from rating their own service listing', async () => {
    prisma.serviceListing.findFirst.mockResolvedValue({ id: 11, ownerId: user.id });
    await expect(service.rate(user, 11, 5)).rejects.toMatchObject({ status: 403 });
    expect(prisma.serviceListingRating.upsert).not.toHaveBeenCalled();
  });
  it('returns only active listings for the selected city and service category', async () => {
    await service.list('sample-city', 200, 'svc_ac_repair');

    expect(prisma.city.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'sample-city', isActive: true, province: { isActive: true } } }),
    );
    expect(prisma.businessCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'svc_ac_repair', isActive: true, isService: true } }),
    );
    expect(prisma.serviceListing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cityId: 5, isActive: true, categoryId: 90 },
        take: 200,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
});
