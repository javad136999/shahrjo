import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import { WallService } from './wall.service';

function makePrisma() {
  const prisma = {
    city: { findFirst: jest.fn() },
    user: { count: jest.fn().mockResolvedValue(12) },
    wallPost: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(34),
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
  const uploads = { purgeEntity: jest.fn().mockResolvedValue({ removed: 1 }) };
  const service = new WallService(
    prisma as unknown as PrismaService,
    rbac as unknown as RbacService,
    uploads as unknown as never,
  );
  prisma.city.findFirst.mockResolvedValue({ id: 1, name: 'شهر نمونه' });
  return { service, prisma, uploads };
}

const user = { id: 4, phone: '09120000000' } as User;

const basePost = {
  id: 10,
  content: 'سلام شهر',
  imageUrl: null,
  voiceUrl: null,
  editedAt: null,
  ad: null,
  isPinned: false,
  likeCount: 2,
  createdAt: new Date('2026-10-05T10:00:00Z'),
  user: { id: 4, fullName: 'علی', avatarUrl: null },
  replyTo: null,
};

describe('WallService.unreadCount', () => {
  it('counts only visible posts from other users after the last visit', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.count.mockResolvedValue(3);

    await expect(service.unreadCount(user, 'jam', '2026-10-09T08:00:00.000Z')).resolves.toEqual({ count: 3 });
    expect(prisma.wallPost.count.mock.calls[0][0].where).toMatchObject({
      cityId: 1,
      userId: { not: user.id },
      createdAt: { gt: new Date('2026-10-09T08:00:00.000Z') },
      OR: [{ adId: null }, { ad: { is: { status: { in: ['PENDING', 'APPROVED'] } } } }],
    });
  });

  it('returns zero before a last-visit marker exists', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.unreadCount(user, 'jam')).resolves.toEqual({ count: 0 });
    expect(prisma.wallPost.count).not.toHaveBeenCalled();
  });
});

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
    expect(feed.room).toEqual({
      name: 'دیوار شهر شهر نمونه',
      memberCount: 12,
      messageCount: 34,
    });
    expect(() => JSON.stringify(feed)).not.toThrow();
  });

  it('returns pending ad previews with moderation status and filters rejected ad posts', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue(null);
    prisma.wallPost.findMany.mockResolvedValue([{
      ...basePost,
      ad: {
        id: 33,
        title: 'آگهی تازه',
        description: 'توضیحات آگهی',
        price: 1200n,
        status: 'PENDING',
        images: [{ url: '/pending.jpg' }],
      },
    }]);
    prisma.wallPostLike.findMany.mockResolvedValue([]);

    const feed = await service.list(user, 'jam');

    expect(feed.posts[0].ad).toMatchObject({
      id: 33,
      title: 'آگهی تازه',
      description: 'توضیحات آگهی',
      price: 1200,
      image: '/pending.jpg',
      status: 'PENDING',
    });
    expect(prisma.wallPost.findMany.mock.calls[0][0].where.OR).toEqual([
      { adId: null },
      { ad: { is: { status: { in: ['PENDING', 'APPROVED'] } } } },
    ]);
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

  it('claims a voice note like an image and rolls back everything when it fails', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.count.mockResolvedValue(0);
    prisma.wallPost.create.mockResolvedValue({ id: 8 });
    prisma.media.updateMany.mockResolvedValue({ count: 1 });
    prisma.media.findUnique.mockResolvedValue({ url: '/api/v1/files/voice/2026/10/x.webm' });
    prisma.wallPost.findUnique.mockResolvedValue({
      ...basePost,
      id: 8,
      content: '',
      voiceUrl: '/api/v1/files/voice/2026/10/x.webm',
    });

    // voice-only message: empty content is accepted
    const created = await service.create(user, { cityId: 1, content: '', voiceMediaId: 77 });
    expect(prisma.media.updateMany.mock.calls[0][0].where).toMatchObject({
      id: 77,
      mimeType: { startsWith: 'audio/' },
    });
    expect(prisma.media.updateMany.mock.calls[0][0].data).toMatchObject({
      entityType: 'WALL',
      entityId: '8',
    });
    expect(created.voiceUrl).toBe('/api/v1/files/voice/2026/10/x.webm');

    // a failed voice claim releases the claim and deletes the half-built post
    prisma.media.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.create(user, { cityId: 1, content: '', voiceMediaId: 78 })).rejects.toThrow('ویس');
    expect(prisma.wallPost.delete).toHaveBeenCalledWith({ where: { id: 8 } });
  });
});

describe('WallService.edit (Phase 10)', () => {
  it('404s unknown posts', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue(null);
    await expect(service.edit(user, 3, 'تازه')).rejects.toThrow('پیام یافت نشد');
  });

  it('rejects a blank body', async () => {
    const { service } = makeService(null);
    await expect(service.edit(user, 3, '   ')).rejects.toThrow('خالی');
  });

  it('403s an edit attempt by someone else', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue({ id: 3, userId: 99 });
    await expect(service.edit(user, 3, 'تازه')).rejects.toMatchObject({ status: 403 });
    expect(prisma.wallPost.update).not.toHaveBeenCalled();
  });

  it('saves the new text with an editedAt stamp and returns the fresh view', async () => {
    const { service, prisma } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue({ id: 3, userId: 4 });
    prisma.wallPost.findUnique.mockResolvedValue({
      ...basePost,
      id: 3,
      content: 'متن تازه',
      editedAt: new Date('2026-10-08T10:00:00Z'),
    });
    prisma.wallPostLike.findUnique.mockResolvedValue(null);

    const view = await service.edit(user, 3, 'متن تازه');

    expect(prisma.wallPost.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { content: 'متن تازه', editedAt: expect.any(Date) },
    });
    expect(view.content).toBe('متن تازه');
    expect(view.editedAt).not.toBeNull();
    expect(view.canEdit).toBe(true);
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
  it('lets the author delete, but 403s a stranger — and purges the post images', async () => {
    const { service, prisma, uploads } = makeService(null);
    prisma.wallPost.findFirst.mockResolvedValue({ id: 3, userId: 4 });
    await expect(service.remove(user, 3)).resolves.toEqual({ id: 3, deleted: true });
    // files of the deleted post leave storage immediately (no sweep wait)
    expect(uploads.purgeEntity).toHaveBeenCalledWith('WALL', 3);

    prisma.wallPost.findFirst.mockResolvedValue({ id: 3, userId: 99 });
    await expect(service.remove(user, 3)).rejects.toMatchObject({ status: 403 });
    expect(prisma.wallPost.delete).toHaveBeenCalledTimes(1);
    expect(uploads.purgeEntity).toHaveBeenCalledTimes(1); // stranger was rejected
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
