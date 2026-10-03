import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

/** User ad submission (Phase 5): create → PENDING moderation queue. */
@Module({
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
