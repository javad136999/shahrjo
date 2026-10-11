import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { DmMessagesQueryDto, SendDmDto, StartDmDto } from './dm.dto';
import { DmService } from './dm.service';

/**
 * Private messages (پیام‌های خصوصی): 1:1 conversations started from the city
 * wall. All routes require a login; the client polls (no WebSocket).
 */
@Controller('dm')
export class DmController {
  constructor(private readonly dm: DmService) {}

  /** Inbox: conversations with peer info, last message and unread counts. */
  @Get('conversations')
  list(@CurrentUser() user: User) {
    return this.dm.listConversations(user);
  }

  /** Start (or resume) the conversation with a peer by user id. */
  @Post('conversations')
  open(@CurrentUser() user: User, @Body() dto: StartDmDto) {
    return this.dm.openWith(user, dto.userId);
  }

  /** One page of messages; opening the thread marks it read. */
  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DmMessagesQueryDto,
  ) {
    return this.dm.listMessages(user, id, query.before, query.limit);
  }

  @Post('conversations/:id/messages')
  send(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: SendDmDto) {
    return this.dm.sendMessage(user, id, dto);
  }

  /** Unread total for the bottom-nav badge. */
  @Get('unread')
  unread(@CurrentUser() user: User) {
    return this.dm.unreadTotal(user);
  }
}
