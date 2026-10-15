import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { BusinessesService } from './businesses.service';

function makePrisma() {
  return {
    business: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    businessCategory: { findFirst: jest.fn() },
    businessProduct: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    media: { findFirst: jest.fn(), updateMany: jest.fn() },
    city: { findFirst: jest.fn() },
  };
}

const owner = { id: 7, phone: '09120000000', cityId: 5 } as User;
const productRow = {
  id: 11,
  name: 'لاته',
  description: null,
  price: 250_000n,
  imageUrl: '/media/x.webp',
  section: 'نوشیدنی',
  sortOrder: 0,
  isAvailable: true,
};

describe('BusinessesService — «کسب‌وکارهای من» + menu/products', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: BusinessesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new BusinessesService(prisma as unknown as PrismaService);
    prisma.business.findFirst.mockResolvedValue({ id: 4 });
    prisma.businessProduct.count.mockResolvedValue(0);
    prisma.business.count.mockResolvedValue(0);
    prisma.media.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('mine()', () => {
    it('scopes the list by ownerId and never exposes BigInt', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 4,
          name: 'کافه آزمون',
          slug: 'x-1',
          status: 'PENDING',
          subscriptionTier: 'FREE',
          logoUrl: null,
          rating: 0,
          ratingCount: 0,
          latitude: 28.97,
          category: { id: 3, name: 'کافه', icon: '☕' },
          _count: { products: 2 },
        },
      ]);
      const list = await service.mine(owner);
      expect(prisma.business.findMany).toHaveBeenCalledWith(
        // deleted rows are gone for their owner too; suspended ones stay
        expect.objectContaining({ where: { ownerId: 7, status: { not: 'DELETED' } } }),
      );
      expect(list[0]).toMatchObject({ productCount: 2, pinned: true, status: 'PENDING' });
    });
  });

  describe('manage()', () => {
    it('404s a business that is not the caller’s (no existence leak)', async () => {
      prisma.business.findFirst.mockResolvedValue(null);
      await expect(service.manage(owner, 99)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.business.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 99, ownerId: 7 } }),
      );
    });

    it('returns the menu rows with Rial prices as plain numbers', async () => {
      prisma.business.findFirst.mockResolvedValue({
        id: 4,
        name: 'کافه',
        slug: 'x-1',
        status: 'APPROVED',
        subscriptionTier: 'FREE',
        logoUrl: null,
        rating: 4.5,
        ratingCount: 3,
        latitude: null,
        longitude: null,
        description: 'د',
        phone: '0912',
        address: 'آ',
        categoryId: 3,
        category: { id: 3, name: 'کافه', icon: '☕' },
        products: [productRow],
      });
      const data = await service.manage(owner, 4);
      expect(data.products[0].price).toBe(250_000);
      expect(data.pinned).toBe(false);
      expect(data.categoryId).toBe(3);
    });
  });

  describe('update()', () => {
    it('never lets a stranger edit (ownership gate runs first)', async () => {
      prisma.business.findFirst.mockResolvedValue(null);
      await expect(service.update(owner, 99, { name: 'ت' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.business.update).not.toHaveBeenCalled();
    });

    it('stores an emptied field as NULL (clear), keeping unchanged fields', async () => {
      // every findFirst (ownership gate, current logo, then the manage
      // payload) sees the same owned row
      prisma.business.findFirst.mockResolvedValue({
        id: 4,
        name: 'کافه',
        slug: 'x-1',
        status: 'APPROVED',
        subscriptionTier: 'FREE',
        logoUrl: null,
        rating: 0,
        ratingCount: 0,
        latitude: null,
        longitude: null,
        description: null,
        phone: '0912',
        address: null,
        categoryId: 3,
        category: { id: 3, name: 'کافه', icon: '☕' },
        products: [],
      });
      await service.update(owner, 4, { address: '   ' });
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { address: null },
      });
    });

    it('rejects an unknown category', async () => {
      prisma.businessCategory.findFirst.mockResolvedValue(null);
      await expect(service.update(owner, 4, { categoryId: 999 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.business.update).not.toHaveBeenCalled();
    });

    it('rejects blanking the business name', async () => {
      await expect(service.update(owner, 4, { name: '   ' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('addProduct()', () => {
    it('creates the row on the owned business and returns a numeric price', async () => {
      prisma.businessProduct.create.mockResolvedValue(productRow);
      const created = await service.addProduct(owner, 4, {
        name: '  لاته ',
        price: 250_000,
        section: 'نوشیدنی',
      });
      expect(prisma.businessProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ businessId: 4, name: 'لاته', price: 250_000n }),
        }),
      );
      expect(created.price).toBe(250_000);
    });

    it('stores «توافقی» as NULL when no price is given', async () => {
      prisma.businessProduct.create.mockResolvedValue({ ...productRow, price: null });
      await service.addProduct(owner, 4, { name: 'قهوه' });
      expect(prisma.businessProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ price: null }) }),
      );
    });

    it('refuses to add products to a business the caller does not own', async () => {
      prisma.business.findFirst.mockResolvedValue(null);
      await expect(service.addProduct(owner, 99, { name: 'قهوه' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.businessProduct.create).not.toHaveBeenCalled();
    });
  });

  describe('updateProduct() / removeProduct()', () => {
    it('404s a product that belongs to another business', async () => {
      prisma.businessProduct.findFirst.mockResolvedValue(null);
      await expect(service.updateProduct(owner, 4, 77, { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.businessProduct.update).not.toHaveBeenCalled();
    });

    it('checks the product against its business id, not just the product id', async () => {
      prisma.businessProduct.findFirst.mockResolvedValue({ id: 11 });
      prisma.businessProduct.update.mockResolvedValue({ ...productRow, isAvailable: false });
      const updated = await service.updateProduct(owner, 4, 11, { isAvailable: false });
      expect(prisma.businessProduct.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 11, businessId: 4 } }),
      );
      expect(updated.isAvailable).toBe(false);
    });

    it('deletes only after the ownership gates pass', async () => {
      prisma.businessProduct.findFirst.mockResolvedValue(null);
      await expect(service.removeProduct(owner, 4, 77)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.businessProduct.delete).not.toHaveBeenCalled();

      prisma.businessProduct.findFirst.mockResolvedValue({ id: 11 });
      prisma.businessProduct.delete.mockResolvedValue({ id: 11 });
      await expect(service.removeProduct(owner, 4, 11)).resolves.toEqual({ id: 11, removed: true });
    });
  });
});

