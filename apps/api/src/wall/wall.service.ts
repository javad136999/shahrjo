import { HttpException, HttpStatus, Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService, type AdminScope } from '../rbac/rbac.service';
import type { CreateWallPostDto } from './wall.dto';

/** Per-user wall flood guard: max 10 posts / minute. */
const MAX_POSTS_PER_MINUTE = 10;
export const DEFAULT_WALL_LIMIT = 30;

export interface WallAuthor {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface WallPostView {
  id: number;
  content: string;
  imageUrl: string | null;
  isPinned: boolean;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  canPin: boolean;
  createdAt: Date;
  user: WallAuthor;
  replyTo: { id: number; content: string; userName: string } | null;
}

export interface WallFeed {
  posts: WallPostView[];
  pinned: WallPostView | null;
  /** ISO timestamp of the oldest returned post — pass as `before` for more. */
  nextBefore: string | null;
}

type PostWithRel = {
  id: number;
  content: string;
  imageUrl: string | null;
  isPinned: boolean;
  likeCount: number;
  createdAt: Date;
  user: { id: number; fullName: string | null; avatarUrl: string | null };
  replyTo: { id: number; content: string; user: { fullName: string | null } } | null;
};

/**
 * City wall (Phase 8b): the public JamCity-style feed of one city.
 * Reads require login (the wall is a members' space, like JamCity's gate);
 * publishing is rate-limited per user; operators (RBAC scope) may pin and
 * delete any post — everyone may delete their own.
 */
@Injectable()
export class WallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  private async resolveCity(slug: string): Promise<number> {
    const city = await this.prisma.city.findFirst({
      where: { slug, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر یافت نشد');
    return city.id;
  }

  private async scopeOf(userId: number): Promise<AdminScope | null> {
    return this.rbac.getScope(userId);
  }

  private view(
    post: PostWithRel,
    viewerId: number,
    liked: boolean,
    scope: AdminScope | null,
  ): WallPostView {
    const isOperator = scope !== null;
    return {
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      isPinned: post.isPinned,
      likeCount: post.likeCount,
      likedByMe: liked,
      canDelete: post.user.id === viewerId || isOperator,
      canPin: isOperator,
      createdAt: post.createdAt,
      user: {
        id: post.user.id,
        name: post.user.fullName?.trim() || 'شهروند',
        avatarUrl: post.user.avatarUrl,
      },
      replyTo: post.replyTo
        ? {
            id: post.replyTo.id,
            content: post.replyTo.content,
            userName: post.replyTo.user.fullName?.trim() || 'شهروند',
          }
        : null,
    };
  }

  private readonly select = {
    id: true,
    content: true,
    imageUrl: true,
    isPinned: true,
    likeCount: true,
    createdAt: true,
    user: { select: { id: true, fullName: true, avatarUrl: true } },
    replyTo: {
      select: { id: true, content: true, user: { select: { fullName: true } } },
    },
  } as const;

  /** Newest-first feed + the single pinned post of the city. */
  async list(
    user: User,
    citySlug: string,
    limit: number = DEFAULT_WALL_LIMIT,
    before?: string,
  ): Promise<WallFeed> {
    const cityId = await this.resolveCity(citySlug);
    const scope = await this.scopeOf(user.id);

    const [pinnedRow, rows] = await Promise.all([
      this.prisma.wallPost.findFirst({
        where: { cityId, isPinned: true },
        select: this.select,
      }),
      this.prisma.wallPost.findMany({
        where: {
          cityId,
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: this.select,
      }),
    ]);

    const likedRows = rows.length
      ? await this.prisma.wallPostLike.findMany({
          where: { postId: { in: rows.map((r) => r.id) }, userId: user.id },
          select: { postId: true },
        })
      : [];
    const liked = new Set(likedRows.map((l) => l.postId));

    // the pinned post is rendered separately — do not duplicate it in the feed
    const feedRows = pinnedRow ? rows.filter((r) => r.id !== pinnedRow.id) : rows;
    const oldest = rows[rows.length - 1];

    return {
      posts: feedRows.map((r) => this.view(r, user.id, liked.has(r.id), scope)),
      pinned: pinnedRow ? this.view(pinnedRow, user.id, liked.has(pinnedRow.id), scope) : null,
      nextBefore: rows.length === limit && oldest ? oldest.createdAt.toISOString() : null,
    };
  }

  /** Publish a post; optionally claim one uploaded image for it. */
  async create(user: User, dto: CreateWallPostDto): Promise<WallPostView> {
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('متن پیام الزامی است');

    const city = await this.prisma.city.findFirst({
      where: { id: dto.cityId, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر یافت نشد');

    const recent = await this.prisma.wallPost.count({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent >= MAX_POSTS_PER_MINUTE) {
      throw new HttpException(
        'سرعت ارسال پیام زیاد است؛ کمی صبر کنید و دوباره تلاش کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let replyToId: number | null = null;
    if (dto.replyToId) {
      const target = await this.prisma.wallPost.findFirst({
        where: { id: dto.replyToId, cityId: city.id },
        select: { id: true },
      });
      if (!target) throw new BadRequestException('پیام موردنظر برای پاسخ یافت نشد');
      replyToId = target.id;
    }

    const post = await this.prisma.wallPost.create({
      data: { cityId: city.id, userId: user.id, content, replyToId },
      select: { id: true },
    });

    let imageUrl: string | null = null;
    if (dto.imageIds && dto.imageIds.length > 0) {
      const claimed = await this.prisma.media.updateMany({
        where: {
          id: dto.imageIds[0],
          ownerUserId: user.id,
          entityId: null,
          deletedAt: null,
          entityType: { in: ['AD', 'WALL'] },
        },
        data: { entityType: 'WALL', entityId: String(post.id) },
      });
      if (claimed.count !== 1) {
        await this.prisma.wallPost.delete({ where: { id: post.id } });
        throw new BadRequestException('تصویر پیدا نشد یا متعلق به شما نیست');
      }
      const media = await this.prisma.media.findUnique({
        where: { id: dto.imageIds[0] },
        select: { url: true },
      });
      imageUrl = media?.url ?? null;
      if (imageUrl) {
        await this.prisma.wallPost.update({
          where: { id: post.id },
          data: { imageUrl },
        });
      }
    }

    const created = await this.prisma.wallPost.findUnique({
      where: { id: post.id },
      select: this.select,
    });
    if (!created) throw new NotFoundException('پیام یافت نشد');
    const scope = await this.scopeOf(user.id);
    return this.view(created, user.id, false, scope);
  }

  /** Like / unlike — returns the fresh count. */
  async toggleLike(user: User, id: number): Promise<{ liked: boolean; likeCount: number }> {
    const post = await this.prisma.wallPost.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('پیام یافت نشد');

    const existing = await this.prisma.wallPostLike.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    });

    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.wallPostLike.delete({
          where: { postId_userId: { postId: id, userId: user.id } },
        });
        await tx.wallPost.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
        });
      });
    } else {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.wallPostLike.create({ data: { postId: id, userId: user.id } });
          await tx.wallPost.update({
            where: { id },
            data: { likeCount: { increment: 1 } },
          });
        });
      } catch {
        // unique violation = double click; treat as already liked
      }
    }

