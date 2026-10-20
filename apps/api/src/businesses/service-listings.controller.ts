import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { CityContentQueryDto } from '../content/content.dto';
import { CreateServiceListingDto } from './service-listings.dto';
import { ServiceListingsService } from './service-listings.service';

@Controller('service-listings')
export class ServiceListingsController {
  constructor(private readonly serviceListings: ServiceListingsService) {}

  /** Search public, lightweight service entries by city and optional trade. */
  @Public()
  @Get()
  list(@Query() query: CityContentQueryDto): ReturnType<ServiceListingsService['list']> {
    return this.serviceListings.list(query.city, query.limit ?? 200, query.category);
  }

  /** Create a service listing only — it is not a Business profile. */
  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateServiceListingDto,
  ): ReturnType<ServiceListingsService['create']> {
    return this.serviceListings.create(user, dto);
  }
}
