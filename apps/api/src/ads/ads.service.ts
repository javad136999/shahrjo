import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto } from './ads.dto';

/** Ads auto-expire this many days after submission (checked again at approval). */
const AD_TTL_DAYS = 30;
/** Per-user submission cap — flooding before moderation exists is pointless. */
const MAX_ADS_PER_HOUR = 20;

export interface AdCategoryItem {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

export interface CreatedAd {
  id: number;
  title: string;
  status: string;
  price: number | null;
  imageUrls: string[];
  createdAt: Date;
  expiresAt: Date | null;
}

export interface MyAdItem {
  id: number;
  title: string;
  status: string;
  price: number | null;
  coverUrl: string | null;
  imageCount: number;
  rejectedReason: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

/**
 * User ad submission (Phase 5). Every new ad enters the moderation queue as
 * PENDING — there is no code path that lets a user publish their own ad, and
 * the city always comes from the caller's validated profile selection.
 */
@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active ad categories for the submission form (public). */
  async categories(): Promise<AdCategoryItem[]> {
    return this.prisma.adCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, icon: true, color: true },
    });
  }

  async create(user: User, dto: CreateAdDto): Promise<CreatedAd> {
    if (!user.cityId) throw new BadRequestException('ابتدا شهر خودت را انتخاب کن');

    // The selected city must still be active (it may have been disabled since).
    const city = await this.prisma.city.findFirst({
      where: { id: user.cityId, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');

    const category = await this.prisma.adCategory.findFirst({
      where: { id: dto.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');

    const hourAgo = new Date(Date.now() - 3_600_000);
    const recent = await this.prisma.ad.count({ where: { userId: user.id, createdAt: { gte: hourAgo } } });
    if (recent >= MAX_ADS_PER_HOUR) {
      throw new HttpException('سقف ثبت آگهی در ساعت پر شده است؛ کمی بعد دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Images: only this user's own, fresh (not yet attached) AD uploads.
    const imageIds = dto.imageIds ?? [];
    let imageUrls: string[] = [];
    if (imageIds.length > 0) {
      const media = await this.prisma.media.findMany({
        where: { id: { in: imageIds }, ownerUserId: user.id, entityType: 'AD', entityId: null, deletedAt: null },
        select: { id: true, url: true },
      });
      if (media.length !== imageIds.length) throw new BadRequestException('یک یا چند تصویر ارسالی نامعتبر است');
      const urlById = new Map(media.map((m) => [m.id, m.url]));
      imageUrls = imageIds.map((id) => urlById.get(id)!); // preserve the user's ordering
    }

    const expiresAt = new Date(Date.now() + AD_TTL_DAYS * 86_400_000);
    const ad = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ad.create({
        data: {
          userId: user.id,
          cityId: city.id,
          categoryId: category.id,
          title: dto.title,
          description: dto.description,
          price: dto.price === undefined ? null : BigInt(dto.price),
          phone: dto.phone ?? user.phone,
          address: dto.address ?? null,
          status: 'PENDING', // moderation queue — never APPROVED from user input
          expiresAt,
        },
      });
      if (imageIds.length > 0) {
        await tx.adImage.createMany({
          data: imageUrls.map((url, index) => ({ adId: created.id, url, sortOrder: index })),
        });
        // claim the media rows so they cannot be attached to a second ad
        await tx.media.updateMany({
          where: { id: { in: imageIds } },
          data: { entityId: String(created.id) },
        });
      }
      return created;
    });

    return {
      id: ad.id,
      title: ad.title,
      status: ad.status,
      price: ad.price === null ? null : Number(ad.price),
      imageUrls,
      createdAt: ad.createdAt,
      expiresAt: ad.expiresAt,
    };
  }

  /** The caller's ads with moderation status (pending/rejected visible to owner). */
  async mine(user: User): Promise<MyAdItem[]> {
    const rows = await this.prisma.ad.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        price: true,
        rejectedReason: true,
        createdAt: true,
        expiresAt: true,
        images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
      },
    });

    return rows.map(({ images, price, ...rest }) => ({
      ...rest,
      price: price === null ? null : Number(price),
      coverUrl: images[0]?.url ?? null,
      imageCount: images.length,
    }));
  }
}
