import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService, type AdminScope } from '../rbac/rbac.service';
import { UploadsService } from '../uploads/uploads.service';
import { assertInCity } from '../businesses/businesses.service';

/**
 * Body DTOs are decorated CLASSES, not interfaces: Nest's ValidationPipe can
 * only validate runtime types — an interface erases to `Object` in
 * design:paramtypes and the whitelist silently never runs.
 *
 * Reason attached to a rejection (also persisted to the audit log).
 */
export class DecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

/** Optional pin dropped by the admin while approving a business (map marker). */
export class BusinessDecisionDto extends DecisionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

/**
 * Manual signup by an operator («ثبت دستی کسب‌وکار»). The owner economy is
 * self-serve (register + pay → live), but an admin must also be able to put a
 * business on the map by hand: a shop that never signs up, a migrated
 * listing, a sponsor. Published immediately — the operator IS the moderation
 * step — so the shape is deliberately small.
 */
export class AdminCreateBusinessDto extends BusinessDecisionDto {
  @Type(() => Number)
  @IsNumber()
  cityId!: number;

  @Type(() => Number)
  @IsNumber()
  categoryId!: number;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  /** Owner account: phone of an existing user; omitted → the operator owns it. */
  @IsOptional()
  @IsString()
  @MaxLength(15)
  ownerPhone?: string;

