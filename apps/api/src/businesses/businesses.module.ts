import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { BusinessExpiryScheduler } from './businesses.scheduler';
import { ServiceListingsController } from './service-listings.controller';
import { ServiceListingsService } from './service-listings.service';
import { BusinessReviewsController } from './business-reviews.controller';
import { BusinessReviewsService } from './business-reviews.service';

/** Owner-submitted business registration (create → PENDING moderation queue). */
@Module({
  controllers: [BusinessesController, ServiceListingsController, BusinessReviewsController],
  providers: [BusinessesService, BusinessExpiryScheduler, ServiceListingsService, BusinessReviewsService],
})
export class BusinessesModule {}
