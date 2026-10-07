import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Phase 10 — daily ad republication on every city wall («بازنشر روزانه»).
 *
 * Schedule (Asia/Tehran — Iran has no DST since 2022, fixed UTC+3:30):
 *   • 08:00 → 1 GOLD ad + 3 old ads
 *   • 12:00 → 2 old ads
 *   • 18:00 → 1 GOLD ad + 3 old ads
 *   • 22:00 → 2 old ads
 * ⇒ 2 promoted GOLD ads per day (one morning, one evening) and 10 old ads
 * spread over the four day-parts. Each ad is republished at most once per
 * day (its id is excluded as soon as it has been used) and the selection is
 * random over the eligible pool.
 *
 * Runs inside the API process on a 60s timer — no external cron, and a
 * restart inside the same day never double-posts (each slot fires once per
 * Tehran calendar day). Slots that were missed while the API was down are
 * caught up on the first tick after boot.
 */
export interface WallRepostSlot {
  /** Tehran local time of the slot. */
  hour: number;
  minute: number;
  /** Promoted posts from GOLD-subscribed owners. */
  gold: number;
  /** Reposts of old (≥7 days) ads. */
  old: number;
  /** Persian day-part label used in the post copy. */
  label: string;
}

export const WALL_REPOST_SLOTS: WallRepostSlot[] = [
  { hour: 8, minute: 0, gold: 1, old: 3, label: 'صبح' },
  { hour: 12, minute: 0, gold: 0, old: 2, label: 'ظهر' },
  { hour: 18, minute: 0, gold: 1, old: 3, label: 'عصر' },
  { hour: 22, minute: 0, gold: 0, old: 2, label: 'شب' },
];

/** How often the scheduler checks whether a slot is due. */
export const REPOST_CHECK_MS = 60_000;
/** «اگهی قدیمی» = at least this old. */
export const OLD_AD_MIN_AGE_MS = 7 * 86_400_000;
/** Upper bound of the candidate pool sampled per slot. */
const CANDIDATE_LIMIT = 500;
/** Iran standard time — fixed UTC+3:30 (no DST since 2022). */
export const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60_000;

/** Tehran wall-clock facts of `date`: calendar day + minutes since midnight. */
export function tehranClock(date: Date = new Date()): { day: string; minutes: number } {
  const shifted = new Date(date.getTime() + TEHRAN_OFFSET_MS);
  return {
    day: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** UTC instant of Tehran midnight ending the given `YYYY-MM-DD` day. */
export function tehranDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - TEHRAN_OFFSET_MS);
}

/** Fisher–Yates — uniform random pick without repeats inside the sample. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface AdCandidate {
  id: number;
  cityId: number;
  userId: number;
  title: string;
  price: bigint | null;
  images: { url: string }[];
}

const AD_SELECT = {
  id: true,
  cityId: true,
  userId: true,
  title: true,
  price: true,
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1, select: { url: true } },
} as const;

@Injectable()
export class WallRepostScheduler implements OnModuleInit {
  private readonly logger = new Logger(WallRepostScheduler.name);
  /** slot key («hour:minute») → the Tehran day it already ran for. */
  private readonly doneSlots = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const timer = setInterval(() => void this.tickSafely(), REPOST_CHECK_MS);
    timer.unref?.();
    // catch up slots missed while the process was down (same Tehran day)
    void this.tickSafely();
  }

  private async tickSafely(): Promise<void> {
    try {
      const posted = await this.tick();
      if (posted > 0) this.logger.log(`wall repost: published ${posted} ad message(s)`);
    } catch (err) {
      this.logger.warn(`wall repost tick failed: ${String(err)}`);
    }
  }

  /** Runs every due slot at most once per Tehran day; returns posts made. */
  async tick(now: Date = new Date()): Promise<number> {
    const { day, minutes } = tehranClock(now);
    for (const [key, doneFor] of this.doneSlots) {
      if (doneFor !== day) this.doneSlots.delete(key); // new day → slots re-arm
    }

    let posted = 0;
    for (const slot of WALL_REPOST_SLOTS) {
      const key = `${slot.hour}:${slot.minute}`;
      if (this.doneSlots.has(key)) continue;
      if (minutes < slot.hour * 60 + slot.minute) continue; // not due yet
      this.doneSlots.set(key, day); // marked BEFORE publishing — never twice
      posted += await this.runSlot(day, slot);
    }
    return posted;
  }

  /** One day-part: its GOLD picks first, then its old-ad picks. */
  async runSlot(day: string, slot: WallRepostSlot): Promise<number> {
    const since = tehranDayStart(day);
    const usedRows = await this.prisma.wallPost.findMany({
      where: { adId: { not: null }, createdAt: { gte: since } },
      select: { adId: true },
    });
    const used = new Set(
      usedRows.map((row) => row.adId).filter((id): id is number => typeof id === 'number'),
    );

    let posted = 0;
    for (const gold of [true, false]) {
      const take = gold ? slot.gold : slot.old;
      if (take <= 0) continue;
      const picks = await this.pickAds(gold ? 'gold' : 'old', take, used);
      for (const ad of picks) {
        await this.publish(ad, slot, gold);
        used.add(ad.id);
        posted += 1;
      }
    }
    return posted;
  }

  /** Random eligible ads, never reusing anything already used today. */
  private async pickAds(
    kind: 'gold' | 'old',
    take: number,
    exclude: Set<number>,
  ): Promise<AdCandidate[]> {
    if (take <= 0) return [];
    const now = new Date();
    const valid = [{ expiresAt: null }, { expiresAt: { gt: now } }];
    const where: Prisma.AdWhereInput = {
      status: 'APPROVED',
      OR: valid,
      ...(kind === 'old' ? { createdAt: { lte: new Date(now.getTime() - OLD_AD_MIN_AGE_MS) } } : {}),
      ...(kind === 'gold'
        ? { user: { subscriptions: { some: { tier: 'GOLD', status: 'ACTIVE', OR: valid } } } }
        : {}),
    };

    const rows = await this.prisma.ad.findMany({ where, select: AD_SELECT, take: CANDIDATE_LIMIT });
    const pool = rows.filter((ad) => !exclude.has(ad.id));
    // A GOLD slot without any eligible gold owner falls back to old ads so
    // the promised daily promoted message still lands on the wall.
    if (kind === 'gold' && pool.length === 0) return this.pickAds('old', take, exclude);
    return shuffle(pool).slice(0, take);
  }

  /** Writes the «تبلیغ زیبا» message into the ad's own city wall. */
  private async publish(ad: AdCandidate, slot: WallRepostSlot, gold: boolean): Promise<void> {
    const title = ad.title.trim();
    const content = gold
      ? `🌟 پیشنهاد ویژه ${slot.label} — ${title}`
      : `📢 تبلیغ ${slot.label}: ${title}`;
    await this.prisma.wallPost.create({
      data: {
        cityId: ad.cityId,
        userId: ad.userId,
        content,
        imageUrl: ad.images[0]?.url ?? null,
        adId: ad.id,
      },
    });
    this.logger.log(
      `wall repost ${slot.label}${gold ? ' (GOLD)' : ''}: ad #${ad.id} → city #${ad.cityId}`,
    );
  }
}
