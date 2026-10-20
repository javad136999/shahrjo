import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BazaarVerifyDto, CheckoutDto } from './payments.dto';
import { BazaarService } from './bazaar.service';

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
  productId: string;
  packageName: string;
  developerPayload: string;
  amount: number;
}

export type PaymentResultStatus = 'SUCCESS' | 'FAILED' | 'CANCELED' | 'ALREADY_PAID';

/**
 * Subscription purchase (Phase 7) — Cafe Bazaar in-app billing.
 * The Android client opens Poolakey; this API validates the purchase token
 * with Bazaar before activating any subscription.
 *
 * Flow: POST /payments/checkout creates a CREATED payment; the Android
 * client completes the product purchase and POSTs its token to verify, which
 * marks the payment SUCCESS and creates the Subscription ACTIVE. The same
 * transaction also promotes the business the plan was paid for: its tier,
 * expiry and showcase priority are set immediately, a business still waiting
 * in the moderation queue (PENDING) is approved right there — a paid
 * registration needs no admin step — and a suspended business (CLOSED, either
 * manually or after its subscription ran out) is brought back for the
 * purchased duration. An explicit admin REJECTED/DELETED is never overridden
 * by money (the tier is applied, the moderation decision is left alone).
 *
 * The client never reports success: the token is verified server-to-server
 * against the exact product and the Payment row owned by the authenticated user.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bazaar: BazaarService,
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

  /** Creates a pending Bazaar purchase; the Android client completes it with Poolakey. */
  async checkout(user: User, dto: CheckoutDto): Promise<CheckoutResult> {
    // Fail before creating a pending payment if Bazaar credentials/package are absent.
    if (!this.bazaar.isConfigured) {
      throw new HttpException(
        'پرداخت بازار روی سرور پیکربندی نشده است؛ BAZAAR_ACCESS_TOKEN و BAZAAR_PACKAGE_NAME=ir.shahrju.app را تنظیم کنید.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
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
    const developerPayload = `shahrjo:${randomUUID()}`;
    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        businessId,
        planId: plan.id,
        amount: plan.price,
        status: 'CREATED',
        provider: 'BAZAAR',
        bazaarDeveloperPayload: developerPayload,
      },
      select: { id: true, amount: true },
    });
    return {
      paymentId: payment.id,
      productId: plan.code,
      packageName: this.bazaar.packageName,
      developerPayload,
      amount: Number(payment.amount),
    };
  }
  /** Verifies a Poolakey purchase server-to-server and activates the subscription atomically. */
  async verifyBazaar(user: User, dto: BazaarVerifyDto): Promise<PaymentResultStatus> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, userId: user.id },
      select: { id: true, userId: true, businessId: true, planId: true, amount: true, status: true, provider: true, bazaarDeveloperPayload: true },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');
    if (payment.status === 'SUCCESS') return 'ALREADY_PAID';
    if (payment.provider !== 'BAZAAR') throw new BadRequestException('تراکنش با پرداخت بازار ساخته نشده است');
    const plan = await this.prisma.subscriptionPlan.findUniqueOrThrow({
      where: { id: payment.planId },
      select: { code: true },
    });
    if (plan.code !== dto.productId) throw new BadRequestException('محصول پرداخت با پلن انتخاب‌شده یکسان نیست');
    const purchase = await this.bazaar.verifyPurchase(dto.productId, dto.purchaseToken);
    if (!payment.bazaarDeveloperPayload || purchase.developerPayload !== payment.bazaarDeveloperPayload) {
      throw new BadRequestException('شناسهٔ درخواست خرید بازار با تراکنش یکسان نیست');
    }
    const validUntilTimestampMsec = purchase.validUntilTimestampMsec;
    if (!validUntilTimestampMsec || validUntilTimestampMsec <= Date.now()) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ['CREATED', 'STARTED'] } },
        data: { status: 'FAILED', errorDescription: 'اشتراک بازار فعال نیست یا منقضی شده است' },
      });
      return 'FAILED';
    }
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ['CREATED', 'STARTED'] } },
        data: {
          status: 'SUCCESS',
          authority: dto.purchaseToken,
          refId: purchase.orderId ?? null,
          resultCode: purchase.purchaseState,
          callbackPayload: purchase.raw as Prisma.InputJsonValue,
          verifiedAt: new Date(),
          paidAt: new Date(),
        },
      });
      if (claimed.count === 0) return 'ALREADY_PAID' as const;
      const fullPlan = await tx.subscriptionPlan.findUniqueOrThrow({
        where: { id: payment.planId },
        select: { tier: true },
      });
      return this.activateVerifiedPayment(tx, payment, fullPlan, new Date(validUntilTimestampMsec));
    });
    if (outcome === 'SUCCESS') {
      try {
        await this.prisma.notification.create({
          data: { userId: payment.userId, type: 'PAYMENT', title: 'پرداخت با موفقیت ثبت شد', body: 'اشتراک شما فعال شد.' },
        });
      } catch { /* payment remains active if notification delivery fails */ }
    }
    return outcome;
  }
  private async activateVerifiedPayment(tx: any, payment: any, plan: { tier: any }, expiresAt: Date): Promise<'SUCCESS'> {
    const now = new Date();
    await tx.subscription.create({
      data: { userId: payment.userId, businessId: payment.businessId, planId: payment.planId, tier: plan.tier, status: 'ACTIVE', startsAt: now, expiresAt },
    });
    if (payment.businessId !== null) {
      const business = await tx.business.findUnique({ where: { id: payment.businessId }, select: { status: true, subscriptionExpiresAt: true } });
      if (business) {
        const current = business.subscriptionExpiresAt;
        const effective = current && current > expiresAt ? current : expiresAt;
        await tx.business.update({
          where: { id: payment.businessId },
          data: {
            ...(business.status === 'PENDING' || business.status === 'CLOSED' ? { status: 'APPROVED' as const } : {}),
            subscriptionTier: plan.tier,
            subscriptionStatus: 'ACTIVE',
            subscriptionExpiresAt: effective,
            showcasePriority: plan.tier === 'GOLD' ? 10 : 50,
          },
        });
      }
    }
    return 'SUCCESS';
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
