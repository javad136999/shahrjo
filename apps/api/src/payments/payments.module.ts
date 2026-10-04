import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ZarinpalService } from './zarinpal.service';

/** Subscription plans + ZarinPal checkout (Phase 7). */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, ZarinpalService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
