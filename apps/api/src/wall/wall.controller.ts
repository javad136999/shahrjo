import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, RequirePermissions, RateLimit } from '../common/decorators';
import { RateLimitGuard } from '../common/rate-limit.guard';
// Value import on purpose: `import type` would erase the classes and
// emit `Function` in design:paramtypes, so ValidationPipe would reject
// every declared property as unknown.
import { CreateWallPostDto, EditWallPostDto, PinWallPostDto, WallListQueryDto } from './wall.dto';
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

  // هم‌سطح با سقف DB سرویس (۱۰ پست/دقیقه) اما در لایه Redis و پیش از اعتبارسنجی؛
  // فقط POST محدود می‌شود چون GET /wall هر ۵ ثانیه توسط کلاینت poll می‌شود.
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'wall:post', limit: 10, windowSeconds: 60, subject: 'user' })
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateWallPostDto) {
    return this.wall.create(user, dto);
  }

  /** Edit own message text — the feed shows an «ویرایش شد» marker. */
  @Patch(':id')
  edit(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: EditWallPostDto) {
    return this.wall.edit(user, id, dto.content);
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
