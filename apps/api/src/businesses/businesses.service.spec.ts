import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { BusinessesService } from './businesses.service';

function makePrisma() {
  return {
    city: { findFirst: jest.fn() },
    businessCategory: { findFirst: jest.fn() },
    business: { count: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  };
}

const owner = { id: 7, phone: '09120000000', cityId: 5 } as User;
const dto = { name: 'کافه آزمون', categoryId: 3 };

// Bushehr's seeded rectangle (raw rings — the exact seed format).
const bushehrGeo = {
  latitude: 28.97,
  longitude: 50.84,
  boundary: [[[50.802536, 28.8539379], [50.802536, 29.0045185], [50.9044647, 29.0045185], [50.9044647, 28.8539379], [50.802536, 28.8539379]]],
};

describe('BusinessesService.create — profile city + pin containment', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: BusinessesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new BusinessesService(prisma as unknown as PrismaService);
    prisma.business.count.mockResolvedValue(0);
    prisma.business.findUnique.mockResolvedValue(null);
    prisma.businessCategory.findFirst.mockResolvedValue({ id: 3 });
    prisma.business.create.mockResolvedValue({
      id: 9,
      name: dto.name,
      slug: 'x-1',
      status: 'PENDING',
      subscriptionTier: 'FREE',
    });
  });

  it('rejects when the profile has no city selected', async () => {
    await expect(service.create({ ...owner, cityId: null }, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.business.create).not.toHaveBeenCalled();
  });

  it('allows regular business registration without a daily count limit', async () => {
    prisma.city.findFirst.mockResolvedValue({ id: 5, ...bushehrGeo });
    prisma.business.count.mockResolvedValue(100);

    await service.create(owner, dto);

    expect(prisma.business.create).toHaveBeenCalled();
  });

  it('allows quick service registration without a daily count limit', async () => {
    prisma.city.findFirst.mockResolvedValue({ id: 5 });
    prisma.businessCategory.findFirst.mockResolvedValue({ id: 3 });
    prisma.business.count.mockResolvedValue(100);

    await service.createQuick(owner, {
      citySlug: 'jam',
      name: 'کابینت‌کار آزمون',
      categoryId: 3,
      phone: '09120000000',
    });

    expect(prisma.business.create).toHaveBeenCalled();
  });

  it('404s an unknown/inactive city', async () => {
    prisma.city.findFirst.mockResolvedValue(null);
    await expect(service.create(owner, dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts a pin inside the seeded boundary', async () => {
    prisma.city.findFirst.mockResolvedValue({ id: 5, ...bushehrGeo });
    await service.create(owner, { ...dto, latitude: 28.97, longitude: 50.85 });
    expect(prisma.business.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cityId: 5, latitude: 28.97, longitude: 50.85 }),
      }),
    );
  });

  it('accepts a pin near the centre even outside the boundary box', async () => {
    prisma.city.findFirst.mockResolvedValue({ id: 5, ...bushehrGeo });
    await service.create(owner, { ...dto, latitude: 28.7, longitude: 50.95 });
    expect(prisma.business.create).toHaveBeenCalled();
  });

  it('rejects a pin from another city (the cross-city coordinate bug)', async () => {
    prisma.city.findFirst.mockResolvedValue({ id: 5, ...bushehrGeo });
    // Jam's coordinates under a Bushehr profile — the exact live corruption
    await expect(service.create(owner, { ...dto, latitude: 27.83, longitude: 52.32 })).rejects.toThrow(
      'خارج از محدوده این شهر',
    );
    expect(prisma.business.create).not.toHaveBeenCalled();
  });

  it('accepts any pin when the city carries no geo data', async () => {
    prisma.city.findFirst.mockResolvedValue({ id: 5, latitude: null, longitude: null, boundary: null });
    await service.create(owner, { ...dto, latitude: 30.1, longitude: 50.2 });
    expect(prisma.business.create).toHaveBeenCalled();
  });

  it('accepts a GeoJSON-object boundary too (admin-set outlines)', async () => {
    prisma.city.findFirst.mockResolvedValue({
      id: 5,
      ...bushehrGeo,
      boundary: { type: 'Polygon', coordinates: [bushehrGeo.boundary[0]] },
    });
    await service.create(owner, { ...dto, latitude: 28.9, longitude: 50.82 });
    expect(prisma.business.create).toHaveBeenCalled();
  });
});

describe('BusinessesService.mine — the owner’s working list', () => {
  it('drops deleted rows but keeps suspended ones (with the expiry facts)', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        name: 'کافه',
        slug: 'cafe-1',
        status: 'CLOSED',
        subscriptionTier: 'SILVER',
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
        logoUrl: null,
        rating: 0,
        ratingCount: 0,
        latitude: null,
        category: { id: 3, name: 'کافه', icon: '☕' },
        _count: { products: 2 },
      },
    ]);
    const service = new BusinessesService({ business: { findMany } } as unknown as PrismaService);

    const rows = await service.mine(owner);

    // a deleted business is gone for its owner too — that is what «delete» means
    expect(findMany.mock.calls[0][0].where).toEqual({ ownerId: owner.id, status: { not: 'DELETED' } });
    // …but a suspended one stays, so the owner can reactivate it via a purchase
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'CLOSED', subscriptionStatus: 'EXPIRED', productCount: 2, pinned: false });
    expect(rows[0].subscriptionExpiresAt).toBeInstanceOf(Date);
  });
});