    const fresh = await this.prisma.wallPost.findUnique({
      where: { id },
      select: { likeCount: true },
    });
    const liked = await this.prisma.wallPostLike.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    });
    return { liked: Boolean(liked), likeCount: fresh?.likeCount ?? 0 };
  }

  /** Delete own post; operators may delete any post. */
  async remove(user: User, id: number): Promise<{ id: number; deleted: boolean }> {
    const post = await this.prisma.wallPost.findFirst({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!post) throw new NotFoundException('پیام یافت نشد');
    if (post.userId !== user.id) {
      const scope = await this.scopeOf(user.id);
      if (!scope) throw new ForbiddenException('فقط نویسنده یا ناظر می‌تواند پیام را پاک کند');
    }
    await this.prisma.wallPost.delete({ where: { id } });
    // attached media keeps its row; the storage sweep removes it with the post
    return { id, deleted: true };
  }

  /** Pin at most one post per city (operators only — guarded on the route). */
  async setPinned(user: User, id: number, pinned: boolean): Promise<{ id: number; isPinned: boolean }> {
    const scope = await this.scopeOf(user.id);
    if (!scope) throw new ForbiddenException('دسترسی کافی ندارید');
    const post = await this.prisma.wallPost.findFirst({
      where: { id },
      select: { id: true, cityId: true },
    });
    if (!post) throw new NotFoundException('پیام یافت نشد');
    if (pinned) {
      await this.prisma.wallPost.updateMany({
        where: { cityId: post.cityId, isPinned: true },
        data: { isPinned: false },
      });
    }
    await this.prisma.wallPost.update({ where: { id }, data: { isPinned: pinned } });
    return { id, isPinned: pinned };
  }
}
