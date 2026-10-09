import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateBusinessDto } from './businesses.dto';
import { BusinessesService } from './businesses.service';

function makePrisma() {
  const prisma = {
    city: { findFirst: jest.fn() },
    businessCategory: { findFirst: jest.fn() },
    business: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    media: { findMany: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  return prisma;
}

const user = { id: 4, phone: '09120000000', cityId: 7 } as User;

function makeDto(overrides: Partial<CreateBusinessDto> = {}): CreateBusinessDto {
  return { categoryId: 3, name: 'نانوایی امید', ...overrides } as CreateBusinessDto;
}

function setup() {
  const prisma = makePrisma();
  const service = new BusinessesService(prisma as unknown as PrismaService);
  prisma.city.findFirst.mockResolvedValue({ id: 7 });
  prisma.businessCategory.findFirst.mockResolvedValue({ id: 3 });
  prisma.business.findFirst.mockResolvedValue(null);
  prisma.media.findMany.mockResolvedValue([]);
  prisma.business.create.mockResolvedValue({ id: 55 });
  prisma.business.update.mockResolvedValue({});
  prisma.media.updateMany.mockResolvedValue({ count: 1 });
  return { service, prisma };
}

describe('BusinessesService.create', () => {
  it('creates a PENDING business in the profile city with canonical slug', async () => {
    const { service, prisma } = setup();
    const out = await service.create(user, makeDto({ phone: '09171234567', latitude: 27.83, longitude: 52.32 }));

    expect(out).toEqual({ id: 55, name: 'نانوایی امید', status: 'PENDING' });
    expect(prisma.business.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          cityId: 7,
          categoryId: 3,
          ownerId: 4,
          phone: '09171234567',
          latitude: 27.83,
          longitude: 52.32,
        }),
      }),
    );
    // tier/benefit fields are never set from user input
    const createdData = prisma.business.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(createdData.subscriptionTier).toBeUndefined();
    expect(createdData.subscriptionStatus).toBeUndefined();
    expect(createdData.showcasePriority).toBeUndefined();
    // canonical unique slug applied in the same transaction
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { slug: 'b-55' },
    });
  });

  it('falls back to the account phone when none is provided', async () => {
    const { service, prisma } = setup();
    await service.create(user, makeDto());
    expect(prisma.business.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: '09120000000' }) }),
    );
  });

  it('rejects a user without a selected city', async () => {
    const { service } = setup();
    const noCity = { ...user, cityId: null } as User;
    await expect(service.create(noCity, makeDto())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive/unknown category', async () => {
    const { service, prisma } = setup();
    prisma.businessCategory.findFirst.mockResolvedValue(null);
    await expect(service.create(user, makeDto())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects half coordinates (lat without lng)', async () => {
    const { service, prisma } = setup();
    await expect(service.create(user, makeDto({ latitude: 27.8 }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.business.create).not.toHaveBeenCalled();
  });

  it('blocks a second request while one is PENDING (anti-bypass)', async () => {
    const { service, prisma } = setup();
    prisma.business.findFirst.mockResolvedValueOnce({ id: 9, name: 'قدیمی' });
    await expect(service.create(user, makeDto())).rejects.toMatchObject({
      status: 409,
      response: { code: 'DUPLICATE_BUSINESS' },
    });
    expect(prisma.business.create).not.toHaveBeenCalled();
    // only the "open request" query ran — no duplicate-name query needed
    expect(prisma.business.findFirst).toHaveBeenCalledTimes(1);
  });

  it('blocks a duplicate active name in the same city (case-insensitive)', async () => {
    const { service, prisma } = setup();
    prisma.business.findFirst
      .mockResolvedValueOnce(null) // no open request
      .mockResolvedValueOnce({ id: 12 }); // same name already active
    await expect(service.create(user, makeDto({ name: 'نانوایی امید' }))).rejects.toMatchObject({
      status: 409,
      response: { code: 'DUPLICATE_BUSINESS' },
    });
    expect(prisma.business.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { equals: 'نانوایی امید', mode: 'insensitive' },
          status: { in: ['PENDING', 'APPROVED'] },
        }),
      }),
    );
  });

  it('claims only this user\'s fresh BUSINESS uploads as logo/cover', async () => {
    const { service, prisma } = setup();
    prisma.media.findMany.mockResolvedValue([
      { id: 11, url: '/api/v1/files/logo.webp' },
      { id: 12, url: '/api/v1/files/cover.webp' },
    ]);
    await service.create(user, makeDto({ logoMediaId: 11, coverMediaId: 12 }));

    expect(prisma.media.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [11, 12] },
          ownerUserId: 4,
          entityType: 'BUSINESS',
          entityId: null,
        }),
      }),
    );
    expect(prisma.business.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          logoUrl: '/api/v1/files/logo.webp',
          coverUrl: '/api/v1/files/cover.webp',
        }),
      }),
    );
    expect(prisma.media.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [11, 12] } },
      data: { entityId: '55' },
    });
  });

  it('rejects media the user does not own (or that belongs to another entity)', async () => {
    const { service, prisma } = setup();
    prisma.media.findMany.mockResolvedValue([]); // nothing claimable
    await expect(service.create(user, makeDto({ logoMediaId: 999 }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.business.create).not.toHaveBeenCalled();
  });

  it('drops empty social links and keeps provided handles', async () => {
    const { service, prisma } = setup();
    await service.create(
      user,
      makeDto({ socialLinks: { instagram: ' shop_ir ', telegram: '', website: 'https://example.com' } }),
    );
    expect(prisma.business.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          socialLinks: { instagram: 'shop_ir', website: 'https://example.com' },
        }),
      }),
    );
  });

  it('propagates a conflict as HttpException (409) without touching the DB', async () => {
    const { service, prisma } = setup();
    prisma.business.findFirst.mockResolvedValueOnce({ id: 1 });
    let caught: HttpException | undefined;
    try {
      await service.create(user, makeDto());
    } catch (e) {
      caught = e as HttpException;
    }
    expect(caught?.getStatus()).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
