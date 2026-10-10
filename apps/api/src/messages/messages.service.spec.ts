import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from './messages.service';

const user = (id: number) => ({ id } as User);

function makeService() {
  const tx = {
    directMessage: { create: jest.fn() },
    directConversation: { update: jest.fn() },
  };
  const prisma = {
    user: { findFirst: jest.fn() },
    directConversation: { upsert: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    directMessage: { groupBy: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const rateLimiter = {
    hit: jest.fn().mockResolvedValue({ allowed: true, remaining: 19, retryAfterSeconds: 60 }),
  };
  return {
    service: new MessagesService(prisma as unknown as PrismaService, rateLimiter as never),
    prisma,
    tx,
    rateLimiter,
  };
}

describe('MessagesService', () => {
  it('creates a canonical one-to-one conversation and rejects self-chat', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({ id: 7 });
    prisma.directConversation.upsert.mockResolvedValue({ id: 9 });

    await expect(service.start(user(12), { recipientId: 7 })).resolves.toEqual({ id: 9 });
    expect(prisma.directConversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { user1Id_user2Id: { user1Id: 7, user2Id: 12 } },
      create: { user1Id: 7, user2Id: 12 },
    }));
    await expect(service.start(user(12), { recipientId: 12 })).rejects.toThrow('خودتان');
  });

  it('returns only the caller\'s threads with unread counts and a safe display name', async () => {
    const { service, prisma } = makeService();
    prisma.directConversation.findMany.mockResolvedValue([{
      id: 4,
      user1Id: 5,
      user2Id: 12,
      updatedAt: new Date('2026-10-09T08:00:00Z'),
      user1: { id: 5, fullName: null, avatarUrl: null },
      user2: { id: 12, fullName: 'من', avatarUrl: null },
      messages: [{ body: 'سلام', senderId: 5, createdAt: new Date('2026-10-09T08:00:00Z') }],
    }]);
    prisma.directMessage.groupBy.mockResolvedValue([{ conversationId: 4, _count: { id: 2 } }]);

    const rows = await service.list(user(12));

    expect(prisma.directConversation.findMany.mock.calls[0][0].where).toEqual({ OR: [{ user1Id: 12 }, { user2Id: 12 }] });
    expect(prisma.directMessage.groupBy.mock.calls[0][0].where).toMatchObject({ senderId: { not: 12 }, readAt: null });
    expect(rows[0]).toMatchObject({ person: { id: 5, name: 'کاربر شهرجو' }, lastMessage: { body: 'سلام' }, unreadCount: 2 });
  });

  it('does not reveal or return messages for a non-member', async () => {
    const { service, prisma } = makeService();
    prisma.directConversation.findFirst.mockResolvedValue(null);

    await expect(service.messages(user(12), 44)).rejects.toThrow('گفت‌وگو پیدا نشد');
    expect(prisma.directMessage.findMany).not.toHaveBeenCalled();
  });

  it('marks incoming messages read when opened and inserts outgoing messages transactionally', async () => {
    const { service, prisma, tx } = makeService();
    prisma.directConversation.findFirst.mockResolvedValue({ id: 44 });
    prisma.directMessage.updateMany.mockResolvedValue({ count: 3 });
    const createdAt = new Date();
    tx.directMessage.create.mockResolvedValue({ id: 6, senderId: 12, body: 'پاسخ', readAt: null, createdAt });
    tx.directConversation.update.mockResolvedValue({ id: 44 });

    await expect(service.markRead(user(12), 44)).resolves.toEqual({ updated: 3 });
    await expect(service.send(user(12), 44, { body: ' پاسخ ' })).resolves.toMatchObject({ id: 6, body: 'پاسخ' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.directMessage.create.mock.calls[0][0].data).toMatchObject({ conversationId: 44, senderId: 12, body: 'پاسخ' });
    expect(tx.directConversation.update).toHaveBeenCalledWith({ where: { id: 44 }, data: { updatedAt: expect.any(Date) } });
  });

  it('rate-limits direct-message spam before writing to the database', async () => {
    const { service, prisma, rateLimiter } = makeService();
    prisma.directConversation.findFirst.mockResolvedValue({ id: 44 });
    rateLimiter.hit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 12 });

    await expect(service.send(user(12), 44, { body: 'سلام' })).rejects.toThrow('سرعت ارسال پیام');
    expect(rateLimiter.hit).toHaveBeenCalledWith('direct-message:user:12', 20, 60);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
