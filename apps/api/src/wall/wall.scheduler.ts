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
 * ⇒ 2 promoted GOLD ads and 10 old ads per day. Separately, five approved
 * business profiles are published at daily, date-seeded random times. The
 * business picker always chooses from the least-published businesses first,
 * creating a fair round-robin over the whole directory.
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
  /** Promoted GOLD-business messages (morning + evening only). */
  promo: number;
  /** Persian day-part label used in the post copy. */
  label: string;
}

export const WALL_REPOST_SLOTS: WallRepostSlot[] = [
  { hour: 8, minute: 0, gold: 1, old: 3, promo: 1, label: 'صبح' },
  { hour: 12, minute: 0, gold: 0, old: 2, promo: 0, label: 'ظهر' },
  { hour: 18, minute: 0, gold: 1, old: 3, promo: 1, label: 'عصر' },
  { hour: 22, minute: 0, gold: 0, old: 2, promo: 0, label: 'شب' },
];

/** How often the scheduler checks whether a slot is due. */
export const REPOST_CHECK_MS = 60_000;
/** Ordinary ad reposts stay off unless explicitly enabled by the operator. */
export const WALL_REPOSTS_ENABLED = process.env.ENABLE_WALL_REPOSTS === 'true';
/** GOLD business promotions remain on unless explicitly disabled by the operator. */
export const GOLD_BUSINESS_PROMOS_ENABLED = process.env.ENABLE_GOLD_BUSINESS_PROMOS !== 'false';
/** Five approved business profiles are published each Tehran day. */
export const REGISTERED_BUSINESS_PROMOS_ENABLED = process.env.ENABLE_REGISTERED_BUSINESS_PROMOS !== 'false';
export const REGISTERED_BUSINESS_PROMO_COUNT = 5;
/** Daily directory promotions remain on unless explicitly disabled. */
export const SERVICE_LISTING_PROMOS_ENABLED = process.env.ENABLE_SERVICE_LISTING_PROMOS !== 'false';
export const SERVICE_LISTING_PROMO_MINUTES = 10 * 60;
/** Cities included in the one-time backfill of existing service listings. */
export const INITIAL_SERVICE_PROMO_CITY_SLUGS = ['jam', 'bushehr-city', 'kangan', 'shiraz'] as const;
const INITIAL_SERVICE_PROMO_MARKER = '📣 معرفی ویژهٔ مشاغل شهرجو';
/** «اگهی قدیمی» = at least this old. */
export const OLD_AD_MIN_AGE_MS = 7 * 86_400_000;
/** Upper bound of the candidate pool sampled per slot. */
const CANDIDATE_LIMIT = 500;
/** Iran standard time — fixed UTC+3:30 (no DST since 2022). */
export const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60_000;

/**
 * Five date-seeded random times. A restart keeps the same day's timetable,
 * while the times change on the next Tehran day.
 */
export function registeredBusinessPromoSlots(day: string): WallRepostSlot[] {
  const windows = [
    { start: 7 * 60, end: 10 * 60, label: 'صبح' },
    { start: 10 * 60, end: 13 * 60, label: 'ظهر' },
    { start: 13 * 60, end: 16 * 60, label: 'بعدازظهر' },
    { start: 16 * 60, end: 20 * 60, label: 'عصر' },
    { start: 20 * 60, end: 23 * 60, label: 'شب' },
  ];
  let seed = [...day].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
  return windows.map((window) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const minutes = window.start + (seed % (window.end - window.start));
    return { hour: Math.floor(minutes / 60), minute: minutes % 60, gold: 0, old: 0, promo: 1, label: window.label };
  });
}

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

/** Fields the promo copy needs from a GOLD business. */
interface PromoCandidate {
  id: number;
  cityId: number;
  ownerId: number;
  name: string;
  address: string | null;
  description: string | null;
  category: { name: string; icon: string | null };
}

/**
 * «پیام تبلیغاتی جذاب» — a short, friendly post written from the owner's own
 * data (never invented claims): opener by day-part, category + address, then
 * the business's own description trimmed to one line.
 */
