import { Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { NotificationsQueryDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

/** Personal notification inbox. Every query and mutation is scoped to the authenticated user. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: NotificationsQueryDto) {
    return this.notifications.list(user, query.limit);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: User) {
    return this.notifications.unreadCount(user);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(user, id);
  }
}
