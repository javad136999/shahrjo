import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WallController } from './wall.controller';
import { WallService } from './wall.service';
import { WallRepostScheduler } from './wall.scheduler';

/** City wall — Phase 8b feed + Phase 10 chat room + daily ad republication. */
@Module({
  imports: [RbacModule, UploadsModule],
  controllers: [WallController],
  providers: [WallService, WallRepostScheduler],
  exports: [WallService],
})
export class WallModule {}
