import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** One bucket of a visit series (`key` = day / month / year). */
export interface VisitPoint {
  key: string;
  visits: number;
}

export interface VisitSeries {
  /** value of the current bucket: today / this month / this year */
  total: number;
  /** trailing window: 30 days / 12 months / 3 years */
  series: VisitPoint[];
}

export interface VisitStats {
  daily: VisitSeries;
  monthly: VisitSeries;
  yearly: VisitSeries;
}

const TZ = 'Asia/Tehran';
const DAY_MS = 86_400_000;

/**
 * Site-visit analytics: one row per Iranian calendar day (`site_visits.day`).
 * The web app pings the public beacon; the admin panel reads the aggregates.
 * Daily rows are the single source of truth — months and years are summed
 * from them, so no extra tables or cron jobs are needed.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Iranian calendar day (`YYYY-MM-DD`) — `en-CA` yields ISO-style output. */
  dayKey(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  /** Counts one visit into today's bucket (upsert + increment). */
  async recordVisit(): Promise<{ recorded: boolean }> {
    const day = this.dayKey();
    await this.prisma.siteVisit.upsert({
      where: { day },
      create: { day, visits: 1 },
      update: { visits: { increment: 1 } },
    });
    return { recorded: true };
  }

  /** Daily / monthly / yearly visit stats for the admin panel. */
  async stats(): Promise<VisitStats> {
    const now = new Date();
    const today = this.dayKey(now);
    const from = this.dayKey(new Date(now.getTime() - 3 * 366 * DAY_MS));
    const rows = await this.prisma.siteVisit.findMany({
      where: { day: { gte: from } },
      orderBy: { day: 'asc' },
      select: { day: true, visits: true },
    });
    const byDay = new Map(rows.map((r) => [r.day, r.visits]));
    const sumBy = (prefix: string): number =>
      rows.reduce((acc, r) => (r.day.startsWith(prefix) ? acc + r.visits : acc), 0);

    const daily = this.lastDays(now, 30).map((key) => ({ key, visits: byDay.get(key) ?? 0 }));
    const monthlyKeys = this.lastMonths(now, 12);
    const yearlyKeys = this.lastYears(now, 3);

    return {
      daily: { total: byDay.get(today) ?? 0, series: daily },
      monthly: { total: sumBy(today.slice(0, 7)), series: monthlyKeys.map((key) => ({ key, visits: sumBy(key) })) },
      yearly: { total: sumBy(today.slice(0, 4)), series: yearlyKeys.map((key) => ({ key, visits: sumBy(key) })) },
    };
  }

  private lastDays(now: Date, count: number): string[] {
    return Array.from({ length: count }, (_, i) => this.dayKey(new Date(now.getTime() - (count - 1 - i) * DAY_MS)));
  }

  private lastMonths(now: Date, count: number): string[] {
    const base = this.dayKey(now);
    const year = Number(base.slice(0, 4));
    const month = Number(base.slice(5, 7));
    return Array.from({ length: count }, (_, i) => {
      const offset = count - 1 - i;
      const total = (year * 12 + (month - 1)) - offset;
      const y = Math.floor(total / 12);
      const m = (total % 12) + 1;
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
    });
  }

  private lastYears(now: Date, count: number): string[] {
    const year = Number(this.dayKey(now).slice(0, 4));
    return Array.from({ length: count }, (_, i) => String(year - (count - 1 - i)));
  }
}
