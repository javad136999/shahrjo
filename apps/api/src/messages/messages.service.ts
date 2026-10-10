import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimiterService } from '../redis/rate-limiter.service';
import { SendDirectMessageDto, StartConversationDto } from './messages.dto';

/** Per-user anti-spam guard for direct messages. */
const MAX_DIRECT_MESSAGES_PER_MINUTE = 20;

export interface DirectMessageItem {
  id: number;
  senderId: number;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface ConversationSummary {
  id: number;
  person: { id: number; name: string; avatarUrl: string | null };
  lastMessage: { body: string; senderId: number; createdAt: Date } | null;
  unreadCount: number;
  updatedAt: Date;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async start(user: User, dto: StartConversationDto): Promise<{ id: number }> {
    if (dto.recipientId === user.id) throw new BadRequestException('نمی‌توانید با خودتان گفت‌وگو کنید');
    const recipient = await this.prisma.user.findFirst({
      where: { id: dto.recipientId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException('کاربر پیدا نشد');

    const user1Id = Math.min(user.id, recipient.id);
    const user2Id = Math.max(user.id, recipient.id);
    const conversation = await this.prisma.directConversation.upsert({
      where: { user1Id_user2Id: { user1Id, user2Id } },
      create: { user1Id, user2Id },
      update: {},
      select: { id: true },
    });
    return conversation;
  }

  async list(user: User): Promise<ConversationSummary[]> {
    const rows = await this.prisma.directConversation.findMany({
      where: { OR: [{ user1Id: user.id }, { user2Id: user.id }] },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        updatedAt: true,
        user1: { select: { id: true, fullName: true, avatarUrl: true } },
        user2: { select: { id: true, fullName: true, avatarUrl: true } },
        messages: {
          take: 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { body: true, senderId: true, createdAt: true },
        },
      },
    });
    if (!rows.length) return [];

    const unreadRows = await this.prisma.directMessage.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: rows.map((row) => row.id) },
        senderId: { not: user.id },
        readAt: null,
      },
      _count: { id: true },
    });
    const unread = new Map(unreadRows.map((row) => [row.conversationId, row._count.id]));

    return rows.map((row) => {
      const person = row.user1Id === user.id ? row.user2 : row.user1;
      const last = row.messages[0] ?? null;
      return {
        id: row.id,
        person: { id: person.id, name: person.fullName?.trim() || 'کاربر شهرجو', avatarUrl: person.avatarUrl },
        lastMessage: last ? { ...last } : null,
        unreadCount: unread.get(row.id) ?? 0,
        updatedAt: row.updatedAt,
      };
    });
  }

  async messages(user: User, conversationId: number): Promise<DirectMessageItem[]> {
    await this.requireMember(user.id, conversationId);
    await this.markRead(user, conversationId);
    const rows = await this.prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { id: true, senderId: true, body: true, readAt: true, createdAt: true },
    });
    return rows.reverse();
  }

  async send(user: User, conversationId: number, dto: SendDirectMessageDto): Promise<DirectMessageItem> {
    await this.requireMember(user.id, conversationId);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('متن پیام خالی است');
    const limit = await this.rateLimiter.hit(
      `direct-message:user:${user.id}`,
      MAX_DIRECT_MESSAGES_PER_MINUTE,
      60,
    );
    if (!limit.allowed) {
      throw new HttpException('سرعت ارسال پیام زیاد است؛ کمی صبر کنید و دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.directMessage.create({
        data: { conversationId, senderId: user.id, body },
        select: { id: true, senderId: true, body: true, readAt: true, createdAt: true },
      });
      await tx.directConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return message;
    });
  }

  async markRead(user: User, conversationId: number): Promise<{ updated: number }> {
    await this.requireMember(user.id, conversationId);
    const result = await this.prisma.directMessage.updateMany({
      where: { conversationId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private async requireMember(userId: number, conversationId: number): Promise<void> {
    const row = await this.prisma.directConversation.findFirst({
      where: { id: conversationId, OR: [{ user1Id: userId }, { user2Id: userId }] },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('گفت‌وگو پیدا نشد');
  }
}
