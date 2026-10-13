import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { RbacService } from '../rbac/rbac.service';
import { UploadsService } from '../uploads/uploads.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto, UpdateAdDto } from './ads.dto';

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

export interface AdDetail {
  id: number;
  title: string;
  description: string;
  price: number | null;
  phone: string | null;
  address: string | null;
  status: string;
  viewCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  /** owner-only moderation detail — always null for other viewers */
  rejectedReason: string | null;
  images: string[];
  category: { id: number; name: string; slug: string; icon: string | null; color: string | null };
  city: { id: number; name: string; slug: string };
  isOwner: boolean;
  favorited: boolean;
}

/**
 * User ad submission (Phase 5). A submitted ad is published right away
 * (APPROVED + publishedAt) — the owner edits their own listing through
 * PATCH /ads/:id, and admins can still take it down from the admin queue.
 * The city always comes from the caller's validated profile selection.
 */
@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly uploads: UploadsService,
  ) {}

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
          // Self-serve publishing: the owner's ad goes live immediately
          // (moderation stays available through the admin queue afterwards).
          status: 'APPROVED',
          publishedAt: new Date(),
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
      // Put the newly published ad straight into its city's wall.
      await tx.wallPost.create({
        data: {
          cityId: city.id,
          userId: user.id,
          adId: created.id,
          content: 'آگهی تازه در دیوار شهر',
        },
      });
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

  /**
   * Single ad detail (Phase 6). Public for approved, unexpired ads; the owner
   * additionally sees their own ad in any status (preview before moderation).
   * Views are counted for everyone except the owner.
   */
  async detail(id: number, viewer: User | null): Promise<AdDetail> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        title: true,
        description: true,
        price: true,
        phone: true,
        address: true,
        viewCount: true,
        rejectedReason: true,
        expiresAt: true,
        publishedAt: true,
        createdAt: true,
        city: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
      },
    });
    if (!ad) throw new NotFoundException('آگهی یافت نشد');

    const isOwner = viewer !== null && viewer.id === ad.userId;
    const expired = ad.expiresAt !== null && ad.expiresAt <= new Date();
    if (!(ad.status === 'APPROVED' && !expired) && !isOwner) throw new NotFoundException('آگهی یافت نشد');

    let viewCount = ad.viewCount;
    if (!isOwner) {
      const updated = await this.prisma.ad.update({
        where: { id: ad.id },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      });
      viewCount = updated.viewCount;
    }

    let favorited = false;
    if (viewer) {
      const count = await this.prisma.favorite.count({
        where: { userId: viewer.id, targetType: 'AD', adId: ad.id },
      });
      favorited = count > 0;
    }

    const { userId, images, price, ...rest } = ad;
    return {
      ...rest,
      price: price === null ? null : Number(price),
      images: images.map((image) => image.url),
      viewCount,
      rejectedReason: isOwner ? ad.rejectedReason : null,
      isOwner,
      favorited,
    };
  }

  /**
   * Owner edit of their own ad (long-press ✏️ on the wall card).
   *
   * Only the fields the client sent are touched; `city`/`category` are never
   * accepted here. Passing `imageIds` replaces the whole gallery (the ids
   * must be this user's fresh AD uploads, exactly like on create), while
   * omitting it keeps the current pictures. Editing does not re-enter the
   * moderation queue — the ad stays live with its status intact.
   */
  async update(user: User, id: number, dto: UpdateAdDto): Promise<CreatedAd> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!ad || String(ad.status) === 'DELETED') throw new NotFoundException('آگهی یافت نشد');
    if (ad.userId !== user.id) throw new ForbiddenException('فقط مالک آگهی می‌تواند آن را ویرایش کند');

    const data: Prisma.AdUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = dto.price === null ? null : BigInt(dto.price);
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;

    let imageUrls: string[] | null = null;
    if (dto.imageIds !== undefined) {
      const imageIds = dto.imageIds;
      if (imageIds.length > 0) {
        const media = await this.prisma.media.findMany({
          where: { id: { in: imageIds }, ownerUserId: user.id, entityType: 'AD', entityId: null, deletedAt: null },
          select: { id: true, url: true },
        });
        if (media.length !== imageIds.length) throw new BadRequestException('یک یا چند تصویر ارسالی نامعتبر است');
        const urlById = new Map(media.map((m) => [m.id, m.url]));
        imageUrls = imageIds.map((id) => urlById.get(id)!); // preserve the user's ordering
      } else {
        imageUrls = [];
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ad.update({ where: { id }, data });
      if (imageUrls !== null) {
        // drop the old gallery…
        await tx.adImage.deleteMany({ where: { adId: id } });
        if (imageUrls.length > 0) {
          await tx.adImage.createMany({
            data: imageUrls.map((url, index) => ({ adId: id, url, sortOrder: index })),
          });
        }
        // …and hand the freshly uploaded rows over to this ad
        await tx.media.updateMany({
          where: { id: { in: dto.imageIds ?? [] } },
          data: { entityId: String(id) },
        });
      }
      return row;
    });

    const stored = imageUrls ?? (await this.prisma.adImage.findMany({
      where: { adId: id },
      orderBy: { sortOrder: 'asc' },
      select: { url: true },
    })).map((row) => row.url);

    return {
      id: updated.id,
      title: updated.title,
      status: String(updated.status),
      price: updated.price === null ? null : Number(updated.price),
      imageUrls: stored,
      createdAt: updated.createdAt,
      expiresAt: updated.expiresAt,
    };
  }

  /**
   * Remove an ad — from the city wall *and* the ads feeds at once.
   *
   * The wall stores daily republications with `adId` and only renders posts
   * whose ad is still PENDING/APPROVED (`visiblePosts`), so marking the ad
   * DELETED takes its cards off every wall immediately. The gallery files are
   * purged here as well: the row keeps its `imageUrls`-equivalent references
   * but nothing can reach them any more, so the bytes must go.
   * Allowed for the ad's owner and for any moderator (RBAC scope).
   */
  async remove(user: User, id: number): Promise<{ id: number; status: string; removedFiles: number }> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!ad || String(ad.status) === 'DELETED') throw new NotFoundException('آگهی یافت نشد');

    const scope = await this.rbac.getScope(user.id);
    const isOwner = ad.userId === user.id;
    if (!isOwner && !scope) throw new ForbiddenException('فقط مالک آگهی یا ناظر می‌تواند آن را پاک کند');

    await this.prisma.ad.update({ where: { id }, data: { status: 'DELETED' } });
    const purged = await this.uploads.purgeEntity('AD', id).catch(() => ({ removed: 0 }));
    return { id, status: 'DELETED', removedFiles: purged.removed };
  }

  /** Toggle the caller's favorite on an ad (Phase 6). */
  async toggleFavorite(user: User, adId: number): Promise<{ favorited: boolean }> {
    const ad = await this.prisma.ad.findFirst({
      where: { id: adId },
      select: { id: true, userId: true, status: true, expiresAt: true },
    });
    if (!ad) throw new NotFoundException('آگهی یافت نشد');
    const expired = ad.expiresAt !== null && ad.expiresAt <= new Date();
    const isOwner = ad.userId === user.id;
    if (!(ad.status === 'APPROVED' && !expired) && !isOwner) throw new NotFoundException('آگهی یافت نشد');

    const existing = await this.prisma.favorite.findFirst({
      where: { userId: user.id, targetType: 'AD', adId: ad.id },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    try {
      await this.prisma.favorite.create({ data: { userId: user.id, targetType: 'AD', adId: ad.id } });
    } catch {
      // unique (userId, adId) — a concurrent double-tap already created it
      return { favorited: true };
    }
    return { favorited: true };
  }

  /** The caller's favorited ads, newest first (Phase 6). */
  async favorites(user: User): Promise<MyAdItem[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId: user.id, targetType: 'AD', adId: { not: null } },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        ad: {
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
        },
      },
    });

    return rows.flatMap((row) => {
      const ad = row.ad;
      if (!ad) return [];
      return [
        {
          id: ad.id,
          title: ad.title,
          status: ad.status,
          price: ad.price === null ? null : Number(ad.price),
          rejectedReason: ad.rejectedReason,
          createdAt: ad.createdAt,
          expiresAt: ad.expiresAt,
          coverUrl: ad.images[0]?.url ?? null,
          imageCount: ad.images.length,
        },
      ];
    });
  }
}
