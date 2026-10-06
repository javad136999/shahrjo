import { AnalyticsService } from './analytics.service';

type Row = { day: string; visits: number };

function makeService(rows: Row[] = []) {
  const siteVisit = {
    findMany: jest.fn().mockResolvedValue(rows),
    upsert: jest.fn().mockResolvedValue({}),
  };
  const service = new AnalyticsService({ siteVisit } as never);
  return { service, siteVisit };
}

describe('AnalyticsService', () => {
  it('formats the Iranian calendar day as YYYY-MM-DD', () => {
    const { service } = makeService();
    // 2026-10-07 21:00 UTC is already 2026-10-08 in Tehran (UTC+3:30)
    expect(service.dayKey(new Date('2026-10-07T21:00:00.000Z'))).toBe('2026-10-08');
    expect(service.dayKey(new Date('2026-10-07T10:00:00.000Z'))).toBe('2026-10-07');
  });

  it('upserts (not inserts) today’s bucket so repeats only increment', async () => {
    const { service, siteVisit } = makeService();
    await service.recordVisit();
    await service.recordVisit();

    expect(siteVisit.upsert).toHaveBeenCalledTimes(2);
    const call = siteVisit.upsert.mock.calls[0][0] as {
      where: { day: string };
      create: { visits: number };
      update: { visits: { increment: number } };
    };
    expect(call.where.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.create.visits).toBe(1);
    expect(call.update.visits.increment).toBe(1);
  });

  it('sums daily rows into monthly and yearly totals', async () => {
    const today = new AnalyticsService({} as never).dayKey();
    // an earlier day of the same month (never collides with `today`)
    const earlier = today.slice(0, 8) + (today.slice(8) === '01' ? '02' : '01');
    const rows: Row[] = [
      { day: today, visits: 7 },
      { day: earlier, visits: 3 },
      { day: `${Number(today.slice(0, 4)) - 1}-12-31`, visits: 5 }, // last year
    ];
    const { service } = makeService(rows);

    const stats = await service.stats();

    expect(stats.daily.total).toBe(7); // today
    expect(stats.monthly.total).toBe(10); // 7 + 3 in the current month
    expect(stats.yearly.total).toBe(10); // current-year rows only
    expect(stats.daily.series).toHaveLength(30);
    expect(stats.monthly.series).toHaveLength(12);
    expect(stats.yearly.series.map((y) => y.key)).toContain(String(Number(today.slice(0, 4)) - 1));
    // the current day sits at the end of the daily window
    expect(stats.daily.series.at(-1)).toEqual({ key: today, visits: 7 });
  });

  it('returns zeros when nothing was tracked yet', async () => {
    const { service } = makeService([]);
    const stats = await service.stats();
    expect(stats.daily.total).toBe(0);
    expect(stats.monthly.total).toBe(0);
    expect(stats.yearly.total).toBe(0);
    expect(stats.daily.series.every((p) => p.visits === 0)).toBe(true);
  });
});
