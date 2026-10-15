import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** How often the paid-subscription clock is checked (hourly is plenty). */
const SWEEP_MS = 60 * 60 * 1000;

/**
 * Subscriptions run on a clock, so somebody has to watch it: an APPROVED
 * business whose paid period has ended is suspended here (status → CLOSED,
 * subscriptionStatus → EXPIRED), which makes every public query (list, map,
 * showcase, detail) drop it on the next read — the same state a manual admin
 * suspension produces.
 *
 * The owner keeps seeing it in «کسب‌وکارهای من» marked «تعلیق» with a
 * reactivate CTA: paying for any plan brings it back for exactly the purchased
 * duration (PaymentsService.verifyPayment).
 *
 * FREE businesses are untouched — `subscriptionExpiresAt` stays null for a
 * registration that never paid, so it can never match the sweep.
 */
@Injectable()
export class BusinessExpiryScheduler implements OnModuleInit {
  private readonly logger = new Logger(BusinessExpiryScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const timer = setInterval(() => void this.sweepSafely(), SWEEP_MS);
    timer.unref?.();
    // catch up immediately after a restart (the process was down at expiry)
    void this.sweepSafely();
  }

  private async sweepSafely(): Promise<void> {
    try {
      const suspended = await this.sweep();
      if (suspended > 0) this.logger.log(`subscription expiry: suspended ${suspended} business(es)`);
    } catch (err) {
      this.logger.warn(`subscription expiry sweep failed: ${String(err)}`);
    }
  }

  /** Suspends every approved business past its paid-until date; returns the count. */
  async sweep(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.business.updateMany({
      where: {
        status: 'APPROVED',
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: { not: null, lte: now },
      },
      data: { status: 'CLOSED', subscriptionStatus: 'EXPIRED' },
    });
    return result.count;
  }
}
