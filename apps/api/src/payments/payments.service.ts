import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './payments.dto';
import { ZarinpalService } from './zarinpal.service';

/** Per-user hourly checkout cap — aborted sessions should not spam the gateway. */
const MAX_CHECKOUTS_PER_HOUR = 10;

export interface PlanItem {
  id: number;
  code: string;
  tier: string;
  label: string;
  badge: string | null;
  durationDays: number;
  price: number;
  sortOrder: number;
}

export interface CheckoutResult {
  paymentId: number;
  payUrl: string;
  authority: string;
  amount: number;
}

export type PaymentResultStatus = 'SUCCESS' | 'FAILED' | 'CANCELED' | 'ALREADY_PAID';

/**
 * Subscription purchase via ZarinPal (Phase 7).
 *
 * Flow: POST /payments/checkout creates a CREATED payment and asks ZarinPal
 * for an authority -> the payer is redirected to the gateway -> ZarinPal
 * redirects back to GET /payments/callback, which verifies server-to-server,
 * marks the payment SUCCESS and creates the Subscription. A paid subscription
 * bound to a business still requires admin approval before it promotes
 * anything public; a personal subscription activates immediately.
 *
 * The callback is the only place money is confirmed — the client never
 * reports success, and `Status` from the query string is never trusted on
 * its own (verify is always called with our own stored amount).
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zarinpal: ZarinpalService,
  ) {}

  /** Active purchasable plans (public — shown on /plans before login). */
  async plans(): Promise<PlanItem[]> {
    const rows = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ tier: 'desc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        code: true,
        tier: true,
        label: true,
        badge: true,
        durationDays: true,
        price: true,
        sortOrder: true,
      },
    });
    return rows.map((p) => ({ ...p, price: Number(p.price) }));
  }

  /** Opens a gateway session for a plan (optionally bound to the caller's business). */
  async checkout(user: User, dto: CheckoutDto): Promise<CheckoutResult> {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: dto.planId, isActive: true },
      select: { id: true, code: true, tier: true, label: true, price: true },
    });
    if (!plan) throw new NotFoundException('پلن اشتراک یافت نشد');

    let businessId: number | null = null;
    if (dto.businessId !== undefined) {
      const business = await this.prisma.business.findFirst({
        where: { id: dto.businessId, ownerId: user.id },
        select: { id: true },
      });
      if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');
      businessId = business.id;
    }

    const hourAgo = new Date(Date.now() - 3_600_000);
    const recent = await this.prisma.payment.count({ where: { userId: user.id, createdAt: { gte: hourAgo } } });
    if (recent >= MAX_CHECKOUTS_PER_HOUR) {
      throw new HttpException('سقف پرداخت در ساعت پر شده است؛ کمی بعد دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        businessId,
        planId: plan.id,
        amount: plan.price, // BigInt Rial — the exact amount we will verify later
        status: 'CREATED',
      },
      select: { id: true, amount: true },
    });

    let gateway;
    try {
      gateway = await this.zarinpal.requestPayment(
        payment.amount,
        `اشتراک ${plan.label} شهرجو (${plan.code})`,
      );
    } catch (err) {
      // Keep the failed attempt for audit instead of leaving a dangling CREATED row.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          errorDescription: err instanceof Error ? err.message : 'gateway error',
        },
      });
      throw err;
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'STARTED', authority: gateway.authority },
      select: { id: true, amount: true, authority: true },
    });

    return {
      paymentId: updated.id,
      payUrl: gateway.payUrl,
      authority: updated.authority ?? gateway.authority,
      amount: Number(updated.amount),
    };
  }

  /**
   * Gateway return endpoint. `status` mirrors ZarinPal's `Status` query
   * (OK/NOK) but is only a hint: SUCCESS is decided by verify() alone.
   * Idempotent — a repeated callback on a paid payment returns the same
   * answer without hitting the gateway again.
   */
  async handleCallback(authority: string, status: string): Promise<PaymentResultStatus> {
    const payment = await this.prisma.payment.findUnique({
      where: { authority },
      select: {
        id: true,
        userId: true,
        businessId: true,
        planId: true,
        amount: true,
        status: true,
        refId: true,
      },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');
    if (payment.status === 'SUCCESS') return 'ALREADY_PAID';

    if (String(status).toUpperCase() !== 'OK') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ['CREATED', 'STARTED'] } },
        data: { status: 'CANCELED', errorDescription: 'پرداخت توسط کاربر لغو شد' },
      });
      return 'CANCELED';
    }

    const verify = await this.zarinpal.verifyPayment(payment.amount, authority);
    if (verify.code !== 100 && verify.code !== 101) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ['CREATED', 'STARTED'] } },
        data: {
          status: 'FAILED',
          resultCode: verify.code,
          errorDescription: verify.message || `verify code ${verify.code}`,
        },
      });
      return 'FAILED';
    }

    const alreadyDone = await this.prisma.payment.findUnique({
      where: { id: payment.id },
      select: { status: true },
    });
    if (alreadyDone?.status === 'SUCCESS') return 'ALREADY_PAID';

    // Money confirmed: claim the status transition and create the subscription
    // in ONE transaction (both commit or neither). The UPDATE guards on the old
    // status, so a concurrent duplicate callback loses the race (count 0) and
    // must not create a second subscription row.
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ['CREATED', 'STARTED'] } },
        data: {
          status: 'SUCCESS',
          resultCode: verify.code,
          refId: verify.refId === null ? null : String(verify.refId),
          verifiedAt: new Date(),
          paidAt: new Date(),
        },
      });
      if (claimed.count === 0) return 'ALREADY_PAID' as const;

      const plan = await tx.subscriptionPlan.findUniqueOrThrow({
        where: { id: payment.planId },
        select: { tier: true, durationDays: true },
      });
      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.durationDays * 86_400_000);
      // Business-bound plans wait for admin approval; personal plans go live now.
      // startsAt is set at approval for PENDING_REVIEW, immediately otherwise.
      const needsReview = payment.businessId !== null;

      await tx.subscription.create({
        data: {
          userId: payment.userId,
          businessId: payment.businessId,
          planId: payment.planId,
          tier: plan.tier,
          status: needsReview ? 'PENDING_REVIEW' : 'ACTIVE',
          startsAt: needsReview ? null : now,
          expiresAt: needsReview ? null : expiresAt,
        },
      });

      // A personal subscription starts immediately; the row above is the
      // source of truth (the profile reads it via mySubscriptions()).
      return 'SUCCESS' as const;
    });

    return outcome;
  }

  /** The caller's payment history (newest first), with plan labels. */
  async mine(user: User): Promise<
    { id: number; amount: number; status: string; refId: string | null; createdAt: Date; plan: { code: string; label: string; tier: string } }[]
  > {
    const rows = await this.prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        status: true,
        refId: true,
        createdAt: true,
        plan: { select: { code: true, label: true, tier: true } },
      },
    });
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  /** The caller's subscriptions with their plan (profile + /plans page). */
  async mySubscriptions(user: User): Promise<
    {
      id: number;
      tier: string;
      status: string;
      startsAt: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      plan: { code: string; label: string; tier: string };
      business: { id: number; name: string } | null;
    }[]
  > {
    const rows = await this.prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tier: true,
        status: true,
        startsAt: true,
        expiresAt: true,
        createdAt: true,
        plan: { select: { code: true, label: true, tier: true } },
        business: { select: { id: true, name: true } },
      },
    });
    return rows;
  }
}
