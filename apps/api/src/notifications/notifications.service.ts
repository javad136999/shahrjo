import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User, limit = DEFAULT_LIMIT) {
    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit) || DEFAULT_LIMIT));
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async unreadCount(user: User): Promise<{ total: number }> {
    const total = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { total };
  }

  async markRead(user: User, id: number) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
      select: { id: true, readAt: true },
    });
    if (!notification) throw new NotFoundException('اعلان یافت نشد');

    if (!notification.readAt) {
      await this.prisma.notification.updateMany({
        where: { id, userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
    }

    return this.prisma.notification.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async markAllRead(user: User): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
