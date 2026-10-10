import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { SendDirectMessageDto, StartConversationDto } from './messages.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations')
  list(@CurrentUser() user: User): ReturnType<MessagesService['list']> {
    return this.messages.list(user);
  }

  @Post('conversations')
  start(@CurrentUser() user: User, @Body() dto: StartConversationDto): ReturnType<MessagesService['start']> {
    return this.messages.start(user, dto);
  }

  @Get('conversations/:id')
  messagesIn(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): ReturnType<MessagesService['messages']> {
    return this.messages.messages(user, id);
  }

  @Post('conversations/:id')
  send(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendDirectMessageDto,
  ): ReturnType<MessagesService['send']> {
    return this.messages.send(user, id, dto);
  }

  @Patch('conversations/:id/read')
  markRead(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): ReturnType<MessagesService['markRead']> {
    return this.messages.markRead(user, id);
  }
}
