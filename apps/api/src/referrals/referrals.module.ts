import { Controller, Get, Injectable, Module } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const MILESTONES = [
  { count: 5, tier: 'SILVER', months: 1, title: 'اشتراک نقره‌ای یک‌ماهه', valueToman: 200_000 },
  { count: 10, tier: 'GOLD', months: 1, title: 'اشتراک طلایی یک‌ماهه', valueToman: 400_000 },
  { count: 20, tier: 'GOLD', months: 2, title: 'اشتراک طلایی دوماهه', valueToman: 800_000 },
  { count: 50, tier: 'GOLD', months: 4, title: 'اشتراک طلایی چهارماهه', valueToman: 1_600_000 },
  { count: 100, tier: 'GOLD', months: 3, title: 'اشتراک طلایی سه‌ماهه + یک میلیون تومان وجه نقد', valueToman: 2_200_000, cashToman: 1_000_000 },
] as const;

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(user: User) {
    let referralCode = user.referralCode;
    if (!referralCode) {
      // Backfilled by migration for existing users; this is a safe fallback for
      // unusual accounts created by integrations or old versions.
      referralCode = `SJ${user.id.toString(36).toUpperCase().padStart(8, '0')}`;
      await this.prisma.user.update({ where: { id: user.id }, data: { referralCode } });
    }
    const count = await this.prisma.user.count({ where: { referredByUserId: user.id, status: 'ACTIVE' } });
    return {
      code: referralCode,
      successfulSignups: count,
      milestones: MILESTONES.map((milestone) => ({
        ...milestone,
        achieved: count >= milestone.count,
        remaining: Math.max(0, milestone.count - count),
        // Cash payouts are never initiated without payment details and an
        // administrator's verification; this marks eligibility, not payment.
        cashStatus: 'cashToman' in milestone && milestone.cashToman && count >= milestone.count
          ? 'NEEDS_ADMIN_REVIEW'
          : undefined,
      })),
    };
  }
}

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  mine(@CurrentUser() user: User) {
    return this.referrals.mine(user);
  }
}

@Module({ controllers: [ReferralsController], providers: [ReferralsService] })
export class ReferralsModule {}
