import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import { AdminService } from './admin.service';

function makePrisma() {
  const prisma = {
    ad: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    business: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    subscription: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    adminUser: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  return prisma;
}

function makeService(scope: { role: string; provinceId: number | null; cityId: number | null } | null) {
  const prisma = makePrisma();
  const rbac = { getScope: jest.fn().mockResolvedValue(scope) };
  const service = new AdminService(prisma as unknown as PrismaService, rbac as unknown as RbacService);
  prisma.adminUser.findUnique.mockResolvedValue({ id: 77, isActive: true });
  prisma.auditLog.create.mockResolvedValue({});
  return { service, prisma };
}

const admin = { id: 1, phone: '09174057031', cityId: null } as User;

describe('AdminService scope enforcement', () => {
  it('rejects a non-operator even with forged permissions', async () => {
    const { service } = makeService(null); // no admin_users row => getScope null
    await expect(service.overview(admin)).rejects.toMatchObject({ status: 403 });
    await expect(service.ads(admin, 'PENDING')).rejects.toMatchObject({ status: 403 });
  });

  it('narrows CITY_ADMIN queries to their own city', async () => {
    const { service, prisma } = makeService({ role: 'CITY_ADMIN', provinceId: null, cityId: 5 });
    prisma.ad.findMany.mockResolvedValue([]);

    await service.ads(admin, 'PENDING');
    expect(prisma.ad.findMany.mock.calls[0][0].where).toMatchObject({ status: 'PENDING', cityId: 5 });
  });

  it('narrows PROVINCE_ADMIN queries to their province', async () => {
    const { service, prisma } = makeService({ role: 'PROVINCE_ADMIN', provinceId: 3, cityId: null });
    prisma.business.findMany.mockResolvedValue([]);

    await service.businesses(admin, 'PENDING');
    expect(prisma.business.findMany.mock.calls[0][0].where).toMatchObject({
      status: 'PENDING',
      city: { provinceId: 3 },
    });
  });

  it('lets SUPER_ADMIN (unscoped) see everything', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    prisma.ad.findMany.mockResolvedValue([]);

    await service.ads(admin, 'PENDING');
    expect(prisma.ad.findMany.mock.calls[0][0].where).toEqual({ status: 'PENDING' });
  });
});

describe('AdminService ad moderation', () => {
  it('approves with publish stamp + fresh 30-day TTL and writes an audit log', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    prisma.ad.findFirst.mockResolvedValue({ id: 9, status: 'PENDING' });
    prisma.ad.update.mockResolvedValue({ id: 9, status: 'APPROVED' });

    const result = await service.approveAd(admin, 9);

    const data = prisma.ad.update.mock.calls[0][0].data;
    expect(data.status).toBe('APPROVED');
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.rejectedReason).toBeNull();
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(result.status).toBe('APPROVED');
    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 } }),
    );
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      adminUserId: 77,
      action: 'ad.approve',
      entity: 'ad',
      entityId: '9',
    });
  });

  it('requires a reason when rejecting', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    await expect(service.rejectAd(admin, 9, { reason: ' ' })).rejects.toThrow('علت رد');
    await expect(service.rejectAd(admin, 9, {})).rejects.toThrow('علت رد');
    expect(prisma.ad.update).not.toHaveBeenCalled();
  });

  it('404s an ad outside the operator scope', async () => {
    const { service, prisma } = makeService({ role: 'CITY_ADMIN', provinceId: null, cityId: 5 });
    prisma.ad.findFirst.mockResolvedValue(null);

    await expect(service.approveAd(admin, 9)).rejects.toMatchObject({ status: 404 });
    expect(prisma.ad.update).not.toHaveBeenCalled();
  });
});

describe('AdminService subscription approval (ZarinPal)', () => {
  const pendingSub = {
    id: 44,
    tier: 'GOLD',
    status: 'PENDING_REVIEW',
    businessId: 12,
    plan: { durationDays: 30 },
    business: { id: 12, subscriptionExpiresAt: null },
  };

  it('activates the subscription and promotes the business tier', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    prisma.subscription.findFirst.mockResolvedValue(pendingSub);
    prisma.subscription.update.mockResolvedValue({ id: 44 });
    prisma.business.update.mockResolvedValue({ id: 12 });

    const result = await service.approveSubscription(admin, 44);

    expect(result.status).toBe('ACTIVE');
    const subData = prisma.subscription.update.mock.calls[0][0].data;
    expect(subData.status).toBe('ACTIVE');
    expect(subData.startsAt).toBeInstanceOf(Date);
    expect(subData.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(subData.reviewedById).toBe(77);

    const bizData = prisma.business.update.mock.calls[0][0].data;
    expect(bizData).toMatchObject({
      subscriptionTier: 'GOLD',
      subscriptionStatus: 'ACTIVE',
      showcasePriority: 10, // gold floats to the top of the showcase
    });
    expect(bizData.subscriptionExpiresAt).toBeInstanceOf(Date);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('never shortens an already-active paid period', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    const laterExpiry = new Date(Date.now() + 90 * 86_400_000);
    prisma.subscription.findFirst.mockResolvedValue({
      ...pendingSub,
      business: { id: 12, subscriptionExpiresAt: laterExpiry },
    });
    prisma.subscription.update.mockResolvedValue({ id: 44 });
    prisma.business.update.mockResolvedValue({ id: 12 });

    await service.approveSubscription(admin, 44);

    expect(prisma.business.update.mock.calls[0][0].data.subscriptionExpiresAt).toEqual(laterExpiry);
  });

  it('refuses to re-review an already decided subscription', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    prisma.subscription.findFirst.mockResolvedValue({ ...pendingSub, status: 'ACTIVE' });

    await expect(service.approveSubscription(admin, 44)).rejects.toThrow('قبلاً بررسی');
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('a personal subscription activates without touching any business', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    prisma.subscription.findFirst.mockResolvedValue({
      ...pendingSub,
      businessId: null,
      business: null,
    });
    prisma.subscription.update.mockResolvedValue({ id: 44 });

    await service.approveSubscription(admin, 44);

    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('requires a reason when rejecting a subscription', async () => {
    const { service } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    await expect(service.rejectSubscription(admin, 44, {})).rejects.toThrow('علت رد');
  });
});

describe('AdminService business approval', () => {
  it('accepts a complete map pin and rejects a half one', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    prisma.business.findFirst.mockResolvedValue({ id: 3 });
    prisma.business.update.mockResolvedValue({ id: 3, status: 'APPROVED' });

    await expect(service.approveBusiness(admin, 3, { latitude: 27.8 })).rejects.toThrow('مختصات باید کامل');

    await service.approveBusiness(admin, 3, { latitude: 27.83, longitude: 52.32 });
    expect(prisma.business.update.mock.calls[0][0].data).toMatchObject({
      status: 'APPROVED',
      latitude: 27.83,
      longitude: 52.32,
    });
  });

  it('validates coordinate ranges', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN', provinceId: null, cityId: null });
    prisma.business.findFirst.mockResolvedValue({ id: 3 });

    await expect(
      service.approveBusiness(admin, 3, { latitude: 999, longitude: 0 }),
    ).rejects.toThrow('مختصات نامعتبر');
  });
});