describe('BusinessesService — business/product photos (own uploads only)', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: BusinessesService;
  const OWN_URL = '/api/v1/files/media/2026/10/pic.webp';

  beforeEach(() => {
    prisma = makePrisma();
    service = new BusinessesService(prisma as unknown as PrismaService);
    prisma.business.findFirst.mockResolvedValue({ id: 4 });
    prisma.media.findFirst.mockResolvedValue({ id: 77 });
    prisma.media.updateMany.mockResolvedValue({ count: 1 });
    prisma.businessProduct.count.mockResolvedValue(0);
    prisma.business.count.mockResolvedValue(0);
  });

  it('refuses a foreign/hot-linked image URL', async () => {
    await expect(service.addProduct(owner, 4, { name: 'قهوه', imageUrl: 'https://evil.example/x.jpg' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.businessProduct.create).not.toHaveBeenCalled();
  });

  it('refuses an internal path that is not the caller\'s own upload', async () => {
    prisma.media.findFirst.mockResolvedValue(null);
    await expect(service.addProduct(owner, 4, { name: 'قهوه', imageUrl: OWN_URL }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.businessProduct.create).not.toHaveBeenCalled();
  });

  it('claims the media row for the business (so the orphan sweep keeps it)', async () => {
    prisma.businessProduct.create.mockResolvedValue(productRow);
    await service.addProduct(owner, 4, { name: 'لاته', imageUrl: OWN_URL });

    expect(prisma.media.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { url: OWN_URL, ownerUserId: 7 } }),
    );
    expect(prisma.media.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { url: OWN_URL, ownerUserId: 7 },
        data: { entityType: 'BUSINESS', entityId: '4' },
      }),
    );
  });

  it('frees the bytes when a product photo is cleared (soft delete for the sweep)', async () => {
    prisma.businessProduct.findFirst.mockResolvedValue({ imageUrl: OWN_URL });
    prisma.businessProduct.update.mockResolvedValue({ ...productRow, imageUrl: null });

    await service.updateProduct(owner, 4, 11, { imageUrl: '' });

    expect(prisma.media.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { url: OWN_URL, ownerUserId: 7, deletedAt: null },
        data: expect.objectContaining({ entityId: null }),
      }),
    );
  });

  it('keeps the file while another product of the owner still uses it', async () => {
    prisma.businessProduct.findFirst.mockResolvedValue({ imageUrl: OWN_URL });
    prisma.businessProduct.update.mockResolvedValue({ ...productRow, imageUrl: null });
    prisma.businessProduct.count.mockResolvedValue(1); // still referenced

    await service.updateProduct(owner, 4, 11, { imageUrl: '' });

    expect(prisma.media.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a logo that is not the owner\'s upload when registering', async () => {
    prisma.city.findFirst.mockResolvedValue({ id: 5, latitude: null, longitude: null, boundary: null });
    (prisma as unknown as { businessCategory: { findFirst: jest.Mock } }).businessCategory.findFirst.mockResolvedValue({ id: 3 });
    await expect(
      service.create(owner, { name: 'کافه', categoryId: 3, logoUrl: 'https://evil.example/logo.png' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.business.create).not.toHaveBeenCalled();
  });
});
