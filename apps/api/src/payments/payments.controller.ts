import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, Public } from '../common/decorators';
import { CheckoutDto } from './payments.dto';
import { PaymentsService } from './payments.service';

/**
 * Subscription payments (Phase 7) — Sepal (سپال) live, ZarinPal fallback.
 *
 * The callback is public on purpose: the gateway redirects the payer's browser
 * there without any JWT. Both gateways arrive as GET query strings:
 *   ZarinPal: ?Authority=...&Status=OK|NOK
 *   Sepal:    ?paymentNumber=...&status=1|0&invoiceNumber=... (callbackMethod=get)
 * It never trusts the query string for success — the service always verifies
 * server-to-server with our stored amount — and answers with a 302 to the web
 * result page instead of JSON.
 */
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  /** Purchasable plans (public — plan page works logged-out). */
  @Public()
  @Get('subscription-plans')
  plans(): ReturnType<PaymentsService['plans']> {
    return this.payments.plans();
  }

  /** Start a checkout: creates the payment row and returns the gateway URL. */
  @Post('payments/checkout')
  checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto): ReturnType<PaymentsService['checkout']> {
    return this.payments.checkout(user, dto);
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

  /**
   * Gateway return URL (public): verify, then 302 the browser to the web app.
   * Redirect target is the configured WEB origin + /plans/result — never a
   * client-supplied URL (open-redirect safe).
   */
  @Public()
  @Get('payments/callback')
  async callback(
    @Query('Authority') authorityQuery?: string,
    @Query('Status') statusQuery?: string,
    @Query('paymentNumber') paymentNumberQuery?: string,
    @Query('status') sepalStatusQuery?: string,
    @Res() res?: Response,
  ): Promise<void> {
    // Normalize both gateways onto (authority, status=OK|NOK):
    // Sepal identifies the row by paymentNumber and reports 1/0.
    const authority = String(paymentNumberQuery ?? authorityQuery ?? '').trim();
    const rawStatus = paymentNumberQuery !== undefined ? sepalStatusQuery : statusQuery;
    const normalized =
      paymentNumberQuery !== undefined ? (String(rawStatus ?? '').trim() === '1' ? 'OK' : 'NOK') : String(rawStatus ?? '').trim();
    const status = normalized;
    const webUrl = (this.config.get<string>('WEB_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');

    let result: string = 'FAILED';
    try {
      result = await this.payments.handleCallback(authority, status);
    } catch {
      // Unknown authority / gateway outage: land on the failure page either way.
      result = 'FAILED';
    }
    res?.redirect(`${webUrl}/plans/result?status=${encodeURIComponent(result)}${authority ? `&authority=${encodeURIComponent(authority)}` : ''}`);
  }
}