  /** Paid tier to publish with (`GOLD`/`SILVER`); omitted → FREE. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  tier?: string;

  /** How many months the chosen tier stays active (required with a tier). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  months?: number;

  /** Business photo: the operator's own `POST /uploads/business` URL. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}

/** GeoJSON Polygon boundary of a city map (null/undefined clears it). */
export class BoundaryDto {
  /** Deep shape/range/cap checks live in normalizeBoundary. */
  @IsOptional()
  @IsObject()
  boundary?: unknown;
}

/** Hard cap so a boundary cannot bloat the row (and the JSON payload). */
export const MAX_BOUNDARY_POINTS = 5000;

/**
 * Validates + normalizes an admin-supplied GeoJSON Polygon: numeric rings with
 * sane coordinates, auto-closed. Returns `null` (clear) or the normalized
 * geometry; throws BadRequestException on anything else.
 */
export function normalizeBoundary(input: unknown): object | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('محدوده شهر باید از نوع GeoJSON Polygon باشد');
  }
  const geo = input as { type?: unknown; coordinates?: unknown };
  if (geo.type !== 'Polygon' || !Array.isArray(geo.coordinates) || geo.coordinates.length === 0) {
    throw new BadRequestException('محدوده شهر باید از نوع GeoJSON Polygon باشد');
  }
  let total = 0;
  const rings: number[][][] = [];
  for (const ring of geo.coordinates) {
    if (!Array.isArray(ring) || ring.length < 3) {
      throw new BadRequestException('حلقه محدوده باید حداقل ۳ نقطه داشته باشد');
    }
    const pts: number[][] = [];
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2 || typeof point[0] !== 'number' || typeof point[1] !== 'number') {
        throw new BadRequestException('نقاط محدوده معتبر نیستند');
      }
      const [lng, lat] = point;
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new BadRequestException('مختصات محدوده خارج از محدوده مجاز است');
      }
      pts.push([lng, lat]);
    }
    total += pts.length;
    if (total > MAX_BOUNDARY_POINTS) {
      throw new BadRequestException('محدوده شهر پیچیده‌تر از حد مجاز است');
    }
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) pts.push(first);
    rings.push(pts);
  }
  return { type: 'Polygon', coordinates: rings };
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
 * A verified payment now activates its subscription and promotes the business
 * by itself (see PaymentsService.verifyPayment) — these queues review content
 * (ads, businesses) and any legacy PENDING_REVIEW subscription rows. An
 * explicit rejection here is never overridden by a later payment: only the
 * tier changes, the rejected status stays.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly uploads: UploadsService,
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

  /**
   * Suspension (تعلیق): the business leaves every public surface at once —
   * every public query in ContentService filters `status: 'APPROVED'`, so a
   * CLOSED row disappears from the list, map, showcase and detail page
   * without touching the owner's data. Reversible via «تأیید».
   */
  async suspendBusiness(user: User, id: number, dto: DecisionDto): Promise<{ id: number; status: string }> {
    const reason = (dto.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('علت تعلیق را وارد کن');
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const business = await this.prisma.business.findFirst({
      where: { id, ...this.cityFilter(scope) },
      select: { id: true, status: true },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');

    const updated = await this.prisma.business.update({
      where: { id },
      data: { status: 'CLOSED' },
      select: { id: true, status: true },
    });
    await this.audit(adminId, 'business.suspend', 'business', String(id), {
      status: 'CLOSED',
      reason,
      from: String(business.status),
    });
    return { ...updated, status: String(updated.status) };
  }

  /**
   * Removal (حذف): the row is marked DELETED (audit trail + FKs stay intact)
   * and its claimed photos — logo and every menu/product picture share
   * `entityType BUSINESS` / `entityId <id>` — are purged from storage so the
   * disk is reclaimed immediately. Products cascade away with a real row
   * delete; here they stay but are unreachable from any public surface.
   */
  async deleteBusiness(user: User, id: number): Promise<{ id: number; status: string; removedFiles: number }> {
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const business = await this.prisma.business.findFirst({
      where: { id, ...this.cityFilter(scope) },
      select: { id: true, status: true, logoUrl: true, coverUrl: true },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');

    const purged = await this.uploads.purgeEntity('BUSINESS', id).catch(() => ({ removed: 0 }));

    const updated = await this.prisma.business.update({
      where: { id },
      data: { status: 'DELETED', logoUrl: null, coverUrl: null },
      select: { id: true, status: true },
    });
    await this.audit(adminId, 'business.delete', 'business', String(id), {
      status: 'DELETED',
      from: String(business.status),
      removedFiles: purged.removed,
    });
    this.logger.log(`business #${id} deleted (${purged.removed} file(s) freed)`);
    return { ...updated, status: String(updated.status), removedFiles: purged.removed };
  }

  /**
   * Manual signup (ثبت دستی): an operator publishes a business directly —
   * status APPROVED, FREE tier, no payment flow and no queue. The city must
   * fall inside the operator's scope, and the owner is an existing user found
   * by phone or, by default, the operator's own account. Every row is audited.
   */
  async createBusiness(
    user: User,
    dto: AdminCreateBusinessDto,
  ): Promise<{ id: number; name: string; status: string; subscriptionTier: string }> {
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);

    if (scope.cityId && scope.cityId !== dto.cityId) {
      throw new ForbiddenException('خارج از محدوده شهر شماست');
    }
    const city = await this.prisma.city.findFirst({
      where: {
        id: dto.cityId,
        isActive: true,
        ...(scope.provinceId ? { provinceId: scope.provinceId } : {}),
      },
      select: { id: true, latitude: true, longitude: true, boundary: true },
    });
    if (!city) throw new NotFoundException('شهر یافت نشد');

    const category = await this.prisma.businessCategory.findFirst({
      where: { id: dto.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');

    // Optional map pin: both coordinates or neither (same rule as approve).
    const hasLat = dto.latitude !== undefined;
    const hasLng = dto.longitude !== undefined;
    if (hasLat !== hasLng) throw new BadRequestException('مختصات باید کامل وارد شود');
    if (hasLat && (dto.latitude! < -90 || dto.latitude! > 90 || dto.longitude! < -180 || dto.longitude! > 180)) {
      throw new BadRequestException('مختصات نامعتبر است');
    }
    // The pin must belong to the chosen city — same containment rule the
    // owner signup uses (a map framed on another city must not save a pin there).
    if (hasLat) assertInCity(city, dto.latitude!, dto.longitude!);

    let ownerId = user.id;
    if (dto.ownerPhone?.trim()) {
      const owner = await this.prisma.user.findFirst({
        where: { phone: dto.ownerPhone.trim() },
        select: { id: true },
      });
      if (!owner) throw new NotFoundException('کاربری با این شماره ثبت نکرده است');
      ownerId = owner.id;
    }

    // Optional paid tier: the operator picks GOLD/SILVER and for how many
    // months it runs — it goes live immediately (no payment path here), and
    // the expiry sweep suspends it when that chosen period ends.
    const tier = dto.tier === 'GOLD' || dto.tier === 'SILVER' ? dto.tier : null;
    if (dto.tier !== undefined && dto.tier !== '' && !tier) {
      throw new BadRequestException('تیپ اشتراک فقط طلایی یا نقره‌ای است');
    }
    if (tier) {
      if (dto.months === undefined || !Number.isInteger(dto.months) || dto.months < 1 || dto.months > 60) {
        throw new BadRequestException('تعداد ماه فعال‌سازی (۱ تا ۶۰) را انتخاب کنید');
      }
    }

    // The photo must be the operator's own upload (same rule as the owner flow).
    const logoUrl = dto.logoUrl?.trim() || null;
    if (logoUrl) {
      if (!logoUrl.startsWith('/api/v1/files/')) {
        throw new BadRequestException('فقط عکس‌های آپلودشده در سایت قابل انتخاب هستند');
      }
      const media = await this.prisma.media.findFirst({
        where: { url: logoUrl, ownerUserId: user.id },
        select: { id: true },
      });
      if (!media) throw new BadRequestException('این عکس پیدا نشد؛ دوباره آپلود کنید');
    }

    // Unique slug: transliterated base + short random suffix (same recipe the
    // owner signup uses — Persian names keep their letters/numbers).
    const base =
      dto.name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'business';
    let slug = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`;
      const clash = await this.prisma.business.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!clash) {
        slug = candidate;
        break;
      }
    }
    if (!slug) throw new BadRequestException('خطا در ثبت کسب‌وکار؛ دوباره تلاش کنید');

    const created = await this.prisma.business.create({
      data: {
        ownerId,
        cityId: city.id,
        categoryId: category.id,
        name: dto.name.trim(),
        slug,
        logoUrl,
        description: dto.description?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        latitude: hasLat ? dto.latitude! : null,
        longitude: hasLng ? dto.longitude! : null,
        status: 'APPROVED', // the operator IS the moderation step
        ...(tier
          ? {
              subscriptionTier: tier as 'GOLD' | 'SILVER',
              subscriptionStatus: 'ACTIVE' as const,
              subscriptionExpiresAt: new Date(Date.now() + dto.months! * 30 * 86_400_000),
              showcasePriority: tier === 'GOLD' ? 10 : 50,
            }
          : { subscriptionTier: 'FREE' as const, subscriptionStatus: 'NONE' as const }),
      },
      select: { id: true, name: true, status: true, subscriptionTier: true },
    });

    // The photo now belongs to the business — the orphan sweep keeps it alive.
    if (logoUrl) {
      await this.prisma.media.updateMany({
        where: { url: logoUrl, ownerUserId: user.id },
        data: { entityType: 'BUSINESS', entityId: String(created.id) },
      });
    }

    await this.audit(adminId, 'business.create', 'business', String(created.id), {
      status: 'APPROVED',
      cityId: city.id,
      categoryId: category.id,
      ownerId,
      tier: tier ?? 'FREE',
      ...(tier ? { months: dto.months } : {}),
    });
    this.logger.log(
      `business #${created.id} «${created.name}» created manually by admin #${adminId}` +
        (tier ? ` (${tier}/${dto.months}m)` : ''),
    );
    return { ...created, status: String(created.status), subscriptionTier: String(created.subscriptionTier) };
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

  // ---------- city map boundary (Phase 9) ----------

  /**
   * Sets (or clears) the GeoJSON boundary of one city — the outline drawn on
   * the public city map. Scoped like every other admin action; audited.
   * Without a boundary the client falls back to a circle around the center.
   */
  async setCityBoundary(user: User, cityId: number, dto: BoundaryDto) {
    const boundary = normalizeBoundary(dto.boundary);
    const scope = await this.scopeOf(user.id);
    const adminId = await this.adminRowId(user.id);
    const city = await this.prisma.city.findFirst({
      where: { id: cityId, ...this.cityFilter(scope) },
      select: { id: true, name: true, slug: true },
    });
    if (!city) throw new NotFoundException('شهر یافت نشد');

    await this.prisma.city.update({
      where: { id: city.id },
      data: { boundary: boundary === null ? Prisma.DbNull : (boundary as Prisma.InputJsonValue) },
    });
    await this.audit(adminId, 'city.boundary', 'city', String(city.id), { boundary });
    return { id: city.id, name: city.name, slug: city.slug, boundary };
  }
}
