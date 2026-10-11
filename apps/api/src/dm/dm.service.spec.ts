import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DmService } from './dm.service';

function makePrisma() {
  return {
    user: { findFirst: jest.fn() },
    media: { findFirst: jest.fn() },
    privateConversation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    privateMessage: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };
}

function makeService() {
  const prisma = makePrisma();
  const service = new DmService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const me = { id: 4, phone: '09120000000' } as User;
const peerUser = { id: 9, fullName: 'مرضیه', avatarUrl: 'https://cdn/a.webp' };
const meAsPeer = { id: 4, fullName: 'علی', avatarUrl: null };

const convoRow = {
  id: 77,
  userAId: 4,
  userBId: 9,
  lastMessageAt: new Date('2026-10-11T08:00:00Z'),
  aLastReadAt: new Date('2026-10-11T07:00:00Z'),
  bLastReadAt: new Date('2026-10-10T00:00:00Z'),
  createdAt: new Date('2026-10-01T00:00:00Z'),
  userA: meAsPeer,
  userB: peerUser,
};

describe('DmService.openWith', () => {
  it('rejects messaging yourself', async () => {
    const { service } = makeService();
    await expect(service.openWith(me, 4)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s unknown or banned peers', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.openWith(me, 9)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('upserts the canonical pair (smaller id = userA) and returns the view', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue(peerUser);
    prisma.privateConversation.upsert.mockResolvedValue({ id: 77, userAId: 4, userBId: 9 });
    prisma.privateConversation.findUnique.mockResolvedValue(convoRow);
    prisma.privateMessage.findFirst.mockResolvedValue(null);
    prisma.privateMessage.count.mockResolvedValue(2);

    const view = await service.openWith(me, 9);

    expect(prisma.privateConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userAId_userBId: { userAId: 4, userBId: 9 } },
        create: { userAId: 4, userBId: 9 },
      }),
    );
    expect(view.peer).toEqual({ id: 9, fullName: 'مرضیه', avatarUrl: 'https://cdn/a.webp' });
    expect(view.unreadCount).toBe(2);
  });
});

describe('DmService.listConversations', () => {
  it('maps the peer from either side of the pair', async () => {
    const { service, prisma } = makeService();
    // me = userA in one row, userB in the other
    prisma.privateConversation.findMany.mockResolvedValue([
      convoRow,
      { ...convoRow, id: 78, userAId: 2, userBId: 4, userA: peerUser, userB: meAsPeer },
    ]);
    prisma.privateMessage.findFirst.mockResolvedValue(null);
    prisma.privateMessage.count.mockResolvedValue(0);

    const list = await service.listConversations(me);

    expect(list[0].peer.id).toBe(9);
    expect(list[1].peer.id).toBe(9); // peer is userA in the second row
    expect(list).toHaveLength(2);
  });
});

describe('DmService.listMessages', () => {
  it('404s when the caller is not a participant', async () => {
    const { service, prisma } = makeService();
    prisma.privateConversation.findUnique.mockResolvedValue({ ...convoRow, userAId: 1, userBId: 2 });
    await expect(service.listMessages(me, 77)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the page oldest→newest and marks my side read', async () => {
    const { service, prisma } = makeService();
    prisma.privateConversation.findUnique.mockResolvedValue(convoRow);
    const newer = { id: 2, senderId: 9, body: 'salam', createdAt: new Date('2026-10-11T08:00:00Z'), image: null };
    const older = { id: 1, senderId: 4, body: 'hi', createdAt: new Date('2026-10-11T07:00:00Z'), image: null };
    prisma.privateMessage.findMany.mockResolvedValue([newer, older]); // desc from db

    const page = await service.listMessages(me, 77);

    expect(page.messages.map((m) => m.id)).toEqual([1, 2]); // reversed → ascending
    // I am userA → aLastReadAt bumped
    expect(prisma.privateConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 77 },
        data: expect.objectContaining({ aLastReadAt: expect.any(Date) }),
      }),
    );
  });
});

describe('DmService.sendMessage', () => {
  it('rejects an empty message', async () => {
    const { service, prisma } = makeService();
    prisma.privateConversation.findUnique.mockResolvedValue(convoRow);
    await expect(service.sendMessage(me, 77, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s an image that isn't the caller's", async () => {
    const { service, prisma } = makeService();
    prisma.privateConversation.findUnique.mockResolvedValue(convoRow);
    prisma.media.findFirst.mockResolvedValue(null);
    await expect(service.sendMessage(me, 77, { imageId: 5 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates the message and advances lastMessageAt + my pointer', async () => {
    const { service, prisma } = makeService();
    prisma.privateConversation.findUnique.mockResolvedValue(convoRow);
    prisma.media.findFirst.mockResolvedValue({ id: 5, url: '/files/dm/1.webp' });
    const createdAt = new Date('2026-10-11T09:00:00Z');
    prisma.privateMessage.create.mockResolvedValue({
      id: 10,
      senderId: 4,
      body: 'سلام',
      createdAt,
      image: { url: '/files/dm/1.webp' },
    });

    const msg = await service.sendMessage(me, 77, { body: ' سلام ', imageId: 5 });

    expect(msg.imageUrl).toBe('/files/dm/1.webp');
    expect(prisma.privateConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lastMessageAt: createdAt, aLastReadAt: createdAt },
      }),
    );
  });
});

describe('DmService.unreadTotal', () => {
  it('sums unread counts across my conversations', async () => {
    const { service, prisma } = makeService();
    prisma.privateConversation.findMany.mockResolvedValue([
      { id: 77, userAId: 4, aLastReadAt: convoRow.aLastReadAt, bLastReadAt: convoRow.bLastReadAt },
      { id: 78, userAId: 9, userBId: 4, aLastReadAt: convoRow.aLastReadAt, bLastReadAt: convoRow.bLastReadAt },
    ]);
    prisma.privateMessage.count.mockResolvedValueOnce(3).mockResolvedValueOnce(5);

    await expect(service.unreadTotal(me)).resolves.toEqual({ total: 8 });
  });
});
