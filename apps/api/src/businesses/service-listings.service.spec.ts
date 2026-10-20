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
    businessCategory: { findFirst: jest.fn() },
    serviceListing: { create: jest.fn(), findMany: jest.fn() },
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
    prisma.serviceListing.create.mockResolvedValue({
      id: 11,
      name: dto.name,
      phone: dto.phone,
      description: dto.description,
      category: { name: 'تعمیرکار کولر', slug: 'svc_ac_repair', icon: '❄️' },
    });
    prisma.serviceListing.findMany.mockResolvedValue([]);
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
          description: dto.description,
        },
      }),
    );
    expect('business' in prisma).toBe(false);
  });

  it('rejects a category that is not an active service category', async () => {
    prisma.businessCategory.findFirst.mockResolvedValue(null);

    await expect(service.create(user, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.serviceListing.create).not.toHaveBeenCalled();
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
