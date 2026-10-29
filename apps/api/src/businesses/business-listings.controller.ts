import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import type { User } from '@prisma/client';
import { BusinessListingsService } from './business-listings.service';
import { CreateBusinessListingDto, UpdateBusinessListingDto } from './business-listings.dto';

@Controller()
export class BusinessListingsController {
  constructor(private readonly listings: BusinessListingsService) {}

  @Get('my-businesses/:businessId/listings')
  mine(@CurrentUser() user: User, @Param('businessId', ParseIntPipe) businessId: number) {
    return this.listings.mine(user, businessId);
  }

  @Post('my-businesses/:businessId/listings')
  create(
    @CurrentUser() user: User,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() dto: CreateBusinessListingDto,
  ) {
    return this.listings.create(user, businessId, dto);
  }

  @Patch('my-businesses/:businessId/listings/:listingId')
  update(
    @CurrentUser() user: User,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Param('listingId', ParseIntPipe) listingId: number,
    @Body() dto: UpdateBusinessListingDto,
  ) {
    return this.listings.update(user, businessId, listingId, dto);
  }

  @Delete('my-businesses/:businessId/listings/:listingId')
  remove(
    @CurrentUser() user: User,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Param('listingId', ParseIntPipe) listingId: number,
  ) {
    return this.listings.remove(user, businessId, listingId);
  }
}
