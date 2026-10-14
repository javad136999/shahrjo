import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SepalService } from './sepal.service';
import { ZarinpalService } from './zarinpal.service';

/** Subscription plans + Sepal checkout (ZarinPal fallback, Phase 7). */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, ZarinpalService, SepalService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
