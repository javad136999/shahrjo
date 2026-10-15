import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { BusinessExpiryScheduler } from './businesses.scheduler';

/** Owner-submitted business registration (create → PENDING moderation queue). */
@Module({
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessExpiryScheduler],
})
export class BusinessesModule {}
