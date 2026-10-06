import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import { WallService } from './wall.service';

function makePrisma() {
  const prisma = {
    city: { findFirst: jest.fn() },
    wallPost: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    wallPostLike: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    media: { updateMany: jest.fn(), findUnique: jest.fn() },
    ad: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  return prisma;
}

function makeService(scope: { role: string; provinceId: number | null; cityId: number | null } | null) {
  const prisma = makePrisma();
  const rbac = { getScope: jest.fn().mockResolvedValue(scope) };
  const service = new WallService(prisma as unknown as PrismaService, rbac as unknown as RbacService);
  prisma.city.findFirst.mockResolvedValue({ id: 1 });
  return { service, prisma };
}

const user = { id: 4, phone: '09120000000' } as User;

const basePost = {
  id: 10,
  content: 'سلام شهر',
  imageUrl: null,
  isPinned: false,
  likeCount: 2,
  createdAt: new Date('2026-10-05T10:00:00Z'),
  user: { id: 4, fullName: 'علی', avatarUrl: null },
  replyTo: null,
};

describe('WallService.list', () => {
  it('404s unknown/inactive cities', async () => {
    const { service, prisma } = makeService(null);
    prisma.city.findFirst.mockResolvedValue(null);
    await expect(service.list(user, 'nope')).rejects.toThrow('شهر یافت نشد');
    expect(prisma.wallPost.findMany).not.toHaveBeenCalled();
  });

  it('separates the pinned post, marks liked-by-me, shapes author names', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue({ ...basePost, id: 99, isPinned: true });
    prisma.wallPost.findMany.mockResolvedValue([basePost, { ...basePost, id: 11 }]);
    prisma.wallPostLike.findMany.mockResolvedValue([{ postId: 10 }]);

    const feed = await service.list(user, 'jam');

    expect(feed.pinned?.id).toBe(99);
    // pinned post must not appear again inside the feed
    expect(feed.posts.map((p) => p.id)).toEqual([10, 11]);
    expect(feed.posts[0].likedByMe).toBe(true);
    expect(feed.posts[1].likedByMe).toBe(false);
    expect(feed.posts[0].user.name).toBe('علی');
    expect(feed.posts[0].canDelete).toBe(true); // own post
    expect(feed.posts[0].canPin).toBe(false); // not an operator
    expect(feed.nextBefore).toBeNull(); // fewer rows than limit
    expect(() => JSON.stringify(feed)).not.toThrow();
  });

  it('hands back a cursor when the page is full and passes `before` through', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue(null);
    prisma.wallPost.findMany.mockResolvedValue([basePost]);
    prisma.wallPostLike.findMany.mockResolvedValue([]);

    const feed = await service.list(user, 'jam', 1, '2026-10-01T00:00:00.000Z');

    expect(feed.nextBefore).toBe(basePost.createdAt.toISOString());
    expect(prisma.wallPost.findMany.mock.calls[0][0].where).toMatchObject({
      cityId: 1,
      createdAt: { lt: new Date('2026-10-01T00:00:00.000Z') },
    });
    expect(prisma.wallPost.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('WallService.create', () => {
  it('rejects blank content and unknown cities', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.create(user, { cityId: 1, content: '   ' })).rejects.toThrow('متن پیام');
    prisma.city.findFirst.mockResolvedValue(null);
    await expect(service.create(user, { cityId: 9, content: 'سلام' })).rejects.toThrow('شهر یافت نشد');
    expect(prisma.wallPost.create).not.toHaveBeenCalled();
  });

  it('rate-limits at 10 posts / minute', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.count.mockResolvedValue(10);
    await expect(service.create(user, { cityId: 1, content: 'سلام' })).rejects.toMatchObject({ status: 429 });
    expect(prisma.wallPost.create).not.toHaveBeenCalled();
  });

  it('only allows replies to posts of the same city', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.count.mockResolvedValue(0);
    prisma.wallPost.findFirst.mockResolvedValue(null); // reply target lookup
    await expect(
      service.create(user, { cityId: 1, content: 'پاسخ', replyToId: 5 }),
    ).rejects.toThrow('پاسخ');
    expect(prisma.wallPost.create).not.toHaveBeenCalled();
  });

  it('claims one uploaded image and rolls back the post when the claim fails', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.count.mockResolvedValue(0);
    prisma.wallPost.create.mockResolvedValue({ id: 7 });
    prisma.media.updateMany.mockResolvedValue({ count: 1 });
    prisma.media.findUnique.mockResolvedValue({ url: '/api/v1/files/ads/2026/10/x.png' });
    prisma.wallPost.findUnique.mockResolvedValue({ ...basePost, id: 7, imageUrl: '/api/v1/files/ads/2026/10/x.png' });

    const created = await service.create(user, { cityId: 1, content: 'با عکس', imageIds: [55] });
    expect(prisma.media.updateMany.mock.calls[0][0]).toMatchObject({
      data: { entityType: 'WALL', entityId: '7' },
    });
    expect(created.imageUrl).toBe('/api/v1/files/ads/2026/10/x.png');

    // failed claim → post removed, 400 returned
    prisma.media.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.create(user, { cityId: 1, content: 'با عکس', imageIds: [56] })).rejects.toThrow('تصویر');
    expect(prisma.wallPost.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });
});

