import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Post,
  Body,
} from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RedeemReferralCreditDto } from './referrals.dto';

// The cumulative credit balance is valued in Toman in the UI and stored in Rial.
// At each milestone only the difference from the prior cumulative value is granted.
const MILESTONES = [
  { count: 5, tier: 'SILVER', months: 1, title: 'اعتبار فعال‌سازی اشتراک نقره‌ای یک‌ماهه', valueToman: 200_000 },
  { count: 10, tier: 'GOLD', months: 1, title: 'اعتبار فعال‌سازی اشتراک طلایی یک‌ماهه', valueToman: 400_000 },
  { count: 20, tier: 'GOLD', months: 2, title: 'اعتبار فعال‌سازی اشتراک طلایی دوماهه', valueToman: 800_000 },
  { count: 50, tier: 'GOLD', months: 4, title: 'اعتبار فعال‌سازی اشتراک طلایی چهارماهه', valueToman: 1_600_000 },
  { count: 100, tier: 'GOLD', months: 3, title: 'اعتبار فعال‌سازی اشتراک طلایی سه‌ماهه', valueToman: 2_200_000 },
] as const;

/** Grant all newly-earned milestones once; row-lock serializes simultaneous referred logins. */
export async function grantReferralMilestones(prisma: PrismaService, inviterId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${inviterId} FOR UPDATE`;
    const count = await tx.user.count({ where: { referredByUserId: inviterId, status: 'ACTIVE' } });
    const existing = await tx.referralCreditGrant.findMany({
      where: { userId: inviterId },
      select: { milestoneCount: true },
    });
    const granted = new Set(existing.map((row) => row.milestoneCount));
    let previousCumulativeToman = 0;
    const rows: { userId: number; milestoneCount: number; amount: bigint }[] = [];
    for (const milestone of MILESTONES) {
      const incrementToman = milestone.valueToman - previousCumulativeToman;
      previousCumulativeToman = milestone.valueToman;
      if (count >= milestone.count && !granted.has(milestone.count)) {
        rows.push({
          userId: inviterId,
          milestoneCount: milestone.count,
          amount: BigInt(incrementToman * 10), // 1 Toman = 10 Rial
        });
      }
    }
    if (rows.length) await tx.referralCreditGrant.createMany({ data: rows, skipDuplicates: true });
  });
}

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(user: User) {
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = `SJ${user.id.toString(36).toUpperCase().padStart(8, '0')}`;
      await this.prisma.user.update({ where: { id: user.id }, data: { referralCode } });
    }
    await grantReferralMilestones(this.prisma, user.id);
    const [count, grants, redemptions] = await Promise.all([
      this.prisma.user.count({ where: { referredByUserId: user.id, status: 'ACTIVE' } }),
      this.prisma.referralCreditGrant.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
      this.prisma.referralCreditRedemption.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
    ]);
    const balanceRial = Number((grants._sum.amount ?? 0n) - (redemptions._sum.amount ?? 0n));
    let previousCumulativeToman = 0;
    return {
      code: referralCode,
      successfulSignups: count,
      balanceRial,
      balanceToman: balanceRial / 10,
      cashWithdrawalAllowed: false,
      milestones: MILESTONES.map((milestone) => {
        const incrementalToman = milestone.valueToman - previousCumulativeToman;
        previousCumulativeToman = milestone.valueToman;
        return {
          ...milestone,
          incrementalToman,
          achieved: count >= milestone.count,
          remaining: Math.max(0, milestone.count - count),
        };
      }),
    };
  }

  /** Consume non-cash referral credit and activate a paid plan on an owned business atomically. */
  async redeem(user: User, dto: RedeemReferralCreditDto) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize redemptions for one wallet so two concurrent requests cannot overspend.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const [business, plan, grants, redemptions] = await Promise.all([
        tx.business.findFirst({
          where: { id: dto.businessId, ownerId: user.id, status: { in: ['PENDING', 'APPROVED', 'CLOSED'] } },
          select: { id: true, status: true, subscriptionExpiresAt: true },
        }),
        tx.subscriptionPlan.findFirst({
          where: { id: dto.planId, isActive: true, tier: { in: ['GOLD', 'SILVER'] } },
          select: { id: true, tier: true, durationDays: true, price: true },
        }),
        tx.referralCreditGrant.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
        tx.referralCreditRedemption.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
      ]);
      if (!business) throw new NotFoundException('کسب‌وکار فعال و متعلق به شما پیدا نشد');
      if (!plan) throw new NotFoundException('پلن اشتراک فعال پیدا نشد');
      const balance = (grants._sum.amount ?? 0n) - (redemptions._sum.amount ?? 0n);
      if (balance < plan.price) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_REFERRAL_CREDIT',
          message: 'اعتبار معرفی برای فعال‌سازی این پلن کافی نیست',
          balanceRial: Number(balance),
          requiredRial: Number(plan.price),
        });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.durationDays * 86_400_000);
      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          businessId: business.id,
          planId: plan.id,
          tier: plan.tier,
          status: 'ACTIVE',
          startsAt: now,
          expiresAt,
        },
      });
      await tx.referralCreditRedemption.create({
        data: {
          userId: user.id,
          businessId: business.id,
          planId: plan.id,
          subscriptionId: subscription.id,
          amount: plan.price,
        },
      });
      const effectiveExpiry = business.subscriptionExpiresAt && business.subscriptionExpiresAt > expiresAt
        ? business.subscriptionExpiresAt
        : expiresAt;
      await tx.business.update({
        where: { id: business.id },
        data: {
          ...(business.status === 'PENDING' || business.status === 'CLOSED' ? { status: 'APPROVED' as const } : {}),
          subscriptionTier: plan.tier,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: effectiveExpiry,
          showcasePriority: plan.tier === 'GOLD' ? 10 : 50,
        },
      });
      return {
        subscriptionId: subscription.id,
        businessId: business.id,
        planId: plan.id,
        redeemedRial: Number(plan.price),
        balanceRial: Number(balance - plan.price),
      };
    });
  }
}

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  mine(@CurrentUser() user: User) {
    return this.referrals.mine(user);
  }

  @Post('redeem')
  redeem(@CurrentUser() user: User, @Body() dto: RedeemReferralCreditDto) {
    return this.referrals.redeem(user, dto);
  }
}

@Module({ controllers: [ReferralsController], providers: [ReferralsService], exports: [ReferralsService] })
export class ReferralsModule {}
