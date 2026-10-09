import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBusinessDto } from './businesses.dto';

export interface CreatedBusiness {
  id: number;
  name: string;
  /** Always PENDING: only the admin queue can publish a business. */
  status: 'PENDING';
}

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User, dto: CreateBusinessDto): Promise<CreatedBusiness> {
    if (!user.cityId) throw new BadRequestException('ابتدا شهر خودت را انتخاب کن');

    // The selected city must still be active (same rule as ad submission).
    const city = await this.prisma.city.findFirst({
      where: { id: user.cityId, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');

    const category = await this.prisma.businessCategory.findFirst({
      where: { id: dto.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');

    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) {
      throw new BadRequestException('مختصات باید کامل وارد شود');
    }

    // Anti-flood / anti-bypass: one open request per city at a time, and no
    // second row with an identical name while one is pending or published.
    const open = await this.prisma.business.findFirst({
      where: { ownerId: user.id, cityId: city.id, status: 'PENDING' },
      select: { id: true },
    });
    if (open) {
      throw new HttpException(
        {
          code: 'DUPLICATE_BUSINESS',
          message: 'یک درخواست کسب‌وکار شما در این شهر در انتظار بررسی است؛ پس از تصمیم ناظر می‌توانید درخواست جدید ثبت کنید',
        },
        HttpStatus.CONFLICT,
      );
    }

    const duplicate = await this.prisma.business.findFirst({
      where: {
        ownerId: user.id,
        cityId: city.id,
        name: { equals: dto.name, mode: 'insensitive' },
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new HttpException(
        { code: 'DUPLICATE_BUSINESS', message: 'کسب‌وکاری با همین نام برای شما در این شهر ثبت شده است' },
        HttpStatus.CONFLICT,
      );
    }

    // Claim fresh BUSINESS uploads (POST /uploads?entity=business).
    const logoId = dto.logoMediaId;
    const coverId = dto.coverMediaId;
    const mediaIds = [...new Set([logoId, coverId].filter((v): v is number => v !== undefined))];
    const urlById = new Map<number, string>();
    if (mediaIds.length > 0) {
      const rows = await this.prisma.media.findMany({
        where: { id: { in: mediaIds }, ownerUserId: user.id, entityType: 'BUSINESS', entityId: null, deletedAt: null },
        select: { id: true, url: true },
      });
      if (rows.length !== mediaIds.length) throw new BadRequestException('یکی از تصاویر ارسالی نامعتبر است');
      for (const row of rows) urlById.set(row.id, row.url);
    }

    const social = dto.socialLinks
      ? Object.fromEntries(
          Object.entries(dto.socialLinks)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
            .map(([key, value]) => [key, value.trim()]),
        )
      : undefined;
    const hasSocial = social !== undefined && Object.keys(social).length > 0;

    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          cityId: city.id,
          categoryId: dto.categoryId,
          ownerId: user.id,
          name: dto.name,
          // Temp unique slug; the canonical `b-<id>` is applied below in the
          // same transaction (slug is unique but unused by clients today).
          slug: `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          description: dto.description ?? null,
          logoUrl: logoId !== undefined ? urlById.get(logoId)! : null,
          coverUrl: coverId !== undefined ? urlById.get(coverId)! : null,
          phone: dto.phone ?? user.phone,
          address: dto.address ?? null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          socialLinks: hasSocial ? social : undefined,
          status: 'PENDING', // moderation queue — never APPROVED from user input
        },
        select: { id: true },
      });
      await tx.business.update({ where: { id: created.id }, data: { slug: `b-${created.id}` } });
      if (mediaIds.length > 0) {
        await tx.media.updateMany({
          where: { id: { in: mediaIds } },
          data: { entityId: String(created.id) },
        });
      }
      return created.id;
    });

    return { id, name: dto.name, status: 'PENDING' };
  }
}