describe('WallService.toggleLike', () => {
  it('404s missing posts', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue(null);
    await expect(service.toggleLike(user, 3)).rejects.toThrow('پیام یافت نشد');
  });

  it('creates the like + increments when absent, and reports the fresh count', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue({ id: 3 });
    prisma.wallPostLike.findUnique
      .mockResolvedValueOnce(null) // existing?
      .mockResolvedValueOnce({ postId: 3, userId: 4 }); // after
    prisma.wallPost.findUnique.mockResolvedValue({ likeCount: 5 });

    const result = await service.toggleLike(user, 3);

    expect(prisma.wallPostLike.create).toHaveBeenCalledWith({ data: { postId: 3, userId: 4 } });
    expect(prisma.wallPost.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { likeCount: { increment: 1 } },
    });
    expect(result).toEqual({ liked: true, likeCount: 5 });
  });

  it('deletes the like + decrements when present', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue({ id: 3 });
    prisma.wallPostLike.findUnique
      .mockResolvedValueOnce({ postId: 3, userId: 4 })
      .mockResolvedValueOnce(null);
    prisma.wallPost.findUnique.mockResolvedValue({ likeCount: 4 });

    const result = await service.toggleLike(user, 3);

    expect(prisma.wallPostLike.delete).toHaveBeenCalled();
    expect(prisma.wallPost.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { likeCount: { decrement: 1 } },
    });
    expect(result).toEqual({ liked: false, likeCount: 4 });
  });
});

describe('WallService.remove / setPinned (moderation)', () => {
  it('lets the author delete, but 403s a stranger', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue({ id: 3, userId: 4 });
    await expect(service.remove(user, 3)).resolves.toEqual({ id: 3, deleted: true });

    prisma.wallPost.findFirst.mockResolvedValue({ id: 3, userId: 99 });
    await expect(service.remove(user, 3)).rejects.toMatchObject({ status: 403 });
    expect(prisma.wallPost.delete).toHaveBeenCalledTimes(1);
  });

  it('lets an operator delete any post', async () => {
    const { service, prisma } = makeService({ role: 'MODERATOR', provinceId: null, cityId: 1 });
    prisma.wallPost.findFirst.mockResolvedValue({ id: 3, userId: 99 });
    await expect(service.remove(user, 3)).resolves.toEqual({ id: 3, deleted: true });
  });

  it('403s pinning without an operator scope', async () => {
    const { service } = makeService(null);
    await expect(service.setPinned(user, 3, true)).rejects.toMatchObject({ status: 403 });
  });

  it('unpins the previous post of the city when pinning a new one', async () => {
    const { service, prisma } = makeService({ role: 'MODERATOR', provinceId: null, cityId: 1 });
    prisma.wallPost.findFirst.mockResolvedValue({ id: 3, cityId: 1 });

    const result = await service.setPinned(user, 3, true);

    expect(prisma.wallPost.updateMany).toHaveBeenCalledWith({
      where: { cityId: 1, isPinned: true },
      data: { isPinned: false },
    });
    expect(prisma.wallPost.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { isPinned: true } });
    expect(result).toEqual({ id: 3, isPinned: true });
  });
});
