import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService, type AdminScope } from '../rbac/rbac.service';

/** Reason attached to a rejection (also persisted to the audit log). */
export interface DecisionDto {
  reason?: string;
}

/** Optional pin dropped by the admin while approving a business (map marker). */
export interface BusinessDecisionDto extends DecisionDto {
  latitude?: number;
  longitude?: number;
}

export interface AdminOverview {
  pendingAds: number;
  pendingBusinesses: number;
  pendingSubscriptions: number;
  approvedAds: number;
  approvedBusinesses: number;
  activeSubscriptions: number;
}

export interface QueueAd {
  id: number;
  title: string;
  status: string;
  rejectedReason: string | null;
  createdAt: Date;
  viewCount: number;
  city: { id: number; name: string };
  owner: { id: number; phone: string; fullName: string | null };
  category: { name: string; icon: string | null };
  coverUrl: string | null;
  imageCount: number;
}

export interface QueueBusiness {
  id: number;
  name: string;
  slug: string;
  status: string;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  subscriptionTier: string;
  createdAt: Date;
  city: { id: number; name: string };
  owner: { id: number; phone: string; fullName: string | null };
  category: { name: string; icon: string | null };
}

export interface QueueSubscription {
  id: number;
  tier: string;
  status: string;
  createdAt: Date;
  plan: { code: string; label: string; tier: string; durationDays: number };
  business: { id: number; name: string; city: { id: number; name: string } } | null;
  payer: { id: number; phone: string; fullName: string | null };
}

