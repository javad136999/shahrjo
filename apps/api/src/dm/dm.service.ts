import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DmPeerView {
  id: number;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface DmMessageView {
  id: number;
  senderId: number;
  body: string | null;
  imageUrl: string | null;
  createdAt: Date;
}

export interface DmConversationView {
  id: number;
  peer: DmPeerView;
  unreadCount: number;
  lastMessageAt: Date | null;
  lastMessage: DmMessageView | null;
}

const DEFAULT_PAGE = 30;

const peerSelect = { id: true, fullName: true, avatarUrl: true } as const;

type ConversationRow = {
  id: number;
  userAId: number;
  userBId: number;
  lastMessageAt: Date | null;
  aLastReadAt: Date;
  bLastReadAt: Date;
};

type MessageRow = {
  id: number;
  senderId: number;
  body: string | null;
  createdAt: Date;
  image: { url: string } | null;
};

/**
 * Private messages (پیام‌های خصوصی): 1:1 conversations started from the city
 * wall (tap a username/avatar → open chat). Transport is plain REST — the web
 * client polls; this stack has no WebSocket. Per-user read pointers on the
 * conversation row power the unread badge.
 */
@Injectable()
export class DmService {
  constructor(private readonly prisma: PrismaService) {}

  /** Canonical ordering: userAId < userBId keeps the unique pair simple. */
  private pair(me: number, peer: number): { userAId: number; userBId: number } {
    return me < peer ? { userAId: me, userBId: peer } : { userAId: peer, userBId: me };
  }

  /** Fetch a conversation the caller participates in, or 404. */
  private async conversationOf(userId: number, conversationId: number): Promise<ConversationRow> {
    const convo = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo || (convo.userAId !== userId && convo.userBId !== userId)) {
      throw new NotFoundException('مکالمه یافت نشد');
    }
    return convo;
  }

  /** The caller's own read pointer on a conversation row. */
  private readAt(
    convo: { userAId: number; aLastReadAt: Date; bLastReadAt: Date },
    me: number,
  ): Date {
    return convo.userAId === me ? convo.aLastReadAt : convo.bLastReadAt;
  }

  /** Bump the caller's read pointer to now (opening/sending marks it read). */
  private async markRead(convo: ConversationRow, me: number, at: Date = new Date()): Promise<void> {
    await this.prisma.privateConversation.update({
      where: { id: convo.id },
      data: convo.userAId === me ? { aLastReadAt: at } : { bLastReadAt: at },
    });
  }

  private messageView(msg: MessageRow): DmMessageView {
    return {
      id: msg.id,
      senderId: msg.senderId,
      body: msg.body,
      imageUrl: msg.image?.url ?? null,
      createdAt: msg.createdAt,
    };
  }

  private async conversationView(
    convo: ConversationRow & { userA: DmPeerView; userB: DmPeerView },
    me: number,
  ): Promise<DmConversationView> {
    const peer = convo.userAId === me ? convo.userB : convo.userA;
    const since = this.readAt(convo, me);
    const [last, unread] = await Promise.all([
      this.prisma.privateMessage.findFirst({
        where: { conversationId: convo.id },
        orderBy: { createdAt: 'desc' },
        include: { image: { select: { url: true } } },
      }),
      this.prisma.privateMessage.count({
        where: { conversationId: convo.id, senderId: { not: me }, createdAt: { gt: since } },
      }),
    ]);
    return {
      id: convo.id,
      peer: { id: peer.id, fullName: peer.fullName, avatarUrl: peer.avatarUrl },
      unreadCount: unread,
      lastMessageAt: convo.lastMessageAt ?? null,
      lastMessage: last ? this.messageView(last) : null,
    };
  }

  /** Conversation list for the messages inbox, newest activity first. */
  async listConversations(user: User): Promise<DmConversationView[]> {
    const convos = await this.prisma.privateConversation.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      include: { userA: { select: peerSelect }, userB: { select: peerSelect } },
    });
    return Promise.all(convos.map((convo) => this.conversationView(convo, user.id)));
  }

  /** Open (find-or-create) the conversation with a peer — wall username tap. */
  async openWith(user: User, peerId: number): Promise<DmConversationView> {
    if (peerId === user.id) throw new BadRequestException('امکان گفتگو با خودتان وجود ندارد');
    const peer = await this.prisma.user.findFirst({
      where: { id: peerId, status: 'ACTIVE' },
      select: peerSelect,
    });
    if (!peer) throw new NotFoundException('کاربر یافت نشد');

    const pair = this.pair(user.id, peerId);
    const convo = await this.prisma.privateConversation.upsert({
      where: { userAId_userBId: pair },
      create: pair,
      update: {},
    });
    const full = await this.prisma.privateConversation.findUnique({
      where: { id: convo.id },
      include: { userA: { select: peerSelect }, userB: { select: peerSelect } },
    });
    if (!full) throw new NotFoundException('مکالمه یافت نشد');
    return this.conversationView(full, user.id);
  }

  /** One page of a conversation (oldest→newest) — also marks it read. */
  async listMessages(
    user: User,
    conversationId: number,
    before?: string,
    limit: number = DEFAULT_PAGE,
  ): Promise<{ messages: DmMessageView[]; nextBefore: string | null }> {
    const convo = await this.conversationOf(user.id, conversationId);
    const rows = await this.prisma.privateMessage.findMany({
      where: {
        conversationId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { image: { select: { url: true } } },
    });
    // Opening the thread marks it read — the nav badge counts newer messages.
    await this.markRead(convo, user.id);
    const oldest = rows[rows.length - 1];
    return {
      messages: rows.reverse().map((r) => this.messageView(r)),
      nextBefore: rows.length === limit && oldest ? oldest.createdAt.toISOString() : null,
    };
  }

  /** Send a text body and/or one image into a conversation. */
  async sendMessage(
    user: User,
    conversationId: number,
    dto: { body?: string; imageId?: number },
  ): Promise<DmMessageView> {
    const convo = await this.conversationOf(user.id, conversationId);
    const body = dto.body?.trim() ?? '';
    if (!body && !dto.imageId) throw new BadRequestException('پیام خالی است');

    let image: { id: number; url: string } | null = null;
    if (dto.imageId) {
      image = await this.prisma.media.findFirst({
        where: { id: dto.imageId, ownerUserId: user.id, deletedAt: null },
        select: { id: true, url: true },
      });
      if (!image) throw new NotFoundException('تصویر یافت نشد');
    }

    const msg = await this.prisma.privateMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body: body || null,
        imageId: image?.id ?? null,
      },
      include: { image: { select: { url: true } } },
    });
    await this.prisma.privateConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: msg.createdAt,
        ...(convo.userAId === user.id ? { aLastReadAt: msg.createdAt } : { bLastReadAt: msg.createdAt }),
      },
    });

    // Notification delivery is best-effort and must not make a successfully
    // saved private message appear to have failed.
    const recipientId = convo.userAId === user.id ? convo.userBId : convo.userAId;
    try {
      await this.prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'MESSAGE',
          title: 'پیام خصوصی جدید',
          body: 'برای مشاهده پیام جدید وارد صندوق پیام‌ها شوید.',
        },
      });
    } catch {
      // The message remains available in the inbox even if notification delivery fails.
    }

    return this.messageView(msg);
  }

  /** Total unread private messages — the bottom-nav red badge. */
  async unreadTotal(user: User): Promise<{ total: number }> {
    const convos = await this.prisma.privateConversation.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      select: { id: true, userAId: true, aLastReadAt: true, bLastReadAt: true },
    });
    const counts = await Promise.all(
      convos.map((convo) =>
        this.prisma.privateMessage.count({
          where: {
            conversationId: convo.id,
            senderId: { not: user.id },
            createdAt: { gt: this.readAt(convo, user.id) },
          },
        }),
      ),
    );
    return { total: counts.reduce((sum, n) => sum + n, 0) };
  }
}
