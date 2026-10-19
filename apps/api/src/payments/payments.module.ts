import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BazaarService } from './bazaar.service';

/** Subscription plans + Cafe Bazaar in-app billing. */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, BazaarService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
