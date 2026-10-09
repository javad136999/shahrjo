import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, RateLimit, RequirePermissions } from '../common/decorators';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { CreateBusinessDto } from './businesses.dto';
import { BusinessesService } from './businesses.service';

/**
 * Business registration (user side). `businesses.create` is checked by the
 * global PermissionsGuard — hiding the button is never the control. The row
 * is born PENDING with tier FREE/NONE: paid benefits can only follow a real
 * admin approval (the subscription flow stays separate from moderation).
 */
@Controller()
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'business:create', limit: 10, windowSeconds: 3600, subject: 'user' })
  @RequirePermissions('businesses.create')
  @Post('businesses')
  create(@CurrentUser() user: User, @Body() dto: CreateBusinessDto) {
    return this.businesses.create(user, dto);
  }
}
