import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { BusinessReviewsService } from './business-reviews.service';

function makeService() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 30 }]),
    business: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    review: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      aggregate: jest.fn(),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  return {
    service: new BusinessReviewsService(prisma as unknown as PrismaService),
    tx,
    prisma,
  };
}

const reviewer = { id: 12 } as User;
const approved = { id: 30, ownerId: 7 };
const reviewRow = {
  id: 99,
  rating: 5,
  body: 'خیلی خوب بود',
  updatedAt: new Date('2026-10-24T00:00:00.000Z'),
  user: { fullName: 'مریم' },
};

describe('BusinessReviewsService', () => {
  it('upserts a single review and synchronizes the business average/count in one transaction', async () => {
    const { service, tx, prisma } = makeService();
    tx.business.findFirst.mockResolvedValue(approved);
    tx.review.upsert.mockResolvedValue(reviewRow);
    tx.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { _all: 2 } });
    tx.business.update.mockResolvedValue({ rating: 4.5, ratingCount: 2 });

    const result = await service.save(reviewer, 30, { rating: 5, body: '  خیلی خوب بود  ' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.review.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId_userId: { businessId: 30, userId: reviewer.id } },
      create: { businessId: 30, userId: reviewer.id, rating: 5, body: 'خیلی خوب بود' },
      update: { rating: 5, body: 'خیلی خوب بود' },
    }));
    expect(tx.business.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 30 },
      data: { rating: 4.5, ratingCount: 2 },
    }));
    expect(result).toEqual({
      review: {
        id: 99,
        rating: 5,
        body: 'خیلی خوب بود',
        updatedAt: reviewRow.updatedAt,
        userName: 'مریم',
      },
      rating: 4.5,
      ratingCount: 2,
    });
  });

  it('does not allow the owner to rate their own business', async () => {
    const { service, tx } = makeService();
    tx.business.findFirst.mockResolvedValue({ id: 30, ownerId: reviewer.id });

    await expect(service.save(reviewer, 30, { rating: 1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.review.upsert).not.toHaveBeenCalled();
  });

  it('only accepts reviews for approved businesses', async () => {
    const { service, tx } = makeService();
    tx.business.findFirst.mockResolvedValue(null);

    await expect(service.save(reviewer, 30, { rating: 4 })).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.review.upsert).not.toHaveBeenCalled();
  });

  it('returns the latest public reviews without exposing user account identifiers', async () => {
    const { service, tx } = makeService();
    tx.business.findFirst.mockResolvedValue({ id: 30 });
    tx.review.findMany.mockResolvedValue([reviewRow]);

    const result = await service.list(30);

    expect(tx.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 30 },
      take: 20,
    }));
    expect(result).toEqual([{
      id: 99,
      rating: 5,
      body: 'خیلی خوب بود',
      updatedAt: reviewRow.updatedAt,
      userName: 'مریم',
    }]);
  });

  it('returns null when the signed-in user has not reviewed the business', async () => {
    const { service, tx } = makeService();
    tx.business.findFirst.mockResolvedValue({ id: 30 });
    tx.review.findUnique.mockResolvedValue(null);

    await expect(service.mine(reviewer, 30)).resolves.toBeNull();
  });
});