function promoCopy(business: PromoCandidate, slot: WallRepostSlot): string {
  const hook = (business.description ?? '').replace(/\s+/g, ' ').trim();
  const opener =
    slot.label === 'صبح'
      ? `🌅 صبح بخیر شهر! ${business.name} روزتان را شروع می‌کند`
      : `🌇 عصرتان خوش، شهریان! سری به ${business.name} بزنید`;
  const meta = [
    `${business.category.icon ?? '◆'} ${business.category.name}`,
    business.address ? `📍 ${business.address}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const body = hook.length > 160 ? `${hook.slice(0, 160)}…` : hook;
  return [opener, meta, body].filter((line) => line && line.length > 0).join('\n');
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
  private readonly automation = {
    ads: WALL_REPOSTS_ENABLED,
    promo: GOLD_BUSINESS_PROMOS_ENABLED,
    registeredBusinessPromo: REGISTERED_BUSINESS_PROMOS_ENABLED,
    servicePromo: SERVICE_LISTING_PROMOS_ENABLED,
  };

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (!this.automation.ads && !this.automation.promo && !this.automation.registeredBusinessPromo && !this.automation.servicePromo) {
      this.logger.log('wall repost and GOLD business promo automation disabled');
      return;
    }
    await this.initializeAndSchedule();
  }

  private async initializeAndSchedule(): Promise<void> {
    try {
      if (this.automation.servicePromo) await this.publishInitialCityServicePromos();
      // Catch up the daily slot after the one-time city campaign, so a daily
      // random pick remains separate from the initial featured post.
      await this.tickSafely();
    } catch (err) {
      this.logger.warn(`wall promo initialization failed: ${String(err)}`);
    }
    const timer = setInterval(() => void this.tickSafely(), REPOST_CHECK_MS);
    timer.unref?.();
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
    const serviceKey = 'service-listing-promo';
    if (this.automation.servicePromo && minutes >= SERVICE_LISTING_PROMO_MINUTES && !this.doneSlots.has(serviceKey)) {
      this.doneSlots.set(serviceKey, day);
      posted += await this.publishServicePromos(day);
    }
    if (this.automation.registeredBusinessPromo) {
      for (const [index, slot] of registeredBusinessPromoSlots(day).entries()) {
        const key = `registered-business:${index}`;
        if (this.doneSlots.has(key) || minutes < slot.hour * 60 + slot.minute) continue;
        this.doneSlots.set(key, day);
        posted += await this.publishRegisteredBusinessPromo(day, slot);
      }
    }
    for (const slot of WALL_REPOST_SLOTS) {
      const key = `${slot.hour}:${slot.minute}`;
      if (this.doneSlots.has(key)) continue;
      if (minutes < slot.hour * 60 + slot.minute) continue; // not due yet
      this.doneSlots.set(key, day); // marked BEFORE publishing — never twice
      posted += await this.runSlot(day, slot, {
        ads: this.automation.ads,
        promo: this.automation.promo && !this.automation.registeredBusinessPromo,
      });
    }
    return posted;
  }

  /** One day-part: its GOLD picks first, then its old-ad picks. */
  async runSlot(
    day: string,
    slot: WallRepostSlot,
    options: { ads: boolean; promo: boolean } = { ads: true, promo: true },
  ): Promise<number> {
    let posted = 0;
    if (options.ads) {
      const since = tehranDayStart(day);
      const usedRows = await this.prisma.wallPost.findMany({
        where: { adId: { not: null }, createdAt: { gte: since } },
        select: { adId: true },
      });
      const used = new Set(
        usedRows.map((row) => row.adId).filter((id): id is number => typeof id === 'number'),
      );
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
    }
    if (options.promo) posted += await this.publishPromo(day, slot);
    return posted;
  }

  /**
   * One GOLD business message per morning/evening slot: random among businesses
   * with the fewest historical promo posts, never twice in the same Tehran day.
   * Posts land on the business's own city wall, authored by its owner.
   */
  async publishPromo(day: string, slot: WallRepostSlot): Promise<number> {
    if (slot.promo <= 0) return 0;

    const since = tehranDayStart(day);
    const todayRows = await this.prisma.wallPost.findMany({
      where: { businessId: { not: null }, createdAt: { gte: since } },
      select: { businessId: true },
    });
    // Persist the daily cap in wall_posts so API restarts cannot catch up a slot
    // repeatedly and publish more than two GOLD promo messages in one day.
    if (todayRows.length >= 2) return 0;
    const usedToday = new Set(
      todayRows.map((row) => row.businessId).filter((id): id is number => id !== null),
    );

    const now = new Date();
    const rows = await this.prisma.business.findMany({
      where: {
        status: 'APPROVED',
        subscriptionTier: 'GOLD',
        subscriptionStatus: 'ACTIVE',
        showcaseEnabled: true,
        subscriptionExpiresAt: { gt: now },
      },
      select: {
        id: true,
        cityId: true,
        ownerId: true,
        name: true,
        address: true,
        description: true,
        category: { select: { name: true, icon: true } },
      },
    });

    // strict: never twice in one day (morning + evening pick different ones)
    const pool = rows.filter((business) => !usedToday.has(business.id));
    if (pool.length === 0) return 0;
    const counts = await this.prisma.wallPost.groupBy({
      by: ['businessId'],
      where: { businessId: { in: pool.map((business) => business.id) } },
      _count: { businessId: true },
    });
    const postCount = new Map(counts.map((row) => [row.businessId, row._count.businessId]));
    const leastPromoted = Math.min(...pool.map((business) => postCount.get(business.id) ?? 0));
    const leastPromotedPool = pool.filter(
      (business) => (postCount.get(business.id) ?? 0) === leastPromoted,
    );
    const pick = shuffle(leastPromotedPool)[0];

    await this.prisma.wallPost.create({
      data: {
        cityId: pick.cityId,
        userId: pick.ownerId,
        content: promoCopy(pick, slot),
        businessId: pick.id,
      },
    });
    this.logger.log(`wall promo ${slot.label}: business #${pick.id} → city #${pick.cityId}`);
    return 1;
  }

  /** Publishes one approved business profile, fairly rotating through all cities. */
  async publishRegisteredBusinessPromo(day: string, slot: WallRepostSlot): Promise<number> {
    const since = tehranDayStart(day);
    const todayRows = await this.prisma.wallPost.findMany({
      where: { businessId: { not: null }, createdAt: { gte: since } },
      select: { businessId: true },
    });
    const usedToday = new Set(todayRows.map((row) => row.businessId).filter((id): id is number => id !== null));
    const rows = await this.prisma.business.findMany({
      where: {
        status: 'APPROVED',
        city: { isActive: true, province: { isActive: true } },
      },
      select: {
        id: true,
        cityId: true,
        ownerId: true,
        name: true,
        address: true,
        description: true,
        category: { select: { name: true, icon: true } },
      },
    });
    const pool = rows.filter((business) => !usedToday.has(business.id));
    if (pool.length === 0) return 0;
    const counts = await this.prisma.wallPost.groupBy({
      by: ['businessId'],
      where: { businessId: { in: pool.map((business) => business.id) } },
      _count: { businessId: true },
    });
    const postCount = new Map(counts.map((row) => [row.businessId, row._count.businessId]));
    const leastPublished = Math.min(...pool.map((business) => postCount.get(business.id) ?? 0));
    const leastPublishedPool = pool.filter((business) => (postCount.get(business.id) ?? 0) === leastPublished);
    const pick = shuffle(leastPublishedPool)[0];
    if (!pick) return 0;

    await this.prisma.wallPost.create({
      data: {
        cityId: pick.cityId,
        userId: pick.ownerId,
        content: promoCopy(pick, slot),
        businessId: pick.id,
      },
    });
    this.logger.log(`registered business promo ${slot.label}: business #${pick.id} → city #${pick.cityId}`);
    return 1;
  }

  /**
   * Publishes one random active directory job in every active city once a day.
   * These are entries created from the «ثبت شغل» tile, not paid Business profiles.
   */
  async publishServicePromos(day: string): Promise<number> {
    const since = tehranDayStart(day);
    const usedRows = await this.prisma.wallPost.findMany({
      where: { serviceListingId: { not: null }, createdAt: { gte: since } },
      select: { serviceListingId: true, cityId: true, content: true },
    });
    const usedToday = new Set(usedRows.map((row) => row.serviceListingId).filter((id): id is number => id !== null));
    const dailyRows = usedRows.filter((row) => row.content.startsWith('📣 معرفی شغل امروز:'));
    const dailyPostedCityIds = new Set(dailyRows.map((row) => row.cityId));
    const rows = await this.prisma.serviceListing.findMany({
      where: {
        isActive: true,
        city: { isActive: true, province: { isActive: true } },
        category: { isActive: true, isService: true },
      },
      select: {
        id: true, cityId: true, ownerId: true, name: true, phone: true, description: true,
        category: { select: { name: true, icon: true } },
      },
    });
    const byCity = new Map<number, typeof rows>();
    for (const row of rows) {
      const cityRows = byCity.get(row.cityId) ?? [];
      cityRows.push(row);
      byCity.set(row.cityId, cityRows);
    }
    let posted = 0;
    for (const cityRows of byCity.values()) {
      if (dailyPostedCityIds.has(cityRows[0]?.cityId ?? -1)) continue;
      // Prefer a listing not already promoted today; if the one-time backfill
      // featured every listing in the city, still keep the separate daily slot.
      const notFeaturedToday = cityRows.filter((listing) => !usedToday.has(listing.id));
      const pick = shuffle(notFeaturedToday.length > 0 ? notFeaturedToday : cityRows)[0];
      if (!pick) continue;
      const description = (pick.description ?? '').replace(/\s+/g, ' ').trim();
      const body = description.length > 140 ? `${description.slice(0, 140)}…` : description;
      const content = [
        `📣 معرفی شغل امروز: ${pick.name}`,
        `${pick.category.icon ?? '🛠️'} ${pick.category.name}`,
        `📞 شماره تماس: ${pick.phone}`,
        body,
      ].filter(Boolean).join('\n');
      await this.prisma.wallPost.create({
        data: { cityId: pick.cityId, userId: pick.ownerId, content, serviceListingId: pick.id },
      });
      posted += 1;
      this.logger.log(`service promo: listing #${pick.id} → city #${pick.cityId}`);
    }
    return posted;
  }

  /** One-time idempotent backfill: post every active listing in the four requested cities. */
  async publishInitialCityServicePromos(): Promise<number> {
    const cities = await this.prisma.city.findMany({
      where: {
        slug: { in: [...INITIAL_SERVICE_PROMO_CITY_SLUGS] },
        isActive: true,
        province: { isActive: true },
      },
      select: { id: true, name: true, slug: true },
    });
    if (cities.length === 0) return 0;

    const listings = await this.prisma.serviceListing.findMany({
      where: {
        cityId: { in: cities.map((city) => city.id) },
        isActive: true,
        category: { isActive: true, isService: true },
      },
      select: {
        id: true, cityId: true, ownerId: true, name: true, phone: true, description: true,
        category: { select: { name: true, icon: true } },
      },
    });
    if (listings.length === 0) return 0;

    // A daily random promo already fulfils the “one ad per registered job”
    // requirement for that listing. Skip it rather than duplicating its card.
    const existingRows = await this.prisma.wallPost.findMany({
      where: { serviceListingId: { in: listings.map((listing) => listing.id) } },
      select: { serviceListingId: true },
    });
    const alreadyFeatured = new Set(existingRows.map((post) => post.serviceListingId).filter((id): id is number => id !== null));
    const cityById = new Map(cities.map((city) => [city.id, city]));
    const missing = listings.filter((listing) => !alreadyFeatured.has(listing.id));
    const data = missing.flatMap((listing) => {
      const city = cityById.get(listing.cityId);
      if (!city) return [];
      const description = (listing.description ?? '').replace(/\s+/g, ' ').trim();
      const body = description.length > 140 ? `${description.slice(0, 140)}…` : description;
      const content = [
        `${INITIAL_SERVICE_PROMO_MARKER} ${city.name}`,
        `${listing.category.icon ?? '🛠️'} ${listing.category.name}`,
        `🧰 ${listing.name}`,
        `📞 شماره تماس: ${listing.phone}`,
        body,
      ].filter(Boolean).join('\n');
      return [{ cityId: city.id, userId: listing.ownerId, content, serviceListingId: listing.id }];
    });
    if (data.length === 0) return 0;

    const result = await this.prisma.wallPost.createMany({ data });
    this.logger.log(`initial service promo backfill: published ${result.count} listing(s) in requested cities`);
    return result.count;
  }

  /** Immediately features a newly registered service in its own city wall. */
  async publishServiceListingImmediately(listingId: number): Promise<number> {
    const listing = await this.prisma.serviceListing.findFirst({
      where: {
        id: listingId,
        isActive: true,
        city: { isActive: true, province: { isActive: true } },
        category: { isActive: true, isService: true },
      },
      select: {
        id: true, cityId: true, ownerId: true, name: true, phone: true, description: true,
        category: { select: { name: true, icon: true } },
      },
    });
    if (!listing) return 0;
    const existing = await this.prisma.wallPost.findFirst({
      where: { cityId: listing.cityId, serviceListingId: listing.id },
      select: { id: true },
    });
    if (existing) return 0;

    const description = (listing.description ?? '').replace(/\s+/g, ' ').trim();
    const body = description.length > 140 ? `${description.slice(0, 140)}…` : description;
    const content = [
      `📣 شغل تازه در دیوار شهر: ${listing.name}`,
      `${listing.category.icon ?? '🛠️'} ${listing.category.name}`,
      `📞 شماره تماس: ${listing.phone}`,
      body,
    ].filter(Boolean).join('\n');
    await this.prisma.wallPost.create({
      data: { cityId: listing.cityId, userId: listing.ownerId, content, serviceListingId: listing.id },
    });
    this.logger.log(`instant service promo: listing #${listing.id} → city #${listing.cityId}`);
    return 1;
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
      // Ads whose wall post was removed are legacy deleted listings; never
      // resurrect them through the daily republication scheduler.
      wallPosts: { some: {} },
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
