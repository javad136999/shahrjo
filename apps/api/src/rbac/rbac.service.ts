import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminScope {
  role: string;
  provinceId: number | null;
  cityId: number | null;
}

/**
 * Role/permission resolution from `roles`, `permissions`, `role_permissions`
 * and `admin_users` (scoped by province/city for admin roles).
 * Regular users implicitly hold the `USER` role.
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoles(userId: number): Promise<string[]> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { userId },
      include: { role: true },
    });
    if (admin && admin.isActive) return [admin.role.code];
    return ['USER'];
  }

  async getPermissions(userId: number): Promise<string[]> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (admin && admin.isActive) {
      return admin.role.permissions.map((rp) => rp.permission.code);
    }
    const userRole = await this.prisma.role.findUnique({
      where: { code: 'USER' },
      include: { permissions: { include: { permission: true } } },
    });
    return (userRole?.permissions ?? []).map((rp) => rp.permission.code);
  }

  /** Scope of an admin operator (Phase 10 uses it to isolate city/province data). */
  async getScope(userId: number): Promise<AdminScope | null> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { userId },
      include: { role: true },
    });
    if (!admin || !admin.isActive) return null;
    return { role: admin.role.code, provinceId: admin.provinceId, cityId: admin.cityId };
  }
}
