import { Body, Controller, Get, Post } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { BazaarVerifyDto, CheckoutDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Purchasable plans (public — plan page works logged-out). */
  @Public()
  @Get('subscription-plans')
  plans(): ReturnType<PaymentsService['plans']> {
    return this.payments.plans();
  }

  /** Creates a pending payment; the Android Bazaar app completes it with Poolakey. */
  @Post('payments/checkout')
  checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto): ReturnType<PaymentsService['checkout']> {
    return this.payments.checkout(user, dto);
  }

  /** Verifies the Poolakey purchase token with Bazaar and activates the subscription. */
  @Post('payments/bazaar/verify')
  verifyBazaar(@CurrentUser() user: User, @Body() dto: BazaarVerifyDto): ReturnType<PaymentsService['verifyBazaar']> {
    return this.payments.verifyBazaar(user, dto);
  }

  /** The caller's payment history. */
  @Get('payments/mine')
  mine(@CurrentUser() user: User): ReturnType<PaymentsService['mine']> {
    return this.payments.mine(user);
  }

  /** The caller's subscriptions (profile + /plans). */
  @Get('subscriptions/mine')
  mySubscriptions(@CurrentUser() user: User): ReturnType<PaymentsService['mySubscriptions']> {
    return this.payments.mySubscriptions(user);
  }

}
