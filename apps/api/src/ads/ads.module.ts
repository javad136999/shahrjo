import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

/** User ad submission (Phase 5): create → PENDING moderation queue + removal. */
@Module({
  imports: [RbacModule, UploadsModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
