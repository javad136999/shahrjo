import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import { UsersService } from './users.service';

const baseUser = {
  id: 1,
  phone: '09123456789',
  fullName: null,
  avatarUrl: null,
  cityId: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
} as unknown as User;

function makeService() {
  const prisma = { user: { update: jest.fn() } };
  const rbac = { getRoles: jest.fn().mockResolvedValue(['USER']) };
  const service = new UsersService(prisma as unknown as PrismaService, rbac as unknown as RbacService);
  return { service, prisma, rbac };
}

describe('UsersService.getMe', () => {
  it('returns the safe profile with roles and city-selection flag', async () => {
    const { service } = makeService();
    const me = await service.getMe({ ...baseUser, cityId: 42 } as User);

    expect(me).toMatchObject({
      id: 1,
      phone: '09123456789',
      cityId: 42,
      hasSelectedCity: true,
      status: 'ACTIVE',
      roles: ['USER'],
    });
    expect(me).not.toHaveProperty('password'); // never expose internals
  });

  it('flags first-run users (no city yet)', async () => {
    const { service } = makeService();
    const me = await service.getMe(baseUser);
    expect(me.hasSelectedCity).toBe(false);
    expect(me.cityId).toBeNull();
  });
});

describe('UsersService.updateMe', () => {
  it('updates only provided fields', async () => {
    const { service, prisma } = makeService();
    prisma.user.update.mockResolvedValue({ ...baseUser, fullName: 'علی' });

    const me = await service.updateMe(baseUser, { fullName: 'علی' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { fullName: 'علی' },
    });
    expect(me.fullName).toBe('علی');
  });

  it('skips the update when nothing changes', async () => {
    const { service, prisma } = makeService();
    await service.updateMe(baseUser, {});
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
