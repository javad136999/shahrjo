import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { CreateAdDto, UpdateAdDto } from './ads.dto';
import { AdsService } from './ads.service';

@Controller()
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  /** Active ad categories for the submission form (public, like /cities). */
  @Public()
  @Get('ad-categories')
  categories(): ReturnType<AdsService['categories']> {
    return this.ads.categories();
  }

  /** Submit an ad for moderation — always PENDING, city from the profile. */
  @Post('ads')
  create(@CurrentUser() user: User, @Body() dto: CreateAdDto): ReturnType<AdsService['create']> {
    return this.ads.create(user, dto);
  }

  /** The caller's own ads with moderation status. */
  @Get('ads/mine')
  mine(@CurrentUser() user: User): ReturnType<AdsService['mine']> {
    return this.ads.mine(user);
  }

  /** The caller's favorited ads (declared before ads/:id on purpose). */
  @Get('ads/favorites')
  favorites(@CurrentUser() user: User): ReturnType<AdsService['favorites']> {
    return this.ads.favorites(user);
  }

  /** Toggle a favorite on an ad. */
  @Post('ads/:id/favorite')
  toggleFavorite(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): ReturnType<AdsService['toggleFavorite']> {
    return this.ads.toggleFavorite(user, id);
  }

  /**
   * Owner edit of an ad (long-press ✏️ on the wall card): partial update of
   * the text/price/contact fields and, when given, a whole new gallery.
   * Authenticated — the service allows only the owner.
   */
  @Patch('ads/:id')
  updateAd(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdDto,
  ): ReturnType<AdsService['update']> {
    return this.ads.update(user, id, dto);
  }

  /**
   * Remove an ad (owner or moderator): it leaves the ads feeds and every
   * city-wall card in one call, and its pictures are freed from disk.
   * Authenticated — the service allows only the owner or a moderator.
   */
  @Delete('ads/:id')
  removeAd(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.ads.remove(user, id);
  }

  /**
   * Ad detail (Phase 6): public for approved ads; with a valid token the owner
   * also gets their own pending/rejected ad plus the favorited flag — the
   * global guard attaches the user opportunistically on @Public routes.
   */
  @Public()
  @Get('ads/:id')
  detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User | undefined,
  ): ReturnType<AdsService['detail']> {
    return this.ads.detail(id, user ?? null);
  }
}
