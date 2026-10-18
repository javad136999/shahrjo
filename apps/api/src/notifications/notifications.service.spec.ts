import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

function makeService() {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  return { service: new NotificationsService(prisma as unknown as PrismaService), prisma };
}

const user = { id: 12 } as User;

describe('NotificationsService', () => {
  it('lists only the current user notifications with a bounded page size', async () => {
    const { service, prisma } = makeService();
    prisma.notification.findMany.mockResolvedValue([]);

    await service.list(user, 1000);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 12 },
        take: 50,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('counts only unread notifications owned by the current user', async () => {
    const { service, prisma } = makeService();
    prisma.notification.count.mockResolvedValue(3);

    await expect(service.unreadCount(user)).resolves.toEqual({ total: 3 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 12, readAt: null },
    });
  });

  it('does not expose another user notification by id', async () => {
    const { service, prisma } = makeService();
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead(user, 99)).rejects.toMatchObject({ status: 404 });
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 99, userId: 12 },
      select: { id: true, readAt: true },
    });
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('marks all and only the current user unread notifications as read', async () => {
    const { service, prisma } = makeService();
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.markAllRead(user)).resolves.toEqual({ updated: 2 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 12, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
