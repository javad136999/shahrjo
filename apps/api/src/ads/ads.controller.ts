import { Body, Controller, Get, Post } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
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
}
