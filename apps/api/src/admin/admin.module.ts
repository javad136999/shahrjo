import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RbacModule } from '../rbac/rbac.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Admin moderation panel API (Phase 8) + storage/boundary tools (Phase 9). */
@Module({
  imports: [RbacModule, UploadsModule, AnalyticsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
