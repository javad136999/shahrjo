import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { RbacService } from '../rbac/rbac.service';
import { PrismaService } from '../prisma/prisma.service';

export interface MeResponse {
  id: number;
  phone: string;
  fullName: string | null;
  avatarUrl: string | null;
  cityId: number | null;
  hasSelectedCity: boolean;
  status: string;
  roles: string[];
  createdAt: Date;
}

export interface UpdateProfileDto {
  fullName?: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async getMe(user: User): Promise<MeResponse> {
    const roles = await this.rbac.getRoles(user.id);
    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      cityId: user.cityId,
      hasSelectedCity: user.cityId !== null,
      status: user.status,
      roles,
      createdAt: user.createdAt,
    };
  }

  async updateMe(user: User, dto: UpdateProfileDto): Promise<MeResponse> {
    const data: { fullName?: string; avatarUrl?: string } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    const updated = Object.keys(data).length
      ? await this.prisma.user.update({ where: { id: user.id }, data })
      : user;

    return this.getMe(updated);
  }
}
