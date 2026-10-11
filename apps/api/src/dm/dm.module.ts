import { Module } from '@nestjs/common';
import { DmController } from './dm.controller';
import { DmService } from './dm.service';

/** Private messages (پیام‌های خصوصی): 1:1 chat started from the city wall. */
@Module({
  controllers: [DmController],
  providers: [DmService],
  exports: [DmService],
})
export class DmModule {}
