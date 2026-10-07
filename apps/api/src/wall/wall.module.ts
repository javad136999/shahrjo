import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WallController } from './wall.controller';
import { WallService } from './wall.service';

/** City wall — Phase 8b. */
@Module({
  imports: [RbacModule, UploadsModule],
  controllers: [WallController],
  providers: [WallService],
  exports: [WallService],
})
export class WallModule {}
