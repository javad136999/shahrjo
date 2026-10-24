import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveBusinessReviewDto } from './business-reviews.dto';

export interface BusinessReviewItem {
  id: number;
  rating: number;
  body: string | null;
  updatedAt: Date;
  userName: string;
}

export interface SavedBusinessReview {
  review: BusinessReviewItem;
  rating: number;
  ratingCount: number;
}

interface ReviewWithAuthor {
  id: number;
  rating: number;
  body: string | null;
  updatedAt: Date;
  user: { fullName: string | null };
}

function toReviewItem(review: ReviewWithAuthor): BusinessReviewItem {
  return {
    id: review.id,
    rating: review.rating,
    body: review.body,
    updatedAt: review.updatedAt,
    userName: review.user.fullName?.trim() || 'کاربر شهرجو',
  };
}

const reviewSelect = {
  id: true,
  rating: true,
  body: true,
  updatedAt: true,
  user: { select: { fullName: true } },
} as const;

@Injectable()
export class BusinessReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Latest public reviews for an approved business, with no private account data. */
  async list(businessId: number): Promise<BusinessReviewItem[]> {
    await this.assertApprovedBusiness(businessId);
    const reviews = await this.prisma.review.findMany({
      where: { businessId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: reviewSelect,
    });
    return reviews.map(toReviewItem);
  }

  /** The current user's review, or null when they have not reviewed this business. */
  async mine(user: User, businessId: number): Promise<BusinessReviewItem | null> {
    await this.assertApprovedBusiness(businessId);
    const review = await this.prisma.review.findUnique({
      where: { businessId_userId: { businessId, userId: user.id } },
      select: reviewSelect,
    });
    return review ? toReviewItem(review) : null;
  }

  /** One review per user/business; subsequent saves edit that same review. */
  async save(user: User, businessId: number, dto: SaveBusinessReviewDto): Promise<SavedBusinessReview> {
    const body = dto.body?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      // Serialize writes per business so concurrent ratings cannot leave a stale
      // denormalized average/count on the Business row.
      await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM "businesses" WHERE id = ${businessId} FOR UPDATE`;

      const business = await tx.business.findFirst({
        where: { id: businessId, status: 'APPROVED' },
        select: { id: true, ownerId: true },
      });
      if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');
      if (business.ownerId === user.id) {
        throw new BadRequestException('نمی‌توانید به کسب‌وکار خودتان امتیاز بدهید');
      }

      const review = await tx.review.upsert({
        where: { businessId_userId: { businessId, userId: user.id } },
        create: { businessId, userId: user.id, rating: dto.rating, body },
        update: { rating: dto.rating, body },
        select: reviewSelect,
      });
      const aggregate = await tx.review.aggregate({
        where: { businessId },
        _avg: { rating: true },
        _count: { _all: true },
      });
      const summary = await tx.business.update({
        where: { id: businessId },
        data: {
          rating: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count._all,
        },
        select: { rating: true, ratingCount: true },
      });

      return { review: toReviewItem(review), ...summary };
    });
  }

  private async assertApprovedBusiness(businessId: number): Promise<void> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');
  }
}
