import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Admin moderation panel API (Phase 8). */
@Module({
  imports: [RbacModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