/**
 * Admin panel backend (Phase 8): moderation queues for ads, businesses and
 * paid subscriptions, scoped by the operator's role (SUPER_ADMIN sees
 * everything, PROVINCE_ADMIN/CITY_ADMIN only their area), with every decision
 * written to `audit_logs`.
 *
 * A successful payment never publishes anything by itself: business-bound
 * subscriptions only go live here (approve -> ACTIVE + business tier), which
 * is what feeds the golden showcase and the city map.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  // ---------- scope helpers ----------

  private async scopeOf(userId: number): Promise<AdminScope> {
    const scope = await this.rbac.getScope(userId);
    if (!scope) throw new ForbiddenException('دسترسی کافی ندارید');
    return scope;
  }

  /** Prisma `where` fragment restricting ads/businesses to the operator's area. */
  private cityFilter(scope: AdminScope): Record<string, unknown> {
    if (scope.cityId) return { cityId: scope.cityId };
    if (scope.provinceId) return { city: { provinceId: scope.provinceId } };
    return {};
  }

  private async adminRowId(userId: number): Promise<number> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { userId },
      select: { id: true, isActive: true },
    });
    if (!admin || !admin.isActive) throw new ForbiddenException('دسترسی کافی ندارید');
    return admin.id;
  }

  private async audit(
    adminUserId: number,
    action: string,
    entity: string,
    entityId: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { adminUserId, action, entity, entityId, after: after as object },
    });
  }

  // ---------- overview ----------

  async overview(user: User): Promise<AdminOverview> {
    const scope = await this.scopeOf(user.id);
    const filter = this.cityFilter(scope);
    // Personal subscriptions (no business) are only visible to unscoped admins.
    const subFilter =
      scope.cityId || scope.provinceId ? { business: this.cityFilter(scope) } : {};
    const [pendingAds, pendingBusinesses, pendingSubscriptions, approvedAds, approvedBusinesses, activeSubscriptions] =
      await Promise.all([
        this.prisma.ad.count({ where: { status: 'PENDING', ...filter } }),
        this.prisma.business.count({ where: { status: 'PENDING', ...filter } }),
        this.prisma.subscription.count({ where: { status: 'PENDING_REVIEW', ...subFilter } }),
        this.prisma.ad.count({ where: { status: 'APPROVED', ...filter } }),
        this.prisma.business.count({ where: { status: 'APPROVED', ...filter } }),
        this.prisma.subscription.count({ where: { status: 'ACTIVE', ...subFilter } }),
      ]);
    return {
      pendingAds,
      pendingBusinesses,
      pendingSubscriptions,
      approvedAds,
      approvedBusinesses,
      activeSubscriptions,
    };
  }

  // ---------- ads ----------

  async ads(user: User, status: string): Promise<QueueAd[]> {
    const scope = await this.scopeOf(user.id);
    const rows = await this.prisma.ad.findMany({
      where: { status: status as 'PENDING', ...this.cityFilter(scope) },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        rejectedReason: true,
        createdAt: true,
        viewCount: true,
        city: { select: { id: true, name: true } },
        user: { select: { id: true, phone: true, fullName: true } },
        category: { select: { name: true, icon: true } },
        images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
      },
    });
    return rows.map(({ images, user: owner, ...rest }) => ({
      ...rest,
      owner,
      coverUrl: images[0]?.url ?? null,
      imageCount: images.length,
    }));
  }

  async approveAd(user: User, id: number): Promise<{ id: number; status: string }> {
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const ad = await this.prisma.ad.findFirst({
      where: { id, ...this.cityFilter(scope) },
      select: { id: true, status: true },
    });
    if (!ad) throw new NotFoundException('آگهی یافت نشد');

    const updated = await this.prisma.ad.update({
      where: { id },
      data: {
        status: 'APPROVED',
        publishedAt: new Date(), // first approval stamps publish time
        rejectedReason: null,
        expiresAt: new Date(Date.now() + 30 * 86_400_000), // 30-day TTL re-armed at approval
      },
      select: { id: true, status: true },
    });
    await this.audit(adminId, 'ad.approve', 'ad', String(id), { status: 'APPROVED' });
    return updated;
  }

  async rejectAd(user: User, id: number, dto: DecisionDto): Promise<{ id: number; status: string }> {
    const reason = (dto.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('علت رد را وارد کن');
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const ad = await this.prisma.ad.findFirst({
      where: { id, ...this.cityFilter(scope) },
      select: { id: true },
    });
    if (!ad) throw new NotFoundException('آگهی یافت نشد');

    const updated = await this.prisma.ad.update({
      where: { id },
      data: { status: 'REJECTED', rejectedReason: reason.slice(0, 300) },
      select: { id: true, status: true },
    });
    await this.audit(adminId, 'ad.reject', 'ad', String(id), { status: 'REJECTED', reason });
    return updated;
  }

  // ---------- businesses ----------

  async businesses(user: User, status: string): Promise<QueueBusiness[]> {
    const scope = await this.scopeOf(user.id);
    const rows = await this.prisma.business.findMany({
      where: { status: status as 'PENDING', ...this.cityFilter(scope) },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        phone: true,
        address: true,
        latitude: true,
        longitude: true,
        subscriptionTier: true,
        createdAt: true,
        city: { select: { id: true, name: true } },
        owner: { select: { id: true, phone: true, fullName: true } },
        category: { select: { name: true, icon: true } },
      },
    });
    return rows.map(({ owner, ...rest }) => ({ ...rest, owner }));
  }

  async approveBusiness(user: User, id: number, dto: BusinessDecisionDto): Promise<{ id: number; status: string }> {
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const business = await this.prisma.business.findFirst({
      where: { id, ...this.cityFilter(scope) },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');

    // Optional map pin: both coordinates or neither.
    const hasLat = dto.latitude !== undefined;
    const hasLng = dto.longitude !== undefined;
    if (hasLat !== hasLng) throw new BadRequestException('مختصات باید کامل وارد شود');
    if (hasLat) {
      if (dto.latitude! < -90 || dto.latitude! > 90 || dto.longitude! < -180 || dto.longitude! > 180) {
        throw new BadRequestException('مختصات نامعتبر است');
      }
    }

    const updated = await this.prisma.business.update({
      where: { id },
      data: {
        status: 'APPROVED',
        ...(hasLat ? { latitude: dto.latitude!, longitude: dto.longitude! } : {}),
      },
      select: { id: true, status: true },
    });
    await this.audit(adminId, 'business.approve', 'business', String(id), {
      status: 'APPROVED',
      ...(hasLat ? { latitude: dto.latitude, longitude: dto.longitude } : {}),
    });
    return updated;
  }

  async rejectBusiness(user: User, id: number, dto: DecisionDto): Promise<{ id: number; status: string }> {
    const reason = (dto.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('علت رد را وارد کن');
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const business = await this.prisma.business.findFirst({
      where: { id, ...this.cityFilter(scope) },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');

    const updated = await this.prisma.business.update({
      where: { id },
      data: { status: 'REJECTED' },
      select: { id: true, status: true },
    });
    await this.audit(adminId, 'business.reject', 'business', String(id), { status: 'REJECTED', reason });
    return updated;
  }

  // ---------- subscriptions (the ZarinPal approval step) ----------

  async subscriptions(user: User, status: string): Promise<QueueSubscription[]> {
    const scope = await this.scopeOf(user.id);
    const rows = await this.prisma.subscription.findMany({
      where: {
        status: status as 'PENDING_REVIEW',
        ...(scope.cityId || scope.provinceId
          ? { business: this.cityFilter(scope) }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        tier: true,
        status: true,
        createdAt: true,
        plan: { select: { code: true, label: true, tier: true, durationDays: true } },
        business: { select: { id: true, name: true, city: { select: { id: true, name: true } } } },
        user: { select: { id: true, phone: true, fullName: true } },
      },
    });
    return rows.map(({ user: payer, ...rest }) => ({ ...rest, payer }));
  }

  async approveSubscription(user: User, id: number): Promise<{ id: number; status: string }> {
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const sub = await this.prisma.subscription.findFirst({
      where: { id, ...(scope.cityId || scope.provinceId ? { business: this.cityFilter(scope) } : {}) },
      include: { plan: { select: { durationDays: true } }, business: { select: { id: true, subscriptionExpiresAt: true } } },
    });
    if (!sub) throw new NotFoundException('اشتراک یافت نشد');
    if (sub.status !== 'PENDING_REVIEW') throw new BadRequestException('این اشتراک قبلاً بررسی شده است');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + sub.plan.durationDays * 86_400_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id },
        data: { status: 'ACTIVE', startsAt: now, expiresAt, reviewedById: adminId },
      });
      if (sub.businessId !== null) {
        // Never shorten an already-active period: keep the later expiry.
        const current = sub.business?.subscriptionExpiresAt;
        const effective = current && current > expiresAt ? current : expiresAt;
        await tx.business.update({
          where: { id: sub.businessId },
          data: {
            subscriptionTier: sub.tier,
            subscriptionStatus: 'ACTIVE',
            subscriptionExpiresAt: effective,
            showcasePriority: sub.tier === 'GOLD' ? 10 : 50,
          },
        });
      }
    });

    await this.audit(adminId, 'subscription.approve', 'subscription', String(id), {
      status: 'ACTIVE',
      tier: sub.tier,
      expiresAt: expiresAt.toISOString(),
    });
    return { id, status: 'ACTIVE' };
  }

  async rejectSubscription(user: User, id: number, dto: DecisionDto): Promise<{ id: number; status: string }> {
    const reason = (dto.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('علت رد را وارد کن');
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const sub = await this.prisma.subscription.findFirst({
      where: { id, ...(scope.cityId || scope.provinceId ? { business: this.cityFilter(scope) } : {}) },
      select: { id: true, status: true },
    });
    if (!sub) throw new NotFoundException('اشتراک یافت نشد');
    if (sub.status !== 'PENDING_REVIEW') throw new BadRequestException('این اشتراک قبلاً بررسی شده است');

    await this.prisma.subscription.update({
      where: { id },
      data: { status: 'REJECTED', reviewNote: reason.slice(0, 300), reviewedById: adminId },
    });
    await this.audit(adminId, 'subscription.reject', 'subscription', String(id), {
      status: 'REJECTED',
      reason,
    });
    return { id, status: 'REJECTED' };
  }
}
