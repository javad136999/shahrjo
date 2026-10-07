import type { PrismaService } from '../prisma/prisma.service';
import {
  TEHRAN_OFFSET_MS,
  WALL_REPOST_SLOTS,
  WallRepostScheduler,
  tehranClock,
  tehranDayStart,
} from './wall.scheduler';

function makePrisma() {
  return {
    wallPost: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    ad: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function makeScheduler() {
  const prisma = makePrisma();
  const scheduler = new WallRepostScheduler(prisma as unknown as PrismaService);
  return { scheduler, prisma };
}

function ad(id: number) {
  return {
    id,
    cityId: 5,
    userId: 4,
    title: `آگهی ${id}`,
    price: BigInt(1_000_000),
    images: [{ url: `/api/v1/files/media/2026/10/ad${id}.webp` }],
  };
}

const DAY = '2026-10-08';

describe('repost plan (2 GOLD + 10 old ads per day)', () => {
  it('runs four day-parts and puts GOLD ads in the morning and the evening', () => {
    expect(WALL_REPOST_SLOTS).toHaveLength(4);
    const gold = WALL_REPOST_SLOTS.filter((s) => s.gold > 0);
    expect(gold.map((s) => s.hour)).toEqual([8, 18]);
    expect(gold.every((s) => s.gold === 1)).toBe(true);
    expect(WALL_REPOST_SLOTS.reduce((sum, s) => sum + s.gold, 0)).toBe(2);
  });

  it('reposts exactly 10 old ads — at least 2 in every day-part', () => {
    const oldTotal = WALL_REPOST_SLOTS.reduce((sum, s) => sum + s.old, 0);
    expect(oldTotal).toBe(10);
    for (const slot of WALL_REPOST_SLOTS) expect(slot.old).toBeGreaterThanOrEqual(2);
    // strictly increasing through the day
    const hours = WALL_REPOST_SLOTS.map((s) => s.hour);
    expect([...hours].sort((a, b) => a - b)).toEqual(hours);
  });
});

describe('tehranClock / tehranDayStart', () => {
  it('converts UTC instants to the fixed UTC+3:30 wall clock', () => {
    // 20:30 UTC = 00:00 Tehran (next day)
    const justBefore = new Date('2026-10-07T20:30:00.000Z');
    expect(tehranClock(justBefore)).toEqual({ day: '2026-10-08', minutes: 0 });
    // 04:30 UTC = 08:00 Tehran
    expect(tehranClock(new Date('2026-10-08T04:30:00.000Z'))).toEqual({ day: '2026-10-08', minutes: 480 });
    expect(TEHRAN_OFFSET_MS).toBe(3.5 * 3_600_000);
  });

  it('derives Tehran midnight as the day-start cursor', () => {
    expect(tehranDayStart(DAY).toISOString()).toBe('2026-10-07T20:30:00.000Z');
  });
});

describe('WallRepostScheduler.tick', () => {
  it('publishes nothing before the first slot of the day', async () => {
    const { scheduler, prisma } = makeScheduler();
    // 07:59 Tehran = 04:29 UTC
    const posted = await scheduler.tick(new Date('2026-10-08T04:29:00.000Z'));
    expect(posted).toBe(0);
    expect(prisma.wallPost.create).not.toHaveBeenCalled();
  });

  it('fires every due slot exactly once per Tehran day (no double posting)', async () => {
    const { scheduler, prisma } = makeScheduler();
    prisma.ad.findMany.mockResolvedValue([ad(1), ad(2), ad(3), ad(4), ad(5)]);

    // end of the day: all four slots are due
    const first = await scheduler.tick(new Date('2026-10-08T20:00:00.000Z')); // 23:30 Tehran
    expect(first).toBe(12); // (1+3) + 2 + (1+3) + 2
    const afterFirst = prisma.wallPost.create.mock.calls.length;
    expect(afterFirst).toBe(12);

    // same day, later — every slot is already done
    expect(await scheduler.tick(new Date('2026-10-08T20:30:00.000Z'))).toBe(0);
    expect(prisma.wallPost.create.mock.calls.length).toBe(afterFirst);

    // next day the slots re-arm
    prisma.wallPost.findMany.mockResolvedValue([]);
    const nextDay = await scheduler.tick(new Date('2026-10-09T20:00:00.000Z'));
    expect(nextDay).toBe(12);
  });

  it('spreads a slot over morning/noon/evening/night with at least 2 old ads each', () => {
    for (const slot of WALL_REPOST_SLOTS) {
      expect(slot.old).toBeGreaterThanOrEqual(2);
      expect(slot.label).toBeTruthy();
    }
    const labels = WALL_REPOST_SLOTS.map((s) => s.label);
    expect(labels).toEqual(['صبح', 'ظهر', 'عصر', 'شب']);
  });
});

describe('WallRepostScheduler.runSlot', () => {
  it('never reuses an ad already republished today and posts a beautiful ad message', async () => {
    const { scheduler, prisma } = makeScheduler();
    // ad #2 was already republished earlier today
    prisma.wallPost.findMany.mockResolvedValue([{ adId: 2 }]);
    prisma.ad.findMany.mockResolvedValue([ad(1), ad(2), ad(3), ad(4)]);

    const posted = await scheduler.runSlot(DAY, {
      hour: 12,
      minute: 0,
      gold: 0,
      old: 3,
      label: 'ظهر',
    });

    expect(posted).toBe(3);
    const used = prisma.wallPost.create.mock.calls.map((c) => c[0].data.adId);
    expect(used.sort((a, b) => a - b)).toEqual([1, 3, 4]); // #2 excluded — no repeats
    expect(prisma.wallPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cityId: 5,
          userId: 4,
          adId: expect.any(Number),
          imageUrl: expect.stringContaining('/api/v1/files/'),
        }),
      }),
    );
    const content = prisma.wallPost.create.mock.calls[0][0].data.content as string;
    expect(content).toContain('آگهی');
    expect(content).toContain('ظهر');
  });

  it('selects GOLD ads from owners with an active gold subscription', async () => {
    const { scheduler, prisma } = makeScheduler();
    prisma.ad.findMany.mockResolvedValueOnce([ad(9)]);

    await scheduler.runSlot(DAY, { hour: 8, minute: 0, gold: 1, old: 0, label: 'صبح' });

    const where = prisma.ad.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('APPROVED');
    expect(where.user.subscriptions.some).toMatchObject({
      tier: 'GOLD',
      status: 'ACTIVE',
    });
    expect(prisma.wallPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ adId: 9 }) }),
    );
    const content = prisma.wallPost.create.mock.calls[0][0].data.content as string;
    expect(content).toContain('پیشنهاد ویژه');
  });

  it('falls back to old ads when no gold-subscribed owner has an eligible ad', async () => {
    const { scheduler, prisma } = makeScheduler();
    prisma.ad.findMany
      .mockResolvedValueOnce([]) // gold query: nobody eligible
      .mockResolvedValueOnce([ad(7)]); // fallback (old) query

    const posted = await scheduler.runSlot(DAY, {
      hour: 18,
      minute: 0,
      gold: 1,
      old: 0,
      label: 'عصر',
    });

    expect(posted).toBe(1);
    expect(prisma.ad.findMany).toHaveBeenCalledTimes(2);
    // the fallback pool only accepts ads at least 7 days old
    const fallbackWhere = prisma.ad.findMany.mock.calls[1][0].where;
    expect(fallbackWhere.createdAt).toHaveProperty('lte');
    expect(prisma.wallPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ adId: 7 }) }),
    );
  });

  it('counts ad candidates as used the moment they are published inside one slot', async () => {
    const { scheduler, prisma } = makeScheduler();
    prisma.ad.findMany.mockResolvedValue([ad(1), ad(2), ad(3), ad(4)]);

    const posted = await scheduler.runSlot(DAY, {
      hour: 8,
      minute: 0,
      gold: 1,
      old: 3,
      label: 'صبح',
    });

    expect(posted).toBe(4);
    const used = prisma.wallPost.create.mock.calls.map((c) => c[0].data.adId);
    expect(new Set(used).size).toBe(4); // gold pick ∉ old picks
  });
});
