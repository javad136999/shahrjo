import { ReferralsService } from './referrals.module';

function mockPrisma() {
  return {
    user: {
      count: jest.fn().mockResolvedValue(5),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('ReferralsService', () => {
  it('returns invite code, counts successful signups and marks only reached milestones', async () => {
    const prisma = mockPrisma();
    const service = new ReferralsService(prisma as never);
    const result = await service.mine({ id: 7, referralCode: 'SJABCD1234' } as never);

    expect(prisma.user.count).toHaveBeenCalledWith({ where: { referredByUserId: 7, status: 'ACTIVE' } });
    expect(result.code).toBe('SJABCD1234');
    expect(result.successfulSignups).toBe(5);
    expect(result.milestones.map((item) => item.achieved)).toEqual([true, false, false, false, false]);
    expect(result.milestones[0]).toMatchObject({ tier: 'SILVER', months: 1, valueToman: 200_000 });
    expect(result.milestones[4]).toMatchObject({ cashToman: 1_000_000, cashStatus: undefined });
  });

  it('reports the hundred-member reward as requiring manual payment review', async () => {
    const prisma = mockPrisma();
    prisma.user.count.mockResolvedValue(100);
    const result = await new ReferralsService(prisma as never).mine({ id: 8, referralCode: 'SJ100' } as never);
    expect(result.milestones.every((item) => item.achieved)).toBe(true);
    expect(result.milestones[4]).toMatchObject({
      count: 100,
      tier: 'GOLD',
      months: 3,
      cashToman: 1_000_000,
      cashStatus: 'NEEDS_ADMIN_REVIEW',
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
});
