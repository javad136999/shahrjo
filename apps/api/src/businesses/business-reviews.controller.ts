import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { RateLimiterService } from '../redis/rate-limiter.service';
import { SaveBusinessReviewDto } from './business-reviews.dto';
import { BusinessReviewsService } from './business-reviews.service';

@Controller()
export class BusinessReviewsController {
  constructor(
    private readonly reviews: BusinessReviewsService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  /** Latest public reviews of one approved business. */
  @Public()
  @Get('businesses/:id/reviews')
  list(@Param('id', ParseIntPipe) id: number): ReturnType<BusinessReviewsService['list']> {
    return this.reviews.list(id);
  }

  /** The signed-in user's review, if one exists. */
  @Get('businesses/:id/reviews/me')
  mine(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): ReturnType<BusinessReviewsService['mine']> {
    return this.reviews.mine(user, id);
  }

  /** Create or edit the caller's single review for this business. */
  @Put('businesses/:id/reviews/me')
  async save(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveBusinessReviewDto,
  ): ReturnType<BusinessReviewsService['save']> {
    const limit = await this.rateLimiter.hit(`business-review:${user.id}`, 5, 60);
    if (!limit.allowed) {
      throw new HttpException('برای ثبت نظر کمی صبر کنید و دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.reviews.save(user, id, dto);
  }
}
