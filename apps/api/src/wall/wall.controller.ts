import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, RequirePermissions } from '../common/decorators';
// Value import on purpose: `import type` would erase the classes and
// emit `Function` in design:paramtypes, so ValidationPipe would reject
// every declared property as unknown.
import { CreateWallPostDto, PinWallPostDto, WallListQueryDto } from './wall.dto';
import { WallService } from './wall.service';

/**
 * City wall API (Phase 8b). Every route requires a login (no @Public — the
 * wall is a members' space); the pin route additionally needs `chat.moderate`.
 */
@Controller('wall')
export class WallController {
  constructor(private readonly wall: WallService) {}

  /** Newest-first feed of one city + its pinned post. */
  @Get()
  list(@CurrentUser() user: User, @Query() query: WallListQueryDto) {
    return this.wall.list(user, query.city, query.limit, query.before);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateWallPostDto) {
    return this.wall.create(user, dto);
  }

  /** Like toggle — returns { liked, likeCount }. */
  @Post(':id/like')
  toggleLike(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.wall.toggleLike(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.wall.remove(user, id);
  }

  @Post(':id/pin')
  @RequirePermissions('chat.moderate')
  setPinned(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PinWallPostDto,
  ) {
    return this.wall.setPinned(user, id, dto.pinned ?? true);
  }
}
