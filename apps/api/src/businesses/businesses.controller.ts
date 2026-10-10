import { Body, Controller, Get, Post } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { CreateBusinessDto } from './businesses.dto';
import { BusinessesService } from './businesses.service';

@Controller()
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  /** Active business categories for the registration form (public). */
  @Public()
  @Get('business-categories')
  categories(): ReturnType<BusinessesService['categories']> {
    return this.businesses.categories();
  }

  /** Register a new business (auth) — starts PENDING + FREE, tier via payment. */
  @Post('businesses')
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateBusinessDto,
  ): ReturnType<BusinessesService['create']> {
    return this.businesses.create(user, dto);
  }
}
