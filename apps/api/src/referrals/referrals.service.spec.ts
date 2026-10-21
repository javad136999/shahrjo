import { BadRequestException, NotFoundException } from '@nestjs/common';
import { grantReferralMilestones, ReferralsService } from './referrals.module';

function mockPrisma() {
  const tx = {
    $queryRaw: jest.fn(),
    user: { count: jest.fn().mockResolvedValue(5) },
    referralCreditGrant: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 2_000_000n } }),
    },
    referralCreditRedemption: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0n } }),
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    business: {
      findFirst: jest.fn().mockResolvedValue({ id: 11, status: 'APPROVED', subscriptionExpiresAt: null }),
      update: jest.fn().mockResolvedValue({}),
    },
    subscriptionPlan: {
      findFirst: jest.fn().mockResolvedValue({ id: 4, tier: 'SILVER', durationDays: 30, price: 2_000_000n }),
    },
    subscription: { create: jest.fn().mockResolvedValue({ id: 88 }) },
  };
  return {
    ...tx,
    user: { ...tx.user, update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
}

describe('ReferralsService', () => {
  it('returns invite code, counts successful signups, and exposes a non-cash balance', async () => {
    const prisma = mockPrisma();
    const result = await new ReferralsService(prisma as never).mine({ id: 7, referralCode: 'SJABCD1234' } as never);

    expect(result.code).toBe('SJABCD1234');
    expect(result.successfulSignups).toBe(5);
    expect(result.balanceRial).toBe(2_000_000);
    expect(result.balanceToman).toBe(200_000);
    expect(result.cashWithdrawalAllowed).toBe(false);
    expect(result.milestones.map((item) => item.achieved)).toEqual([true, false, false, false, false]);
    expect(result.milestones[0]).toMatchObject({ tier: 'SILVER', months: 1, valueToman: 200_000, incrementalToman: 200_000 });
    expect(result.milestones[4]).not.toHaveProperty('cashToman');
  });

  it('awards only cumulative differences at each newly reached milestone', async () => {
    const prisma = mockPrisma();
    prisma.user.count.mockResolvedValue(100);
    prisma.referralCreditGrant.findMany.mockResolvedValue([
      { milestoneCount: 5 }, { milestoneCount: 10 }, { milestoneCount: 20 }, { milestoneCount: 50 }, { milestoneCount: 100 },
    ]);
    const result = await new ReferralsService(prisma as never).mine({ id: 8, referralCode: 'SJ100' } as never);
    expect(result.milestones.every((item) => item.achieved)).toBe(true);
    expect(result.milestones.map((item) => item.incrementalToman)).toEqual([200_000, 200_000, 400_000, 800_000, 600_000]);
    expect(result.milestones[4]).toMatchObject({ count: 100, tier: 'GOLD', months: 3, valueToman: 2_200_000 });
  });

  it('grants only missing milestone differences exactly once', async () => {
    const prisma = mockPrisma();
    prisma.user.count.mockResolvedValue(10);
    prisma.referralCreditGrant.findMany.mockResolvedValue([{ milestoneCount: 5 }]);
    await grantReferralMilestones(prisma as never, 7);
    expect(prisma.referralCreditGrant.createMany).toHaveBeenCalledWith({
      data: [{ userId: 7, milestoneCount: 10, amount: 2_000_000n }],
      skipDuplicates: true,
    });
  });

  it('backfills a code for an account without one', async () => {
    const prisma = mockPrisma();
    await new ReferralsService(prisma as never).mine({ id: 35, referralCode: null } as never);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 35 },
      data: { referralCode: 'SJ0000000Z' },
    });
  });

  it('redeems only an owned paid plan and activates the business atomically', async () => {
    const prisma = mockPrisma();
    const result = await new ReferralsService(prisma as never).redeem({ id: 7 } as never, { businessId: 11, planId: 4 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.business.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 11, ownerId: 7 }) }));
    expect(prisma.subscription.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 7, businessId: 11, planId: 4, status: 'ACTIVE' }) }));
    expect(prisma.referralCreditRedemption.create).toHaveBeenCalledWith({ data: expect.objectContaining({ subscriptionId: 88, amount: 2_000_000n }) });
    expect(result).toMatchObject({ subscriptionId: 88, redeemedRial: 2_000_000, balanceRial: 0 });
  });

  it('rejects spending when the balance is insufficient', async () => {
    const prisma = mockPrisma();
    prisma.referralCreditGrant.aggregate.mockResolvedValue({ _sum: { amount: 1_000_000n } });
    await expect(new ReferralsService(prisma as never).redeem({ id: 7 } as never, { businessId: 11, planId: 4 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('rejects a business not owned/eligible for activation', async () => {
    const prisma = mockPrisma();
    prisma.business.findFirst.mockResolvedValue(null);
    await expect(new ReferralsService(prisma as never).redeem({ id: 7 } as never, { businessId: 12, planId: 4 }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
