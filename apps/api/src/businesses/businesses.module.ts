import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { BusinessExpiryScheduler } from './businesses.scheduler';
import { ServiceListingsController } from './service-listings.controller';
import { ServiceListingsService } from './service-listings.service';

/** Owner-submitted business registration (create → PENDING moderation queue). */
@Module({
  controllers: [BusinessesController, ServiceListingsController],
  providers: [BusinessesService, BusinessExpiryScheduler, ServiceListingsService],
})
export class BusinessesModule {}
