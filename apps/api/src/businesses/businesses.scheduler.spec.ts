import type { PrismaService } from '../prisma/prisma.service';
import { BusinessExpiryScheduler } from './businesses.scheduler';

describe('BusinessExpiryScheduler.sweep — paid time runs out, the business suspends', () => {
  let prisma: { business: { updateMany: jest.Mock } };
  let scheduler: BusinessExpiryScheduler;

  beforeEach(() => {
    prisma = { business: { updateMany: jest.fn() } };
    scheduler = new BusinessExpiryScheduler(prisma as unknown as PrismaService);
    prisma.business.updateMany.mockResolvedValue({ count: 2 });
  });

  it('suspends approved businesses past their paid-until date', async () => {
    const now = new Date('2026-10-15T12:00:00.000Z');

    await expect(scheduler.sweep(now)).resolves.toBe(2);

    const call = prisma.business.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      status: 'APPROVED',
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: { not: null, lte: now },
    });
    // the same state an admin suspension produces — every public query
    // (list/map/showcase/detail) filters it out on the next read
    expect(call.data).toEqual({ status: 'CLOSED', subscriptionStatus: 'EXPIRED' });
  });

  it('never touches a FREE registration (no expiry was ever paid for)', async () => {
    prisma.business.updateMany.mockResolvedValue({ count: 0 });
    await expect(scheduler.sweep()).resolves.toBe(0);

    const call = prisma.business.updateMany.mock.calls[0][0];
    // `subscriptionExpiresAt: { not: null }` is what keeps null (FREE) rows out
    expect(call.where.subscriptionExpiresAt).toHaveProperty('not', null);
  });
});
