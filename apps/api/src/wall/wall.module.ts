import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { WallController } from './wall.controller';
import { WallService } from './wall.service';

/** City wall — Phase 8b. */
@Module({
  imports: [RbacModule],
  controllers: [WallController],
  providers: [WallService],
  exports: [WallService],
})
export class WallModule {}
