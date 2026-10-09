import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, NoStore, Public, RateLimit } from '../common/decorators';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { CreateAdDto } from './ads.dto';
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
   * Ad detail (Phase 6): public for approved ads; with a valid token the owner
   * also gets their own pending/rejected ad plus the favorited flag — the
   * global guard attaches the user opportunistically on @Public routes.
   */
  @UseGuards(RateLimitGuard)
  // جزئیات آگهی عمومی و پُرشمار است (اسکرپر/تقلب بازدید): سقف روی هر کاربر
  // یا آی‌پی + بدون کش، چون پاسخ شامل flag مالکیت/favorite کاربر می‌شود.
  @RateLimit({ key: 'ad:detail', limit: 300, windowSeconds: 60, subject: 'user-or-ip' })
  @NoStore()
  @Public()
  @Get('ads/:id')
  detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User | undefined,
  ): ReturnType<AdsService['detail']> {
    return this.ads.detail(id, user ?? null);
  }
}
