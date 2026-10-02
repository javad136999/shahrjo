import type { PrismaService } from '../prisma/prisma.service';
import { RbacService } from './rbac.service';

function makeService() {
  const prisma = {
    adminUser: { findUnique: jest.fn() },
    role: { findUnique: jest.fn() },
  };
  const service = new RbacService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('RbacService.getRoles', () => {
  it('gives plain users the USER role', async () => {
    const { service, prisma } = makeService();
    prisma.adminUser.findUnique.mockResolvedValue(null);
    expect(await service.getRoles(1)).toEqual(['USER']);
  });

  it("returns the admin's role for active admins", async () => {
    const { service, prisma } = makeService();
    prisma.adminUser.findUnique.mockResolvedValue({ isActive: true, role: { code: 'CITY_ADMIN' } });
    expect(await service.getRoles(1)).toEqual(['CITY_ADMIN']);
  });

  it('falls back to USER for inactive admin rows', async () => {
    const { service, prisma } = makeService();
    prisma.adminUser.findUnique.mockResolvedValue({ isActive: false, role: { code: 'SUPER_ADMIN' } });
    expect(await service.getRoles(1)).toEqual(['USER']);
  });
});

describe('RbacService.getPermissions', () => {
  it("maps an admin's role permissions", async () => {
    const { service, prisma } = makeService();
    prisma.adminUser.findUnique.mockResolvedValue({
      isActive: true,
      role: {
        permissions: [
          { permission: { code: 'ads.moderate' } },
          { permission: { code: 'payments.view' } },
        ],
      },
    });
    expect(await service.getPermissions(1)).toEqual(['ads.moderate', 'payments.view']);
  });

  it('uses the seeded USER role permissions for regular users', async () => {
    const { service, prisma } = makeService();
    prisma.adminUser.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({
      permissions: [{ permission: { code: 'ads.view' } }, { permission: { code: 'ads.create' } }],
    });
    expect(await service.getPermissions(1)).toEqual(['ads.view', 'ads.create']);
  });
});

describe('RbacService.getScope', () => {
  it('returns null for non-admins', async () => {
    const { service, prisma } = makeService();
    prisma.adminUser.findUnique.mockResolvedValue(null);
    expect(await service.getScope(1)).toBeNull();
  });

  it('returns role + province/city scope for admins', async () => {
    const { service, prisma } = makeService();
    prisma.adminUser.findUnique.mockResolvedValue({
      isActive: true,
      role: { code: 'CITY_ADMIN' },
      provinceId: 1,
      cityId: 7,
    });
    expect(await service.getScope(1)).toEqual({ role: 'CITY_ADMIN', provinceId: 1, cityId: 7 });
  });
});
